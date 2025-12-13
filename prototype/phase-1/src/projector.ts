import { SimpleGit } from 'simple-git';
import { getDeterministicGit } from './projection-env';
import { calculateSnapshotHash } from './snapshot';
import { promises as fs } from 'fs';
import path from 'path';

type CommitMetadata = {
  original_commit_sha: string;
  source_parent_shas: string[];
  parent_data_commit_oid: string | null;
  snapshot_hash: string;
  files: { path: string; sha: string; mode: string }[];
};

export async function project(sourceCommitSha: string, repoPath: string): Promise<string> {
  const git = getDeterministicGit(repoPath);

  let parentDataCommitOid: string | null = null;
  try {
    parentDataCommitOid = await git.revparse(['refs/heads/workspace/data']);
  } catch (e) { /* Branch doesn't exist */ }

  if (parentDataCommitOid) {
    try {
      const metadataJson = await git.show([`${parentDataCommitOid}:metadata/commit.json`]);
      const metadata: CommitMetadata = JSON.parse(metadataJson);
      if (metadata.original_commit_sha === sourceCommitSha) {
        return parentDataCommitOid;
      }
    } catch (e) { /* Not a projection commit */ }
  }

  const snapshotHash = await calculateSnapshotHash(git, sourceCommitSha);
  const treeListing = await git.raw('ls-tree', '-r', sourceCommitSha);
  const files = treeListing.split('\n').filter(Boolean).map(line => {
    const [mode, , sha, path] = line.split(/[ \t]/);
    return { path, sha, mode };
  });

  const sourceParents = (await git.show(['-s', '--format=%P', sourceCommitSha])).trim().split(' ');

  const tempIndex = path.join(repoPath, '.git', 'index.projection');
  const tempDir = await fs.mkdtemp('/tmp/proj-');
  try {
    // Ensure the index is clean before starting
    await fs.rm(tempIndex, { force: true });
    const gitWithIndex = git.env({ ...process.env, GIT_INDEX_FILE: tempIndex });

    // 1. Add artifact files to the new index
    for (const file of files) {
      await gitWithIndex.raw('update-index', '--add', '--cacheinfo', `${file.mode},${file.sha},artifacts/${file.path}`);
    }

    // 2. Create and add metadata file to the new index
    const metadata: CommitMetadata = {
      original_commit_sha: sourceCommitSha,
      source_parent_shas: sourceParents.filter(Boolean),
      parent_data_commit_oid: parentDataCommitOid,
      snapshot_hash: snapshotHash,
      files,
    };
    const metadataContent = JSON.stringify(metadata, null, 2);
    const tempMetadataPath = path.join(tempDir, 'commit.json');
    await fs.writeFile(tempMetadataPath, metadataContent);
    const metadataSha = (await gitWithIndex.hashObject(tempMetadataPath, true)).trim();

    await gitWithIndex.raw('update-index', '--add', '--cacheinfo', `100644,${metadataSha},metadata/commit.json`);

    // 3. Write the single, complete tree
    const rootTreeSha = (await gitWithIndex.raw('write-tree')).trim();

    // 4. Create the commit
    const commitArgs = ['-m', `Projection of ${sourceCommitSha}`];
    if (parentDataCommitOid) {
      commitArgs.push('-p', parentDataCommitOid);
    }
    const dataCommitSha = (await git.raw('commit-tree', rootTreeSha, ...commitArgs)).trim();

    // 5. Update the ref
    await git.raw('update-ref', 'refs/heads/workspace/data', dataCommitSha);

    return dataCommitSha;
  } finally {
    await fs.rm(tempIndex, { force: true });
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

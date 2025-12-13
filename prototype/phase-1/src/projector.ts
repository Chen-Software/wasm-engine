import { SimpleGit } from 'simple-git';
import { getGit } from './projection-env';
import { computeSnapshotHash } from './snapshot';
import { promises as fs } from 'fs';
import path from 'path';

type ProjectionMetadata = {
  original_commit_sha: string;
  source_parent_shas: string[];
  parent_data_commit_oid: string | null;
  snapshot_hash: string;
  files: Array<{
    path: string;
    blob_sha: string;
    mode: string;
    size: number;
  }>;
};

// Helper to find the projection of a specific source commit by scanning history.
// This is needed to correctly find the parent of a merge commit projection.
async function findProjectionOf(git: SimpleGit, sourceCommitSha: string): Promise<string | null> {
  try {
    const log = await git.log({ 'workspace/data': null });
    for (const commit of log.all) {
      try {
        const metadataJson = await git.show([`${commit.hash}:metadata/commit.json`]);
        const metadata: ProjectionMetadata = JSON.parse(metadataJson);
        if (metadata.original_commit_sha === sourceCommitSha) {
          return commit.hash;
        }
      } catch (e) { /* Not a projection commit */ }
    }
  } catch (e) { /* Data branch doesn't exist */ }
  return null;
}

export async function project(git: SimpleGit, sourceCommitSha: string): Promise<string> {
  const repoPath = await git.revparse(['--show-toplevel']);
  const deterministicGit = getGit(repoPath);
  const dataBranch = 'workspace/data';

  // --- Idempotency & Parent Logic ---
  const sourceParents = (await deterministicGit.show(['-s', '--format=%P', sourceCommitSha])).trim().split(' ').filter(Boolean);
  const isMerge = sourceParents.length > 1;

  let parentDataCommitOid: string | null = null;

  if (isMerge) {
    // For a merge, the parent MUST be the projection of the first source parent.
    parentDataCommitOid = await findProjectionOf(deterministicGit, sourceParents[0]);
  } else {
    // For a linear commit, the parent is simply the current head of the data branch.
    try {
      parentDataCommitOid = await deterministicGit.revparse([dataBranch]);
    } catch (e) { /* Branch doesn't exist */ }
  }

  // Idempotency check: If the would-be parent is already a projection of the current commit, we're done.
  if (parentDataCommitOid) {
      try {
        const parentMetadataJson = await deterministicGit.show([`${parentDataCommitOid}:metadata/commit.json`]);
        const parentMetadata: ProjectionMetadata = JSON.parse(parentMetadataJson);
        if (parentMetadata.original_commit_sha === sourceCommitSha) {
            return parentDataCommitOid;
        }
      } catch(e) { /* Not a projection commit */ }
  }


  // --- Projection Logic ---
  const snapshotHash = await computeSnapshotHash(deterministicGit, sourceCommitSha);
  const lsTreeOutput = await deterministicGit.raw(['ls-tree', '-r', '-l', sourceCommitSha]);
  const files = lsTreeOutput.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(/[ \t]+/);
      return { mode: parts[0], blob_sha: parts[2], path: parts[4], size: parseInt(parts[3], 10) };
  });

  const tempIndex = path.join(repoPath, '.git', 'index.projection');
  const tempDir = await fs.mkdtemp(path.join('/tmp', 'proj-'));
  try {
    const gitWithIndex = deterministicGit.env({ ...process.env, GIT_INDEX_FILE: tempIndex });
    await fs.rm(tempIndex, { force: true }); // Ensure index is clean

    for (const file of files) {
      await gitWithIndex.raw(['update-index', '--add', '--cacheinfo', `${file.mode},${file.blob_sha},artifacts/${file.path}`]);
    }

    const metadata: ProjectionMetadata = {
      original_commit_sha: sourceCommitSha,
      source_parent_shas: sourceParents,
      parent_data_commit_oid: parentDataCommitOid,
      snapshot_hash: snapshotHash,
      files,
    };
    const metadataPath = path.join(tempDir, 'commit.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    const metadataSha = (await gitWithIndex.hashObject(metadataPath, true)).trim();
    await gitWithIndex.raw(['update-index', '--add', '--cacheinfo', `100644,${metadataSha},metadata/commit.json`]);

    const rootTreeSha = (await gitWithIndex.raw(['write-tree'])).trim();

    const commitMessage = `Projection of ${sourceCommitSha}`;
    const commitArgs = ['-m', commitMessage];
    if (parentDataCommitOid) {
      commitArgs.push('-p', parentDataCommitOid);
    }
    const dataCommitSha = (await deterministicGit.raw(['commit-tree', rootTreeSha, ...commitArgs])).trim();

    await deterministicGit.raw(['update-ref', `refs/heads/${dataBranch}`, dataCommitSha]);

    return dataCommitSha;
  } finally {
    await fs.rm(tempIndex, { force: true });
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

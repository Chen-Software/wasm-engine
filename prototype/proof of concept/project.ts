import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import { hashGitTree } from './hash';

/**
 * Projects the 'main' branch into 'data' branch.
 * Supports idempotency and tracks multiple commits.
 */
export async function project(
  customFs: typeof fs = fs,
  projectDir: string = process.cwd()
) {
  const gitdir = path.resolve(projectDir, '.git');
  if (!customFs.existsSync(gitdir)) {
    throw new Error('Not a git repository.');
  }

  const dir = projectDir;
  const sourceBranch = 'main';
  const targetBranch = 'data';

  try {
    // Resolve main branch commit
    const sourceCommitOid = await git.resolveRef({ fs: customFs, gitdir, ref: sourceBranch });
    const sourceCommit = await git.readCommit({ fs: customFs, gitdir, oid: sourceCommitOid });
    const mainTreeOid = sourceCommit.commit.tree;
    const timestamp = sourceCommit.commit.author.timestamp;

    // Idempotency: check if already projected
    let parent: string[] = [];
    try {
      const dataBranchOid = await git.resolveRef({ fs: customFs, gitdir, ref: targetBranch });
      parent.push(dataBranchOid);

      // Check existing commits for matching original_commit_sha
      const dataLog = await git.log({ fs: customFs, gitdir, ref: targetBranch });
      for (const entry of dataLog) {
        const dataTree = await git.readTree({ fs: customFs, gitdir, oid: entry.commit.tree });
        const metadataEntry = dataTree.tree.find(e => e.path === 'metadata');
        if (!metadataEntry) continue;

        const metadataTree = await git.readTree({ fs: customFs, gitdir, oid: metadataEntry.oid });
        const jsonEntry = metadataTree.tree.find(e => e.path === 'commit.json');
        if (!jsonEntry) continue;

        const blob = await git.readBlob({ fs: customFs, gitdir, oid: jsonEntry.oid });
        const metadata = JSON.parse(Buffer.from(blob.blob).toString());
        if (metadata.original_commit_sha === sourceCommitOid) {
          console.log(`Commit ${sourceCommitOid} already projected. Skipping.`);
          return;
        }
      }
    } catch {
      // 'data' branch may not exist; will create new
    }

    // Walk main branch tree to gather files and directories
    const fileList: string[] = [];
    await git.walk({
      fs: customFs,
      dir,
      gitdir,
      trees: [git.TREE({ ref: sourceCommitOid })],
      map: async (filepath, [entry]) => {
        if (filepath === '.') return;
        if (entry) {
          const type = await entry.type();
          fileList.push(filepath.replace(/\\/g, '/')); // normalize paths
        }
        return filepath;
      },
    });

    const snapshotHash = await hashGitTree({ fs: customFs, gitdir, oid: mainTreeOid });
    const metadata = {
      original_commit_sha: sourceCommitOid,
      parent_data_commit_oid: parent[0] || null,
      snapshot_hash: snapshotHash,
      timestamp: new Date(timestamp * 1000).toISOString(),
      files: fileList,
    };
    const metadataContent = JSON.stringify(metadata, null, 2);
    const metadataBlobOid = await git.writeBlob({ fs: customFs, gitdir, blob: Buffer.from(metadataContent) });

    const metadataTreeOid = await git.writeTree({
      fs: customFs,
      gitdir,
      tree: [{ path: 'commit.json', mode: '100644', oid: metadataBlobOid, type: 'blob' }],
    });

    const dataTreeOid = await git.writeTree({
      fs: customFs,
      gitdir,
      tree: [
        { path: 'artifacts', mode: '040000', oid: mainTreeOid, type: 'tree' },
        { path: 'metadata', mode: '040000', oid: metadataTreeOid, type: 'tree' },
      ],
    });

    const newCommitOid = await git.commit({
      fs: customFs,
      gitdir,
      message: `chore: project snapshot for commit ${sourceCommitOid}`,
      tree: dataTreeOid,
      parent,
      author: { name: 'LocalCI', email: 'ci@localhost' },
    });

    await git.writeRef({
      fs: customFs,
      gitdir,
      ref: `refs/heads/${targetBranch}`,
      value: newCommitOid,
      force: true,
    });

    console.log(`Successfully projected snapshot of ${sourceCommitOid} to '${targetBranch}' branch.`);
  } catch (error) {
    console.error('Projection failed:', error);
    throw error;
  }
}

if (require.main === module) {
  project();
}

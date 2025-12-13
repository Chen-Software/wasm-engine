import git from 'isomorphic-git';
import type { FsPromisesApi } from 'memfs/lib/node/types';
import { calculateSnapshotHash } from './utilities';
import path from 'path';

// The fs provided by memfs is not perfectly compatible with the fs required by isomorphic-git.
// This is a workaround to make them compatible.
type GitFs = { promises: FsPromisesApi & { readdir: (path: string) => Promise<string[]> } };

type CommitMetadata = {
  original_commit_sha: string;
  parent_data_commit_oid: string | null;
  snapshot_hash: string;
  timestamp: string;
  files: string[];
};

export async function project({
  sourceCommitOid,
  fs,
  projectDir,
}: {
  sourceCommitOid: string;
  fs: GitFs;
  projectDir: string;
}): Promise<void> {
  const gitdir = path.join(projectDir, '.git');

  // 1. Idempotency Check
  try {
    const dataBranchCommits = await git.log({ fs, gitdir, ref: 'refs/heads/data' });
    for (const commit of dataBranchCommits) {
      try {
        const { blob: metadataBlob } = await git.readBlob({
          fs,
          gitdir,
          oid: commit.oid,
          filepath: 'metadata/commit.json',
        });
        const metadata: CommitMetadata = JSON.parse(Buffer.from(metadataBlob).toString());
        if (metadata.original_commit_sha === sourceCommitOid) {
          console.log(`Projection for commit ${sourceCommitOid} already exists. Skipping.`);
          return;
        }
      } catch (e) {
        // Ignore commits on the data branch that don't have our metadata file.
      }
    }
  } catch (e) {
    // Data branch doesn't exist yet, so we'll create it.
  }

  // 2. Walk the source tree and collect files.
  const sourceCommit = await git.readCommit({ fs, gitdir, oid: sourceCommitOid });
  const files: string[] = [];
  await git.walk({
    fs,
    gitdir,
    trees: [git.TREE({ ref: sourceCommit.commit.tree })],
    map: async (filepath, entries) => {
      const entry = entries[0];
      if (entry && (await entry.type()) === 'blob') {
        files.push(filepath);
      }
      return;
    },
  });

  // 3. Generate metadata
  const snapshotHash = await calculateSnapshotHash(sourceCommit.commit.tree, fs, gitdir);
  const parentDataCommitOid = await git
    .resolveRef({ fs, gitdir, ref: 'refs/heads/data' })
    .catch(() => null);

  const metadata: CommitMetadata = {
    original_commit_sha: sourceCommitOid,
    parent_data_commit_oid: parentDataCommitOid,
    snapshot_hash: snapshotHash,
    timestamp: new Date().toISOString(),
    files: files.sort(),
  };

  // 4. Create the new tree and commit
  const metadataOid = await git.writeBlob({
    fs,
    gitdir,
    blob: Buffer.from(JSON.stringify(metadata, null, 2)),
  });

  const metadataTreeOid = await git.writeTree({
    fs,
    gitdir,
    tree: [{ path: 'commit.json', mode: '100644', oid: metadataOid, type: 'blob' }],
  });

  const dataBranchTreeOid = await git.writeTree({
    fs,
    gitdir,
    tree: [
      { path: 'artifacts', mode: '040000', oid: sourceCommit.commit.tree, type: 'tree' },
      { path: 'metadata', mode: '040000', oid: metadataTreeOid, type: 'tree' },
    ],
  });

  const commitDetails = {
    message: `chore: project snapshot for commit ${sourceCommitOid}`,
    tree: dataBranchTreeOid,
    parent: parentDataCommitOid ? [parentDataCommitOid] : [],
    author: {
      name: 'LocalCI',
      email: 'ci@localhost',
      timestamp: Math.floor(Date.now() / 1000),
      timezoneOffset: new Date().getTimezoneOffset(),
    },
  };

  const newCommitOid = await git.writeCommit({
    fs,
    gitdir,
    commit: {
      ...commitDetails,
      committer: commitDetails.author,
    },
  });

  // 5. Update data branch
  await git.writeRef({
    fs,
    gitdir,
    ref: 'refs/heads/data',
    value: newCommitOid,
    force: true,
  });

  // 6. Post-projection validation
  const recomputedSnapshotHash = await calculateSnapshotHash(sourceCommit.commit.tree, fs, gitdir);
  if (recomputedSnapshotHash !== snapshotHash) {
    throw new Error('Snapshot hash validation failed!');
  }

  console.log(`Successfully projected commit ${sourceCommitOid} to data branch.`);
}

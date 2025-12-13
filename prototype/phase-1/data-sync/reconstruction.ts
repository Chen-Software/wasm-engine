import git from 'isomorphic-git';
import type { FsPromisesApi } from 'memfs/lib/node/types';
import path from 'path';

// The fs provided by memfs is not perfectly compatible with the fs required by isomorphic-git.
// This is a workaround to make them compatible.
type GitFs = { promises: FsPromisesApi & { readdir: (path: string) => Promise<string[]> } };

export async function reconstruct({
  outputDir = 'reconstructed_tree',
  fs,
  projectDir,
}: {
  outputDir?: string;
  fs: GitFs;
  projectDir: string;
}): Promise<void> {
  const gitdir = path.join(projectDir, '.git');

  // 1. Resolve the latest commit on the data branch.
  const dataBranchOid = await git.resolveRef({ fs, gitdir, ref: 'refs/heads/data' });
  const commit = await git.readCommit({ fs, gitdir, oid: dataBranchOid });

  // 2. Locate the artifacts/ subtree.
  const artifactsTreeEntry = (
    await git.readTree({ fs, gitdir, oid: commit.commit.tree })
  ).tree.find(entry => entry.path === 'artifacts');

  if (!artifactsTreeEntry) {
    throw new Error('Could not find artifacts/ tree in the latest data branch commit.');
  }
  const artifactsTreeOid = artifactsTreeEntry.oid;

  // 3. Clean the output directory.
  await fs.promises.rm(outputDir, { recursive: true, force: true });
  await fs.promises.mkdir(outputDir, { recursive: true });

  // 4. Recursively walk the artifacts/ tree and write files.
  await git.walk({
    fs,
    gitdir,
    trees: [git.TREE({ ref: artifactsTreeOid })],
    map: async (filepath, entries) => {
      const entry = entries[0];
      if (entry && (await entry.type()) === 'blob') {
        const { blob } = await git.readBlob({ fs, gitdir, oid: await entry.oid() });
        const outputPath = path.join(outputDir, filepath);
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.promises.writeFile(outputPath, Buffer.from(blob));
      }
      return;
    },
  });

  console.log(`Successfully reconstructed artifacts to ${outputDir}`);
}

import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

/**
 * Reconstructs files from 'data/artifacts' to a specified output directory.
 */
export async function reconstruct(
  outputDir: string = 'reconstructed_tree',
  customFs: typeof fs = fs,
  projectDir: string = process.cwd()
) {
  const gitdir = path.resolve(projectDir, '.git');
  if (!customFs.existsSync(gitdir)) {
    throw new Error('Not a git repository.');
  }

  const dir = projectDir;
  const targetBranch = 'data';
  const absoluteOutputDir = path.resolve(dir, outputDir);

  try {
    // Resolve data branch commit
    const dataCommitOid = await git.resolveRef({ fs: customFs, gitdir, ref: targetBranch });
    const { commit } = await git.readCommit({ fs: customFs, gitdir, oid: dataCommitOid });

    // Get 'artifacts' tree
    const rootTree = await git.readTree({ fs: customFs, gitdir, oid: commit.tree });
    const artifactsEntry = rootTree.tree.find(e => e.path === 'artifacts' && e.type === 'tree');
    if (!artifactsEntry) throw new Error("'artifacts' directory not found in 'data' branch.");
    const artifactsTreeOid = artifactsEntry.oid;

    // Clean/create output directory
    if (customFs.existsSync(absoluteOutputDir)) {
      customFs.rmSync(absoluteOutputDir, { recursive: true, force: true });
    }
    customFs.mkdirSync(absoluteOutputDir, { recursive: true });

    // Walk artifacts tree and write files
    await git.walk({
      fs: customFs,
      dir,
      gitdir,
      trees: [git.TREE({ oid: artifactsTreeOid })],
      map: async (filepath, [entry]) => {
        if (filepath === '.' || !entry) return;

        const outputPath = path.join(absoluteOutputDir, filepath);
        const type = await entry.type();

        if (type === 'blob') {
          const content = await entry.content();
          if (content) {
            customFs.mkdirSync(path.dirname(outputPath), { recursive: true });
            customFs.writeFileSync(outputPath, content);
          }
        } else if (type === 'tree') {
          customFs.mkdirSync(outputPath, { recursive: true });
        }
      },
    });

    console.log(`Reconstruction complete. Files are in '${outputDir}'`);
  } catch (error) {
    console.error('Reconstruction failed:', error);
    throw error;
  }
}

if (require.main === module) {
  const outputDir = process.argv[2];
  reconstruct(outputDir);
}

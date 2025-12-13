import { project } from './projection';
import fs from 'fs';

async function main() {
  const [,, sourceCommitOid, projectDir] = process.argv;

  if (!sourceCommitOid || !projectDir) {
    console.error('Usage: ts-node project-cli.ts <sourceCommitOid> <projectDir>');
    process.exit(1);
  }

  // Isomorphic-git requires a fs with a `promises` property.
  const gitFs = { promises: fs.promises };

  try {
    await project({
      sourceCommitOid,
      fs: gitFs as any, // Cast to any to satisfy the custom GitFs type.
      projectDir,
    });
    console.log('Projection CLI script finished successfully.');
  } catch (error) {
    console.error('An error occurred during projection:', error);
    process.exit(1);
  }
}

main();

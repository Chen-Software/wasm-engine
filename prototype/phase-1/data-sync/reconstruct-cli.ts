import { reconstruct } from './reconstruction';
import fs from 'fs';

async function main() {
  const [,, projectDir, outputDir] = process.argv;

  if (!projectDir) {
    console.error('Usage: ts-node reconstruct-cli.ts <projectDir> [outputDir]');
    process.exit(1);
  }

  // Isomorphic-git requires a fs with a `promises` property.
  const gitFs = { promises: fs.promises };

  try {
    await reconstruct({
      projectDir,
      fs: gitFs as any, // Cast to any to satisfy the custom GitFs type.
      ...(outputDir && { outputDir }),
    });
    console.log('Reconstruction CLI script finished successfully.');
  } catch (error) {
    console.error('An error occurred during reconstruction:', error);
    process.exit(1);
  }
}

main();

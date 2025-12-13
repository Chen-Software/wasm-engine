import { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Reconstructs a workspace from the `artifacts/` tree of a given data commit.
 * This function provides the empirical proof of P1 (Content Completeness).
 *
 * @param git - A simple-git instance for the repository.
 * @param dataCommitSha - The SHA of the data branch commit to reconstruct from.
 * @param outputDir - The directory to write the reconstructed files to.
 */
export async function reconstruct(git: SimpleGit, dataCommitSha: string, outputDir: string): Promise<void> {
  // 1. Ensure the output directory is clean.
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  // 2. Get the SHA of the `artifacts` tree from the data commit.
  const artifactsTreeSha = await git.revparse([`${dataCommitSha}:artifacts`]);

  // 3. Use `git archive` piped to `tar` to extract the tree to the output directory.
  // This is the most efficient and reliable way to reconstruct the file structure.
  const repoPath = await git.revparse(['--git-dir']);
  const absoluteRepoPath = path.resolve(await git.revparse(['--show-toplevel']), repoPath);

  // We shell out for this operation as it's the cleanest way to handle the pipe.
  await execAsync(`git --git-dir=${absoluteRepoPath} archive ${artifactsTreeSha} | tar -x -C ${outputDir}`);
}

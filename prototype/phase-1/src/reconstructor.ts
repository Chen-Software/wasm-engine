import { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Reconstructs a workspace from a given data commit SHA.
 *
 * @param git - A simple-git instance for the repository.
 * @param dataCommitSha - The SHA of the data branch commit to reconstruct from.
 * @param outputDir - The directory to write the reconstructed files to.
 */
export async function reconstruct(git: SimpleGit, dataCommitSha: string, outputDir: string): Promise<void> {
  // 1. Clean the output directory.
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  // 2. Get the artifacts tree SHA.
  const artifactsTreeSha = await git.revparse([`${dataCommitSha}:artifacts`]);

  // 3. Use `git archive` piped to `tar` to extract the tree.
  const repoPath = await git.revparse(['--git-dir']);
  const absoluteRepoPath = path.resolve(await git.revparse(['--show-toplevel']), repoPath);

  // We have to shell out for this because simple-git doesn't support piping.
  await execAsync(`git --git-dir=${absoluteRepoPath} archive ${artifactsTreeSha} | tar -x -C ${outputDir}`);
}

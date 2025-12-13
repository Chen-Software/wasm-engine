// src/validator.ts

import { simpleGit, SimpleGit } from 'simple-git';

/**
 * Validates that the projected data commit's artifact tree matches the
 * original source commit's tree.
 *
 * @param repoPath The file system path to the repository.
 * @param dataCommitSha The SHA of the data branch commit to validate.
 * @returns A boolean indicating whether the tree hashes match.
 */
export async function validateTreeHash(repoPath: string, dataCommitSha: string): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);

  // 1. Get the original source commit SHA from the data commit's metadata.
  const metadataContent = await git.show([`${dataCommitSha}:metadata.json`]);
  const metadata = JSON.parse(metadataContent);
  const sourceCommitSha = metadata.original_commit_sha;

  if (!sourceCommitSha) {
    throw new Error(`Could not find original_commit_sha in metadata for data commit ${dataCommitSha}`);
  }

  // 2. Get the tree SHA of the original source commit.
  const sourceTreeSha = (await git.revparse([`${sourceCommitSha}^{tree}`])).trim();

  // 3. Get the tree SHA of the 'default' artifact for backward compatibility.
  const artifactsTreeSha = (await git.revparse([`${dataCommitSha}:artifacts/default`])).trim();

  // 4. Compare the tree SHAs.
  return sourceTreeSha === artifactsTreeSha;
}

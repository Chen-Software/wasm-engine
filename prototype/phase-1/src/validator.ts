import { SimpleGit } from 'simple-git';
import { getDeterministicGit } from './projection-env';

/**
 * Validates that the projected `artifacts/` tree in a data commit is a
 * perfect mirror of the original source commit's tree.
 *
 * @param git - A simple-git instance for the repository.
 * @param dataCommitSha - The SHA of the data branch commit to validate.
 * @returns A promise that resolves to true if the trees are identical, false otherwise.
 */
export async function validateTreeHash(git: SimpleGit, dataCommitSha: string): Promise<boolean> {
  // 1. Get the original source commit SHA from the metadata.
  const metadataJson = await git.show([`${dataCommitSha}:metadata/commit.json`]);
  const metadata = JSON.parse(metadataJson);
  const sourceCommitSha = metadata.original_commit_sha;

  // 2. Get the tree SHA of the source commit.
  const sourceTreeSha = await git.revparse([`${sourceCommitSha}^{tree}`]);

  // 3. Get the tree SHA of the projected artifacts.
  const artifactsTreeSha = await git.revparse([`${dataCommitSha}:artifacts`]);

  // 4. Compare the tree SHAs.
  return sourceTreeSha === artifactsTreeSha;
}

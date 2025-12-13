import { SimpleGit } from 'simple-git';

/**
 * Validates that the projected `artifacts/` tree in a data commit is a
 * perfect mirror of the original source commit's tree by comparing their
 * respective tree SHAs.
 *
 * @param git - A simple-git instance for the repository.
 * @param dataCommitSha - The SHA of the data branch commit to validate.
 * @returns A promise that resolves to true if the trees are identical, false otherwise.
 */
export async function validateProjection(git: SimpleGit, dataCommitSha: string): Promise<boolean> {
  // 1. Get the original source commit SHA from the data commit's metadata.
  let sourceCommitSha: string;
  try {
    const metadataJson = await git.show([`${dataCommitSha}:metadata/commit.json`]);
    const metadata = JSON.parse(metadataJson);
    sourceCommitSha = metadata.original_commit_sha;
  } catch (e) {
    console.error(`Failed to read metadata from data commit ${dataCommitSha}`);
    return false;
  }

  // 2. Get the tree SHA of the original source commit.
  const sourceTreeSha = await git.revparse([`${sourceCommitSha}^{tree}`]);

  // 3. Get the tree SHA of the projected `artifacts/` subdirectory in the data commit.
  const artifactsTreeSha = await git.revparse([`${dataCommitSha}:artifacts`]);

  // 4. Compare the tree SHAs. A match proves P1 (Content Completeness).
  return sourceTreeSha === artifactsTreeSha;
}

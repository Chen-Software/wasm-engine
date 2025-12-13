import { createHash } from 'crypto';
import { SimpleGit } from 'simple-git';

/**
 * Computes a canonical SHA-256 hash for a given Git commit's tree.
 * The hash is based on the output of `git ls-tree -r`, which provides a
 * stable, sorted list of all files in the tree, including their mode,

 * SHA, and path.
 *
 * @param git - A simple-git instance for the repository.
 * @param commitSha - The SHA of the commit to snapshot.
 * @returns A promise that resolves to the canonical snapshot hash.
 */
export async function calculateSnapshotHash(git: SimpleGit, commitSha: string): Promise<string> {
  // `ls-tree -r` gives us a stable, sorted, and complete representation of the tree.
  const treeListing = await git.raw('ls-tree', '-r', commitSha);

  if (!treeListing) {
    // An empty tree has a predictable empty hash.
    return createHash('sha256').update('').digest('hex');
  }

  // The output of ls-tree is already canonical and sorted, so we can hash it directly.
  // We normalize line endings to LF to ensure cross-platform determinism.
  const normalizedListing = treeListing.replace(/\r\n/g, '\n');

  return createHash('sha256').update(normalizedListing).digest('hex');
}

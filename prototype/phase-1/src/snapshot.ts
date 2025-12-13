import { createHash } from 'crypto';
import { SimpleGit } from 'simple-git';

/**
 * Computes a canonical SHA-256 hash for a given Git commit's tree.
 * The hash is based on the output of `git ls-tree -r`, which provides a
 * stable, sorted list of all files in the tree, including their mode,
 * SHA, and path. This ensures a deterministic representation of the tree's content.
 *
 * @param git - A simple-git instance for the repository.
 * @param commitSha - The SHA of the commit to snapshot.
 * @returns A promise that resolves to the canonical snapshot hash.
 */
export async function computeSnapshotHash(git: SimpleGit, commitSha: string): Promise<string> {
  // `ls-tree -r` provides a canonical, sorted representation of the tree's contents.
  // Format: <mode> <type> <sha>\t<path>
  const lsTreeOutput = await git.raw(['ls-tree', '-r', commitSha]);

  if (!lsTreeOutput) {
    // An empty tree has a predictable empty hash.
    return createHash('sha256').update('').digest('hex');
  }

  // The output is already sorted by path, but we'll parse and re-format it
  // to "{mode} {sha} {path}\n" to match the spec exactly and avoid any
  // variance from the <type> field or tab characters.
  const canonicalString = lsTreeOutput
    .trim()
    .split('\n')
    .map(line => {
      const [meta, path] = line.split('\t');
      const [mode, , sha] = meta.split(' ');
      return `${mode} ${sha} ${path}`;
    })
    .join('\n');

  return createHash('sha256').update(canonicalString).digest('hex');
}

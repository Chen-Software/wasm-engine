// src/snapshot.ts

import { simpleGit, SimpleGit } from 'simple-git';
import { createHash } from 'crypto';

/**
 * Computes a deterministic snapshot hash of a Git commit's tree.
 * The hash is based on the canonical representation of the tree's contents,
 * ensuring that identical trees produce identical hashes.
 *
 * @param repoPath The file system path to the repository.
 * @param commitSha The SHA of the commit to snapshot.
 * @returns A SHA-256 hash representing the snapshot.
 */
export async function computeSnapshotHash(repoPath: string, commitSha: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);

  // Get the tree listing in a stable, sorted format.
  // The output format is: <mode> <type> <sha>\t<path>
  const lsTreeOutput = await git.raw(['ls-tree', '-r', commitSha]);

  if (!lsTreeOutput) {
    // Handle empty commits by returning a hash of an empty string.
    return createHash('sha256').update('').digest('hex');
  }

  // The output of ls-tree is already sorted lexicographically by path,
  // which is critical for determinism.
  const lines = lsTreeOutput.trim().split('\n');

  // Build the canonical string: "mode sha path\n"
  const canonicalString = lines.map(line => {
    // Example line: 100644 blob 1a2b3c...\tfile.txt
    const [mode, type, sha, path] = line.split(/[ \t]/, 4);
    if (type !== 'blob') {
      // For this PoC, we only care about files (blobs).
      // Other types like trees or submodules could be included if needed.
      return '';
    }
    return `${mode} ${sha} ${path}`;
  })
  .filter(Boolean) // Filter out non-blob entries
  .join('\n') + '\n'; // Use LF for consistent line endings

  // Compute the final hash.
  return createHash('sha256').update(canonicalString).digest('hex');
}

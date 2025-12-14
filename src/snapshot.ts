// src/snapshot.ts

import { simpleGit, SimpleGit } from 'simple-git';
import { createHash } from 'crypto';

/**
 * Computes a deterministic snapshot hash for a given set of files in a Git commit.
 *
 * @param repoPath The file system path to the repository.
 * @param commitSha The SHA of the commit to snapshot.
 * @param filePaths An array of file paths to include in the hash.
 * @returns A SHA-256 hash representing the snapshot.
 */
export async function computeSnapshotHash(repoPath: string, commitSha: string, filePaths?: string[]): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);

  // Use ls-tree to get all files if no specific paths are provided.
  const lsTreeArgs = ['ls-tree', '-r', commitSha];
  if (filePaths) {
    lsTreeArgs.push(...filePaths);
  }
  const lsTreeOutput = await git.raw(lsTreeArgs);

  if (!lsTreeOutput) {
    return createHash('sha256').update('').digest('hex');
  }

  const lines = lsTreeOutput.trim().split('\n');

  const canonicalString = lines.map(line => {
    const [mode, type, sha, path] = line.split(/[ \t]/, 4);
    if (type !== 'blob') {
      return '';
    }
    return `${mode} ${sha} ${path}`;
  })
  .filter(Boolean)
  .sort() // Sort to ensure globs don't affect the hash
  .join('\n') + '\n';

  return createHash('sha256').update(canonicalString).digest('hex');
}

import { createHash } from 'crypto';
import type { WalkerEntry } from 'isomorphic-git';
import git from 'isomorphic-git';
import type { FsPromisesApi } from 'memfs/lib/node/types';

// The fs provided by memfs is not perfectly compatible with the fs required by isomorphic-git.
// This is a workaround to make them compatible.
type GitFs = { promises: FsPromisesApi & { readdir: (path: string) => Promise<string[]> } };

/**
 * Calculates a SHA-256 hash for a given git tree to serve as a snapshot identifier.
 * The hash is computed over a sorted list of file paths and their corresponding blob contents,
 * ensuring that the hash is deterministic and representative of the tree's state.
 *
 * @param treeOid - The OID of the git tree to hash.
 * @param fs - The filesystem instance (real or in-memory).
 * @param gitdir - The path to the .git directory.
 * @returns A promise that resolves to the SHA-256 snapshot hash.
 */
export async function calculateSnapshotHash(
  treeOid: string,
  fs: GitFs,
  gitdir: string,
): Promise<string> {
  const hash = createHash('sha256');
  const files: { filepath: string; oid: string }[] = [];

  // Use isomorphic-git's walk to recursively traverse the tree.
  await git.walk({
    fs,
    gitdir,
    trees: [git.TREE({ ref: treeOid })],
    map: async (filepath, entries) => {
      // We only care about files (blobs).
      const entry = entries[0];
      if (entry && (await entry.type()) === 'blob') {
        files.push({ filepath, oid: await entry.oid() });
      }
      return;
    },
  });

  // Sort files by path to ensure a deterministic hash.
  files.sort((a, b) => a.filepath.localeCompare(b.filepath));

  // Read each blob and update the hash with its path and content.
  for (const file of files) {
    const { blob } = await git.readBlob({ fs, gitdir, oid: file.oid });
    hash.update(file.filepath);
    hash.update(blob);
  }

  return hash.digest('hex');
}

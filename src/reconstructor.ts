// src/reconstructor.ts

import { simpleGit, SimpleGit } from 'simple-git';
import { computeSnapshotHash } from './snapshot';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Reconstructs a workspace from a data commit into a specified output directory.
 *
 * @param repoPath The file system path to the repository containing the data branch.
 * @param dataCommitSha The SHA of the data commit to reconstruct from.
 * @param outputDir The directory where the workspace will be reconstructed.
 * @returns A boolean indicating whether the reconstruction was successful and valid.
 */
export async function reconstructWorkspace(repoPath: string, dataCommitSha: string, outputDir: string): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);

  // 1. Read the metadata from the data commit.
  const metadataContent = await git.show([`${dataCommitSha}:metadata/commit.json`]);
  const metadata = JSON.parse(metadataContent);

  // 2. Clean and create the output directory.
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  // 3. Checkout the 'artifacts/' tree into the output directory.
  const artifactsTreeSha = (await git.revparse([`${dataCommitSha}:artifacts`])).trim();
  const archivePath = path.join(outputDir, 'archive.tar');
  await git.raw(['archive', '--format=tar', artifactsTreeSha, '-o', archivePath]);
  await exec(`tar -xf ${archivePath} -C ${outputDir}`);
  await fs.unlink(archivePath);

  // 4. Verify the reconstructed tree hash against the snapshot hash from metadata.
  // To do this, we need to create a temporary git repo in the output directory.
  const tempGit: SimpleGit = simpleGit(outputDir);
  await tempGit.init();
  await tempGit.add('.');
  const tempCommit = await tempGit.commit('reconstructed');
  const reconstructedSnapshotHash = await computeSnapshotHash(outputDir, tempCommit.commit);

  return reconstructedSnapshotHash === metadata.snapshot_hash;
}

import { exec } from './utils';

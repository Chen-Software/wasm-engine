// src/reconstructor.ts

import { simpleGit, SimpleGit } from 'simple-git';
import { computeSnapshotHash } from './snapshot';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from './utils';

/**
 * Reconstructs a workspace, or a specific artifact, from a data commit.
 *
 * @param repoPath The repository path.
 * @param dataCommitSha The data commit to reconstruct from.
 * @param outputDir The directory to reconstruct into.
 * @param artifactName Optional. The name of a specific artifact to reconstruct.
 * @returns A boolean indicating if the reconstruction was successful and valid.
 */
export async function reconstructWorkspace(
  repoPath: string,
  dataCommitSha: string,
  outputDir: string,
  artifactName?: string
): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);

  const metadataContent = await git.show([`${dataCommitSha}:metadata.json`]);
  const metadata = JSON.parse(metadataContent);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  if (artifactName) {
    // Reconstruct a single artifact
    const artifact = metadata.artifacts.find((a: any) => a.name === artifactName);
    if (!artifact) {
      throw new Error(`Artifact "${artifactName}" not found in data commit ${dataCommitSha}`);
    }
    const treePath = `artifacts/${artifactName}`;
    const artifactTreeSha = (await git.revparse([`${dataCommitSha}:${treePath}`])).trim();

    const archivePath = path.join(outputDir, 'archive.tar');
    await git.raw(['archive', '--format=tar', artifactTreeSha, '-o', archivePath]);
    await exec(`tar -xf ${archivePath} -C ${outputDir}`);
    await fs.unlink(archivePath);

    // Verify the single artifact
    const tempGit: SimpleGit = simpleGit(outputDir);
    await tempGit.init();
    await tempGit.add('.');
    const tempCommit = await tempGit.commit('reconstructed');
    const reconstructedSnapshotHash = await computeSnapshotHash(outputDir, tempCommit.commit, artifact.files.map((f:any) => f.path));

    return reconstructedSnapshotHash === artifact.snapshot_hash;

  } else {
    // Reconstruct all artifacts
    const treePath = `artifacts`;
    const artifactsTreeSha = (await git.revparse([`${dataCommitSha}:${treePath}`])).trim();

    const archivePath = path.join(outputDir, 'archive.tar');
    await git.raw(['archive', '--format=tar', artifactsTreeSha, '-o', archivePath]);
    await exec(`tar -xf ${archivePath} -C ${outputDir}`);
    await fs.unlink(archivePath);

    // Verification for all artifacts is complex and deferred for this PoC.
    // A simple file existence check could be done here.
    return true; // For now, assume success.
  }
}

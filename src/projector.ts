// src/projector.ts

import { simpleGit, SimpleGit } from 'simple-git';
import { setDeterministicGitEnvironment } from './projection-env';
import { computeSnapshotHash } from './snapshot';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from './utils';

interface ProjectionMetadata {
  original_commit_sha: string;
  parent_data_commit_oid: string | null;
  source_parent_shas: string[];
  snapshot_hash: string;
  files: { path: string; blob_sha: string; mode: string; size: number }[];
}

export async function projectCommit(repoPath: string, sourceCommitSha: string): Promise<string> {
  setDeterministicGitEnvironment();
  const mainGit: SimpleGit = simpleGit(repoPath);
  const dataBranch = 'workspace/data';
  const parentDataCommitOid = await mainGit.revparse([dataBranch]).catch(() => null);

  if (parentDataCommitOid) {
    const metadataContent = await mainGit.show([`${parentDataCommitOid}:metadata/commit.json`]);
    const existingMetadata: ProjectionMetadata = JSON.parse(metadataContent);
    if (existingMetadata.original_commit_sha === sourceCommitSha) {
      return parentDataCommitOid;
    }
  }

  const snapshotHash = await computeSnapshotHash(repoPath, sourceCommitSha);
  const lsTreeOutput = await mainGit.raw(['ls-tree', '-r', '--long', sourceCommitSha]);
  const files = lsTreeOutput.trim().split('\n').map(line => {
    const [meta, path] = line.trim().split('\t');
    const [mode, _type, blob_sha, sizeStr] = meta.split(/\s+/);
    return {
      mode: mode,
      blob_sha: blob_sha,
      size: parseInt(sizeStr.trim(), 10),
      path: path,
    };
  });

  // Get all parent SHAs of the source commit
  const parentShasStr = await mainGit.raw(['show', '--no-patch', '--format=%P', sourceCommitSha]);
  const sourceParentShas = parentShasStr.trim().split(' ');

  const metadata: ProjectionMetadata = {
    original_commit_sha: sourceCommitSha,
    parent_data_commit_oid: parentDataCommitOid,
    source_parent_shas: sourceParentShas,
    snapshot_hash: snapshotHash,
    files: files,
  };

  // --- New Robust Tree Building Strategy ---
  const stagingRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-repo-'));
  try {
    const stagingGit = simpleGit(stagingRepoPath);
    await stagingGit.init();

    // 1. Create the artifacts directory and check out the source tree into it
    const artifactsDir = path.join(stagingRepoPath, 'artifacts');
    await fs.mkdir(artifactsDir);
    // Use git archive | tar to check out the tree without a .git directory
    const archivePath = path.join(artifactsDir, 'archive.tar');
    await mainGit.raw(['archive', '--format=tar', sourceCommitSha, '-o', archivePath]);
    await exec(`tar -xf ${archivePath} -C ${artifactsDir}`);
    await fs.unlink(archivePath);

    // 2. Create the metadata file
    const metadataDir = path.join(stagingRepoPath, 'metadata');
    await fs.mkdir(metadataDir);
    await fs.writeFile(path.join(metadataDir, 'commit.json'), JSON.stringify(metadata, null, 2));

    // 3. Commit the new tree in the staging repo
    await stagingGit.add('.');
    const stagingCommit = await stagingGit.commit('Build projection tree');
    const projectionTreeSha = (await stagingGit.revparse([`${stagingCommit.commit}^{tree}`])).trim();

    // 4. Fetch the staged objects into the main repository
    await mainGit.fetch(stagingRepoPath, 'HEAD');

    // 5. Create the final data commit in the main repo using the staged tree
    const commitMessage = `Projection of ${sourceCommitSha}`;
    const commitArgs = [projectionTreeSha];
    if (parentDataCommitOid) {
      commitArgs.push('-p', parentDataCommitOid);
    }
    commitArgs.push('-m', commitMessage);

    const newDataCommitSha = (await mainGit.raw(['commit-tree', ...commitArgs])).trim();

    // 5. Update the data branch ref
    await mainGit.raw(['update-ref', dataBranch, newDataCommitSha]);

    return newDataCommitSha;

  } finally {
    await fs.rm(stagingRepoPath, { recursive: true, force: true });
  }
}

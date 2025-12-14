// src/projector.ts

import { simpleGit, SimpleGit } from 'simple-git';
import { setDeterministicGitEnvironment } from './projection-env';
import { computeSnapshotHash } from './snapshot';
import { parseArtifactManifest } from './artifacts-parser';
import { readRegistry, updateRegistry, REGISTRY_PATH } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from './utils';
import * as yaml from 'js-yaml';

// Interfaces
interface ArtifactMetadata {
  name: string;
  original_commit_sha: string;
  snapshot_hash: string;
  files: { path: string; blob_sha: string; mode: string; size: number }[];
}

interface ProjectionMetadata {
  original_commit_sha: string;
  parent_data_commit_oid: string | null;
  source_parent_shas: string[];
  artifacts: ArtifactMetadata[];
}

export async function projectCommit(repoPath: string, sourceCommitSha: string): Promise<string> {
  setDeterministicGitEnvironment();
  const mainGit: SimpleGit = simpleGit(repoPath);
  const dataBranch = 'workspace/data';
  const parentDataCommitOid = await mainGit.revparse([dataBranch]).catch(() => null);

  if (parentDataCommitOid) {
    const metadataContent = await mainGit.show([`${parentDataCommitOid}:metadata.json`]);
    if (JSON.parse(metadataContent).original_commit_sha === sourceCommitSha) {
      return parentDataCommitOid;
    }
  }

  const stagingRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-repo-'));
  try {
    const stagingGit = simpleGit(stagingRepoPath);
    await stagingGit.init();

    // 1. Build artifacts and their metadata
    const manifest = await parseArtifactManifest(repoPath, sourceCommitSha);
    const artifactsToProject = manifest ? manifest.artifacts : [{ name: 'default', files: ['.'] }];
    const allArtifactsMetadata: ArtifactMetadata[] = [];

    for (const artifact of artifactsToProject) {
      const archivePath = path.join(stagingRepoPath, `${artifact.name}.tar`);
      await mainGit.raw(['archive', sourceCommitSha, ...artifact.files, '-o', archivePath]);
      const artifactDir = path.join(stagingRepoPath, 'artifacts', artifact.name);
      await fs.mkdir(artifactDir, { recursive: true });
      await exec(`tar -xf ${archivePath} -C ${artifactDir}`);
      await fs.unlink(archivePath);

      const snapshotHash = await computeSnapshotHash(repoPath, sourceCommitSha, artifact.files);
      const lsTreeOutput = await mainGit.raw(['ls-tree', '-r', '--long', sourceCommitSha, ...artifact.files]);
      const files = lsTreeOutput.trim().split('\n').map(line => {
        const [meta, path] = line.trim().split('\t');
        const [mode, _type, blob_sha, sizeStr] = meta.split(/\s+/);
        return { mode, blob_sha, size: parseInt(sizeStr.trim(), 10), path };
      });
      allArtifactsMetadata.push({ name: artifact.name, original_commit_sha: sourceCommitSha, snapshot_hash: snapshotHash, files });
    }

    // 2. Build the main metadata file
    const parentShasStr = await mainGit.raw(['show', '--no-patch', '--format=%P', sourceCommitSha]);
    const sourceParentShas = parentShasStr.trim().split(' ');
    const projectionMetadata: ProjectionMetadata = {
      original_commit_sha: sourceCommitSha,
      parent_data_commit_oid: parentDataCommitOid,
      source_parent_shas: sourceParentShas,
      artifacts: allArtifactsMetadata,
    };
    await fs.writeFile(path.join(stagingRepoPath, 'metadata.json'), JSON.stringify(projectionMetadata, null, 2));

    // 3. Prepare the registry for this commit
    let registryToStore: any = {};
    if (parentDataCommitOid) {
      const parentRegistry = await readRegistry(mainGit, parentDataCommitOid);
      const parentMetadataContent = await mainGit.show([`${parentDataCommitOid}:metadata.json`]);
      const parentMetadata = JSON.parse(parentMetadataContent);
      const parentArtifactNames = parentMetadata.artifacts.map((a: any) => a.name);
      registryToStore = updateRegistry(parentRegistry, parentArtifactNames, parentDataCommitOid);
    }

    const registryDir = path.join(stagingRepoPath, path.dirname(REGISTRY_PATH));
    await fs.mkdir(registryDir, { recursive: true });
    await fs.writeFile(path.join(stagingRepoPath, REGISTRY_PATH), yaml.dump(registryToStore));

    // 4. Create the commit in the staging repo
    await stagingGit.add('.');
    const stagingCommit = await stagingGit.commit('Build projection tree');
    const projectionTreeSha = (await stagingGit.revparse([`${stagingCommit.commit}^{tree}`])).trim();

    // 5. Create the definitive data commit in the main repo
    await mainGit.fetch(stagingRepoPath, 'HEAD');
    const commitMessage = `Projection of ${sourceCommitSha}`;
    const commitArgs = [projectionTreeSha, '-m', commitMessage];
    if (parentDataCommitOid) {
      commitArgs.push('-p', parentDataCommitOid);
    }
    const newDataCommitSha = (await mainGit.raw(['commit-tree', ...commitArgs])).trim();

    // 6. Update the data branch ref
    await mainGit.raw(['update-ref', dataBranch, newDataCommitSha]);

    return newDataCommitSha;
  } finally {
    await fs.rm(stagingRepoPath, { recursive: true, force: true });
  }
}

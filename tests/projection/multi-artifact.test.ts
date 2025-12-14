import { TestRepoBuilder } from '../harness/test-repo-builder';
import { projectCommit } from '../../src/projector';
import { readRegistry, REGISTRY_PATH } from '../../src/registry';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

describe('Multi-Artifact Projection', () => {
  let tmpDir: string;
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-artifact-test-'));
    repoBuilder = await TestRepoBuilder.create(tmpDir, 'repo');
    git = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should project multiple artifacts defined in a manifest', async () => {
    // 1. Create files and manifest
    await repoBuilder.commit('Initial files', {
      'docs/a.md': 'doc a',
      'src/b.js': 'code b',
      'config/c.json': 'config c',
    });
    await repoBuilder.createArtifactManifest({
      artifacts: [
        { name: 'documentation', files: ['docs/'] },
        { name: 'source-code', files: ['src/'] },
      ],
    });
    const sourceCommit = await repoBuilder.commit('Add manifest', {});

    // 2. Project the commit
    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    // 3. Verify artifact structure
    const artifactsLs = await git.raw(['ls-tree', `${dataCommit}:artifacts`]);
    expect(artifactsLs).toContain('documentation');
    expect(artifactsLs).toContain('source-code');
    expect(artifactsLs).not.toContain('config'); // 'config' was not in the manifest

    // 4. Verify metadata
    const metadataContent = await git.show([`${dataCommit}:metadata.json`]);
    const metadata = JSON.parse(metadataContent);
    expect(metadata.artifacts).toHaveLength(2);
    expect(metadata.artifacts[0].name).toEqual('documentation');
  });

  it('should update the registry correctly over several commits', async () => {
    // Commit 1: Introduce doc artifact
    await repoBuilder.commit('files', { 'docs/a.md': 'a' });
    await repoBuilder.createArtifactManifest({ artifacts: [{ name: 'docs', files: ['docs/'] }] });
    const source1 = await repoBuilder.commit('manifest v1', {});
    const data1 = await projectCommit(repoBuilder.repoPath, source1);

    // The registry in the first commit should be empty (it's the parent's registry)
    const registry1 = await readRegistry(git, data1);
    expect(Object.keys(registry1).length).toBe(0);

    // Commit 2: Introduce code artifact
    await repoBuilder.commit('more files', { 'src/b.js': 'b' });
    await repoBuilder.createArtifactManifest({
      artifacts: [{ name: 'code', files: ['src/'] }]
    });
    const source2 = await repoBuilder.commit('manifest v2', {});
    const data2 = await projectCommit(repoBuilder.repoPath, source2);

    // The registry in the second commit should reflect the first commit's artifacts
    const registry2 = await readRegistry(git, data2);
    expect(registry2['docs'].latest).toEqual(data1);
    expect(registry2['code']).toBeUndefined();
    expect(registry2['docs'].history).toEqual([data1]);
  });
});

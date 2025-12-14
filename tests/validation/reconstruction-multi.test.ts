import { TestRepoBuilder } from '../harness/test-repo-builder';
import { projectCommit } from '../../src/projector';
import { reconstructWorkspace } from '../../src/reconstructor';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Multi-Artifact Reconstruction', () => {
  let tmpDir: string;
  let repoBuilder: TestRepoBuilder;
  let outputDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reconstruction-multi-test-'));
    repoBuilder = await TestRepoBuilder.create(tmpDir, 'repo');
    outputDir = path.join(tmpDir, 'output');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should reconstruct a single artifact correctly', async () => {
    // 1. Create a multi-artifact commit
    await repoBuilder.commit('files', {
      'docs/a.md': 'doc a',
      'src/b.js': 'code b',
    });
    await repoBuilder.createArtifactManifest({
      artifacts: [
        { name: 'documentation', files: ['docs/'] },
        { name: 'source-code', files: ['src/'] },
      ],
    });
    const sourceCommit = await repoBuilder.commit('Add manifest', {});
    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    // 2. Reconstruct only the 'documentation' artifact
    const isValid = await reconstructWorkspace(
      repoBuilder.repoPath,
      dataCommit,
      outputDir,
      'documentation'
    );

    // 3. Verify
    expect(isValid).toBe(true);

    const docFile = await fs.readFile(path.join(outputDir, 'docs/a.md'), 'utf-8');
    expect(docFile).toEqual('doc a');

    // Check that the other artifact was NOT reconstructed
    const sourceCodeFileExists = await fs.access(path.join(outputDir, 'src/b.js')).then(() => true).catch(() => false);
    expect(sourceCodeFileExists).toBe(false);
  });
});

import { TestRepoBuilder } from '../harness/test-repo-builder';
import { projectCommit } from '../../src/projector';
import { reconstructWorkspace } from '../../src/reconstructor';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { computeSnapshotHash } from '../../src/snapshot';

describe('Basic Reconstruction', () => {
  let tmpDir: string;
  let repoBuilder: TestRepoBuilder;
  let outputDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reconstruction-test-'));
    repoBuilder = await TestRepoBuilder.create(tmpDir, 'repo');
    outputDir = path.join(tmpDir, 'output');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should reconstruct a workspace that matches the original source tree', async () => {
    // ... (commit creation remains the same)
    const sourceCommit = await repoBuilder.commit('Complex structure', {
      'file.txt': 'root',
      'a/b/c.txt': 'deep',
    });
    await fs.chmod(path.join(repoBuilder.repoPath, 'file.txt'), '755');
    await repoBuilder.git.add('file.txt');
    const finalSourceCommit = await repoBuilder.commit('Executable file', {});

    const dataCommit = await projectCommit(repoBuilder.repoPath, finalSourceCommit);

    // Reconstruct the 'default' artifact
    const isValid = await reconstructWorkspace(repoBuilder.repoPath, dataCommit, outputDir, 'default');
    expect(isValid).toBe(true);

    const rootFile = await fs.readFile(path.join(outputDir, 'file.txt'), 'utf-8');
    expect(rootFile).toEqual('root');

    const stats = await fs.stat(path.join(outputDir, 'file.txt'));
    expect(stats.mode & fs.constants.S_IXUSR).toBeTruthy();
  });

  it('should return true for a valid reconstruction', async () => {
    const sourceCommit = await repoBuilder.commit('Simple commit', { 'file.txt': 'content' });
    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    const isValid = await reconstructWorkspace(repoBuilder.repoPath, dataCommit, outputDir, 'default');
    expect(isValid).toBe(true);
  });
});

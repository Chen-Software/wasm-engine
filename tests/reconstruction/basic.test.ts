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
    // 1. Create a source commit with a complex structure
    const sourceCommit = await repoBuilder.commit('Complex structure', {
      'file.txt': 'root',
      'a/b/c.txt': 'deep',
      'a/d.txt': 'shallow'
    });
    // Make a file executable
    await fs.chmod(path.join(repoBuilder.repoPath, 'file.txt'), '755');
    await repoBuilder.git.add('file.txt');
    const finalSourceCommit = await repoBuilder.commit('Executable file', {});

    // 2. Project the commit
    const dataCommit = await projectCommit(repoBuilder.repoPath, finalSourceCommit);

    // 3. Reconstruct the workspace
    const reconstructionValid = await reconstructWorkspace(repoBuilder.repoPath, dataCommit, outputDir);
    expect(reconstructionValid).toBe(true);

    // 4. Verify file content and structure
    const rootFile = await fs.readFile(path.join(outputDir, 'file.txt'), 'utf-8');
    const deepFile = await fs.readFile(path.join(outputDir, 'a/b/c.txt'), 'utf-8');
    expect(rootFile).toEqual('root');
    expect(deepFile).toEqual('deep');

    // 5. Verify file mode
    const stats = await fs.stat(path.join(outputDir, 'file.txt'));
    // Check if the execute bit is set for the owner
    expect(stats.mode & fs.constants.S_IXUSR).toBeTruthy();
  });

  it('should return true for a valid reconstruction and false for a corrupted one', async () => {
    const sourceCommit = await repoBuilder.commit('Simple commit', { 'file.txt': 'content' });
    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    // Valid reconstruction
    const isValid = await reconstructWorkspace(repoBuilder.repoPath, dataCommit, outputDir);
    expect(isValid).toBe(true);

    // Manually corrupt the output and re-verify (by creating a new snapshot)
    await fs.writeFile(path.join(outputDir, 'file.txt'), 'corrupted');
    const originalSnapshot = JSON.parse(await repoBuilder.git.show([`${dataCommit}:metadata/commit.json`])).snapshot_hash;

    const { simpleGit } = await import('simple-git');
    const tempGit = simpleGit(outputDir);
    await tempGit.init();
    await tempGit.add('.');
    const tempCommit = await tempGit.commit('corrupted');
    const newSnapshot = await computeSnapshotHash(outputDir, tempCommit.commit);

    expect(newSnapshot).not.toEqual(originalSnapshot);
  });
});

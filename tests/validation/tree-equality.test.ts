import { TestRepoBuilder } from '../harness/test-repo-builder';
import { projectCommit } from '../../src/projector';
import { validateTreeHash } from '../../src/validator';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Tree Hash Validation', () => {
  let tmpDir: string;
  let repoBuilder: TestRepoBuilder;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validation-test-'));
    repoBuilder = await TestRepoBuilder.create(tmpDir, 'repo');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return true for a valid projection', async () => {
    const sourceCommit = await repoBuilder.commit('Valid commit', { 'file.txt': 'content' });
    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    const isValid = await validateTreeHash(repoBuilder.repoPath, dataCommit);
    expect(isValid).toBe(true);
  });

  it('should preserve nested directories correctly', async () => {
    const sourceCommit = await repoBuilder.commit('Nested directories', {
      'a/b/c.txt': 'deep file',
      'a/d.txt': 'shallow file',
    });
    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    const isValid = await validateTreeHash(repoBuilder.repoPath, dataCommit);
    expect(isValid).toBe(true);
  });

  it('should preserve file modes correctly (e.g., executable files)', async () => {
    await repoBuilder.commit('Add script', { 'run.sh': '#!/bin/bash\necho "run"' });
    // Make the script executable
    await fs.chmod(path.join(repoBuilder.repoPath, 'run.sh'), '755');
    await repoBuilder.git.add('run.sh');
    const sourceCommit = await repoBuilder.commit('Make script executable', {});

    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    const isValid = await validateTreeHash(repoBuilder.repoPath, dataCommit);
    expect(isValid).toBe(true);
  });
});

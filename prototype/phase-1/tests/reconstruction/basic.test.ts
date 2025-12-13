import { simpleGit, SimpleGit } from 'simple-git';
import { project } from '../../src/projector';
import { reconstruct } from '../../src/reconstructor';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { promises as fs } from 'fs';
import path from 'path';
import { calculateSnapshotHash } from '../../src/snapshot';

describe('Basic Reconstruction', () => {
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('should reconstruct a simple project', async () => {
    const sourceCommit = await repoBuilder.commitFiles(
      { 'a.txt': '1', 'nested/b.txt': '2' },
      'Commit 1',
    );
    const dataCommit = await project(sourceCommit, repoBuilder.repoPath);

    const outputDir = '/tmp/reconstructed-project';
    await reconstruct(git, dataCommit, outputDir);

    const fileA = await fs.readFile(path.join(outputDir, 'a.txt'), 'utf8');
    const fileB = await fs.readFile(path.join(outputDir, 'nested/b.txt'), 'utf8');

    expect(fileA).toBe('1');
    expect(fileB).toBe('2');

    // Verify the tree hash
    const tempGit = simpleGit(outputDir);
    await tempGit.init();
    await tempGit.add('.');
    const reconstructedTreeSha = await tempGit.raw('write-tree');

    const sourceTreeSha = await git.revparse([`${sourceCommit}^{tree}`]);
    expect(reconstructedTreeSha.trim()).toBe(sourceTreeSha);

    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it('should preserve executable file modes', async () => {
    await repoBuilder.commitFiles({ 'script.sh': '#!/bin/bash\necho "hello"' }, 'Commit 1');
    await fs.chmod(path.join(repoBuilder.repoPath, 'script.sh'), '755');
    await git.add('script.sh');
    const sourceCommit = await git.commit('Executable file').then(r => r.commit);

    const dataCommit = await project(sourceCommit, repoBuilder.repoPath);

    const outputDir = '/tmp/reconstructed-exec';
    await reconstruct(git, dataCommit, outputDir);

    const stats = await fs.stat(path.join(outputDir, 'script.sh'));
    // Check if the execute bit is set for the user.
    expect(stats.mode & 0o100).toBe(0o100);

    await fs.rm(outputDir, { recursive: true, force: true });
  });
});

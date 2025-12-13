import { getGit } from '../../src/projection-env';
import { project } from '../../src/projector';
import { reconstruct } from '../../src/reconstructor';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';

describe('Step 6: Basic Reconstruction', () => {
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = getGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('P1: reconstructs a simple project with nested files', async () => {
    const files = {
      'file.txt': 'hello',
      'a/b/c.txt': 'nested',
    };
    const sourceCommit = await repoBuilder.commit('Commit 1', files);
    const dataCommitSha = await project(git, sourceCommit);

    const outputDir = '/tmp/reconstructed-test';
    await reconstruct(git, dataCommitSha, outputDir);

    // Verify file content
    const content1 = await fs.readFile(path.join(outputDir, 'file.txt'), 'utf-8');
    const content2 = await fs.readFile(path.join(outputDir, 'a/b/c.txt'), 'utf-8');
    expect(content1).toBe('hello');
    expect(content2).toBe('nested');

    // Verify tree hash for perfect reconstruction
    const tempGit = getGit(outputDir);
    await tempGit.init();
    await tempGit.add('.');
    const reconstructedTreeSha = (await tempGit.raw(['write-tree'])).trim();

    const sourceTreeSha = await git.revparse([`${sourceCommit}^{tree}`]);
    expect(reconstructedTreeSha).toBe(sourceTreeSha);

    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it('P1: preserves executable file modes during reconstruction', async () => {
    await repoBuilder.commit('base', { 'script.sh': '#!/bin/sh' });
    await fs.chmod(path.join(repoBuilder.repoPath, 'script.sh'), '755');
    await repoBuilder.git.add('script.sh');
    const sourceCommit = await repoBuilder.git.commit('Make executable');

    const dataCommitSha = await project(git, sourceCommit.commit);

    const outputDir = '/tmp/reconstructed-exec-test';
    await reconstruct(git, dataCommitSha, outputDir);

    const stats = await fs.stat(path.join(outputDir, 'script.sh'));
    // Check if the execute bit is set (user, group, or other)
    expect(stats.mode & 0o111).toBe(0o111);

    await fs.rm(outputDir, { recursive: true, force: true });
  });
});

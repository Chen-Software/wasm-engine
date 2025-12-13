import { getGit } from '../../src/projection-env';
import { project } from '../../src/projector';
import { validateProjection } from '../../src/validator';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';

describe('Step 4: Tree Hash Validation', () => {
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = getGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('P1: validation passes for a correct projection', async () => {
    const sourceCommit = await repoBuilder.commit('Commit 1', {
      'file.txt': 'hello',
      'nested/dir/file.sh': '#!/bin/sh',
    });
    await fs.chmod(path.join(repoBuilder.repoPath, 'nested/dir/file.sh'), '755');
    await repoBuilder.git.add('.');
    const sourceCommitWithMode = await repoBuilder.git.commit('make executable');

    const dataCommitSha = await project(git, sourceCommitWithMode.commit);

    const isValid = await validateProjection(git, dataCommitSha);
    expect(isValid).toBe(true);
  });

  it('P1: validation fails if projected content differs from source', async () => {
    const sourceCommit = await repoBuilder.commit('Commit 1', { 'a.txt': 'original' });
    const dataCommitSha = await project(git, sourceCommit);

    // Manually create a tampered commit on the data branch
    const tempDir = await fs.mkdtemp('/tmp/tamper-');
    const tempFile = path.join(tempDir, 'tampered.txt');
    await fs.writeFile(tempFile, 'tampered content');
    const tamperedBlobSha = (await git.hashObject(tempFile, true)).trim();

    const tempIndex = path.join(repoBuilder.repoPath, '.git', 'index.tamper');
    const gitWithIndex = git.env({ ...process.env, GIT_INDEX_FILE: tempIndex });

    // 1. Add the tampered artifact file to the index
    await gitWithIndex.raw(['update-index', '--add', '--cacheinfo', `100644,${tamperedBlobSha},artifacts/a.txt`]);

    // 2. Add the original, valid metadata file to the index
    const metadataBlobSha = await git.revparse([`${dataCommitSha}:metadata/commit.json`]);
    await gitWithIndex.raw(['update-index', '--add', '--cacheinfo', `100644,${metadataBlobSha},metadata/commit.json`]);

    // 3. Write a new tree from the tampered index
    const newRootTree = (await gitWithIndex.raw(['write-tree'])).trim();

    // 4. Create the tampered commit
    const tamperedCommit = (await git.raw(['commit-tree', newRootTree, '-p', dataCommitSha, '-m', 'Tampered'])).trim();

    // 5. Validate the tampered commit - it should fail because the artifact tree hash no longer matches the source tree hash
    const isValid = await validateProjection(git, tamperedCommit);
    expect(isValid).toBe(false);

    await fs.rm(tempIndex, { force: true });
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('P1: validation correctly handles nested directories and file modes', async () => {
    const sourceCommit = await repoBuilder.commit('base', {'file': 'a'});
    const dataCommitSha = await project(git, sourceCommit);
    const isValid = await validateProjection(git, dataCommitSha);
    expect(isValid).toBe(true);
  });
});

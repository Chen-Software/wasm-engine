import { simpleGit, SimpleGit } from 'simple-git';
import { project } from '../../src/projector';
import { validateTreeHash } from '../../src/validator';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { promises as fs } from 'fs';
import path from 'path';

describe('Tree Hash Validation', () => {
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('should pass for a valid projection', async () => {
    const sourceCommit = await repoBuilder.commitFiles(
      { 'a.txt': '1', 'nested/b.txt': '2' },
      'Commit 1',
    );
    const dataCommit = await project(sourceCommit, repoBuilder.repoPath);

    const isValid = await validateTreeHash(git, dataCommit);
    expect(isValid).toBe(true);
  });

  it('should fail if a file is manually modified', async () => {
    const sourceCommit = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const dataCommit = await project(sourceCommit, repoBuilder.repoPath);

    // Switch to the data branch and tamper with a file
    await git.checkout('workspace/data');
    const tamperedFilePath = path.join(repoBuilder.repoPath, 'artifacts', 'a.txt');
    await fs.writeFile(tamperedFilePath, 'tampered content');
    await git.add(tamperedFilePath);
    const tamperedCommit = await git.commit('Tampered commit');

    const isValid = await validateTreeHash(git, tamperedCommit.commit);
    expect(isValid).toBe(false);
  });

  it('should preserve executable file modes', async () => {
    await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    await fs.chmod(path.join(repoBuilder.repoPath, 'a.txt'), '755');
    await git.add('a.txt');
    const sourceCommit = await git.commit('Executable file');

    const dataCommit = await project(sourceCommit.commit, repoBuilder.repoPath);
    const isValid = await validateTreeHash(git, dataCommit);
    expect(isValid).toBe(true);
  });
});

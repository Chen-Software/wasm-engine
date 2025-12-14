import { TestRepoBuilder } from '../harness/test-repo-builder';
import { setDeterministicGitEnvironment } from '../../src/projection-env';
import { simpleGit } from 'simple-git';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Deterministic Environment', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projection-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const createRepoAndCommit = async (repoName: string): Promise<{ builder: TestRepoBuilder, commitSha: string }> => {
    const builder = await TestRepoBuilder.create(tmpDir, repoName);
    setDeterministicGitEnvironment();
    const commitSha = await builder.commit('commit', { 'file.txt': 'content' });
    return { builder, commitSha };
  };

  it('should produce identical commit SHAs for identical commits', async () => {
    const { commitSha: commitSha1 } = await createRepoAndCommit('repo1');
    const { commitSha: commitSha2 } = await createRepoAndCommit('repo2');
    expect(commitSha1).toEqual(commitSha2);
  });

  it('should ignore polluted user git config variables', async () => {
    process.env.GIT_AUTHOR_NAME = 'User';
    process.env.GIT_AUTHOR_EMAIL = 'user@example.com';
    process.env.GIT_AUTHOR_DATE = '2024-01-01T10:00:00Z';

    const { builder, commitSha } = await createRepoAndCommit('repo-polluted');

    const git = simpleGit(builder.repoPath);
    const showResult = await git.show(['--format=fuller', '-s', commitSha]);

    expect(showResult).toContain('Author:     projection-bot <projection@localhost>');
    expect(showResult).not.toContain('User');
  });

  it('should use a fixed timestamp and identity in the commit object', async () => {
    const { builder, commitSha } = await createRepoAndCommit('repo-fixed');

    const git = simpleGit(builder.repoPath);
    const showResult = await git.show(['--format=fuller', '-s', commitSha]);

    expect(showResult).toContain('Author:     projection-bot <projection@localhost>');
    expect(showResult).toContain('AuthorDate: Thu Jan 1 00:00:00 1970 +0000');
    expect(showResult).toContain('Commit:     projection-bot <projection@localhost>');
    expect(showResult).toContain('CommitDate: Thu Jan 1 00:00:00 1970 +0000');
  });
});

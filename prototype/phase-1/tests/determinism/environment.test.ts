import { getGit } from '../../src/projection-env';
import { TestRepoBuilder } from '../harness/test-repo-builder';

// A temporary function that creates a single, simple commit using the projection environment.
async function createTestCommit(repoPath: string): Promise<string> {
  const git = getGit(repoPath);

  // Create an empty tree to commit
  const treeSha = await git.raw(['write-tree']);

  const commitSha = await git.raw([
    'commit-tree',
    treeSha.trim(),
    '-m',
    'Test commit',
  ]);

  return commitSha.trim();
}

describe('Step 1: Deterministic Environment Setup', () => {
  let repoBuilder: TestRepoBuilder;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('should produce an identical commit SHA when run twice', async () => {
    const sha1 = await createTestCommit(repoBuilder.repoPath);
    const sha2 = await createTestCommit(repoBuilder.repoPath);
    expect(sha1).toBe(sha2);
    expect(sha1).toBeTruthy();
  });

  it('should ignore polluted user git config variables', async () => {
    // Pollute the environment before running the test commit function.
    process.env.GIT_AUTHOR_NAME = 'A. N. Other';
    process.env.GIT_AUTHOR_EMAIL = 'another@example.com';
    process.env.GIT_AUTHOR_DATE = new Date().toISOString();

    const commitSha = await createTestCommit(repoBuilder.repoPath);

    // Clean up pollution
    delete process.env.GIT_AUTHOR_NAME;
    delete process.env.GIT_AUTHOR_EMAIL;
    delete process.env.GIT_AUTHOR_DATE;

    // Use a non-deterministic git instance to inspect the commit
    const inspectionGit = repoBuilder.git;
    const commitLog = await inspectionGit.show(['-s', '--format=%an <%ae> at %ad', commitSha]);

    // Verify that the commit was created with the fixed, deterministic identity and date.
    expect(commitLog).toContain('projection-bot <projection@localhost>');
    expect(commitLog).toContain('Thu Jan 1 00:00:00 1970 +0000');
    expect(commitLog).not.toContain('A. N. Other');
  });
});

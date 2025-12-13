import { getDeterministicGit } from '../../src/projection-env';
import { TestRepoBuilder } from '../harness/test-repo-builder';

// A temporary projector function for testing the deterministic environment.
// This will be replaced by the real projector in a later step.
async function tempProject(repoPath: string, sourceCommit: string): Promise<string> {
  const git = getDeterministicGit(repoPath);

  const sourceTree = await git.revparse([`${sourceCommit}^{tree}`]);
  const commitMessage = `Projection of ${sourceCommit}`;

  // Use plumbing commands to create the commit in a deterministic way.
  const treeSha = await git.raw('write-tree');
  const commitSha = await git.raw('commit-tree', sourceTree, '-m', commitMessage);

  return commitSha.trim();
}

describe('Deterministic Environment', () => {
  let repoBuilder: TestRepoBuilder;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('should produce the same commit SHA for the same input', async () => {
    const sourceCommit = await repoBuilder.commitFiles({ 'file.txt': 'hello' }, 'Initial commit');

    const sha1 = await tempProject(repoBuilder.repoPath, sourceCommit);
    const sha2 = await tempProject(repoBuilder.repoPath, sourceCommit);

    expect(sha1).toBe(sha2);
  });

  it('should ignore user git config', async () => {
    const sourceCommit = await repoBuilder.commitFiles({ 'file.txt': 'hello' }, 'Initial commit');

    // Pollute the environment with a different user config.
    process.env.GIT_AUTHOR_NAME = 'Different User';
    process.env.GIT_AUTHOR_EMAIL = 'different@example.com';

    const sha = await tempProject(repoBuilder.repoPath, sourceCommit);

    // Clean up the environment variables.
    delete process.env.GIT_AUTHOR_NAME;
    delete process.env.GIT_AUTHOR_EMAIL;

    const git = getDeterministicGit(repoBuilder.repoPath);
    const commit = await git.catFile(['-p', sha]);

    // Verify that the commit was created with the deterministic identity.
    expect(commit).toContain('projection-bot <projection@localhost>');
    expect(commit).not.toContain('Different User');
  });
});

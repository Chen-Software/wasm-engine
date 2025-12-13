import { simpleGit, SimpleGit } from 'simple-git';
import { project } from '../../src/projector';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { getDeterministicGit } from '../../src/projection-env';
import { validateTreeHash } from '../../src/validator';

describe('Merge Commit Projection', () => {
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('should project a merge commit correctly', async () => {
    // 1. Create a base commit
    const baseCommit = await repoBuilder.commitFiles({ 'base.txt': 'base' }, 'Base');

    // 2. Create two branches
    await git.checkout(['-b', 'branch-a', baseCommit]);
    const commitA = await repoBuilder.commitFiles({ 'a.txt': 'a' }, 'Commit A');

    await git.checkout(['-b', 'branch-b', baseCommit]);
    const commitB = await repoBuilder.commitFiles({ 'b.txt': 'b' }, 'Commit B');

    // 3. Merge branch-b into branch-a
    await git.checkout('branch-a');
    await git.merge(['branch-b']);
    const mergeCommit = await git.revparse(['HEAD']);

    // 4. Project the merge commit
    // First, project the linear history
    await project(baseCommit, repoBuilder.repoPath);
    await project(commitA, repoBuilder.repoPath);
    await project(commitB, repoBuilder.repoPath);
    // Now, project the merge commit
    const dataCommit = await project(mergeCommit, repoBuilder.repoPath);

    // 5. Verify the projection
    const isValid = await validateTreeHash(git, dataCommit);
    expect(isValid).toBe(true);

    const metadataJson = await git.show([`${dataCommit}:metadata/commit.json`]);
    const metadata = JSON.parse(metadataJson);

    expect(metadata.original_commit_sha).toBe(mergeCommit);
    expect(metadata.source_parent_shas).toHaveLength(2);
    expect(metadata.source_parent_shas).toContain(commitA);
    expect(metadata.source_parent_shas).toContain(commitB);
  });
});

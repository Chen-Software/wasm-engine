import { getGit } from '../../src/projection-env';
import { project } from '../../src/projector';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { SimpleGit } from 'simple-git';
import { validateProjection } from '../../src/validator';

describe('Step 5: Merge Commit Projection', () => {
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = repoBuilder.git;
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('P4: correctly projects a merge commit and records both source parents', async () => {
    // 1. Create a base commit and project it
    const baseCommit = await repoBuilder.commit('Base', { 'base.txt': 'base' });
    const dataBaseCommit = await project(git, baseCommit);

    // 2. Create two diverging branches
    await git.checkout(['-b', 'branch-a', baseCommit]);
    const commitA = await repoBuilder.commit('Commit A', { 'a.txt': 'a' });

    await git.checkout(['-b', 'branch-b', baseCommit]);
    const commitB = await repoBuilder.commit('Commit B', { 'b.txt': 'b' });

    // 3. Project the linear commits
    const dataCommitA = await project(git, commitA);
    await git.checkout('branch-b'); // Switch context for the next projection
    const dataCommitB = await project(git, commitB);

    // 4. Merge branch-b into branch-a to create a merge commit
    await git.checkout('branch-a');
    await git.merge(['branch-b']);
    const mergeCommitSha = await git.revparse(['HEAD']);

    // The parent for the merge projection should be the last projected commit from the current branch (branch-a)
    expect(dataCommitA).not.toBe(dataCommitB); // Ensure they are different commits

    // 5. Project the merge commit
    const dataMergeCommit = await project(git, mergeCommitSha);

    // 6. Verification
    // The data branch history should still be linear
    const dataGit = getGit(repoBuilder.repoPath);
    const parentOfMerge = (await dataGit.show(['-s', '--format=%P', dataMergeCommit])).trim();
    expect(parentOfMerge).toBe(dataCommitA); // Parent is the projection of the last commit on branch-a

    // The content must be a valid projection of the resolved merge state
    const isValid = await validateProjection(dataGit, dataMergeCommit);
    expect(isValid).toBe(true);

    // The metadata must record both source parents of the merge
    const metadataJson = await dataGit.show([`${dataMergeCommit}:metadata/commit.json`]);
    const metadata = JSON.parse(metadataJson);
    expect(metadata.original_commit_sha).toBe(mergeCommitSha);
    expect(metadata.source_parent_shas).toHaveLength(2);
    expect(metadata.source_parent_shas).toContain(commitA);
    expect(metadata.source_parent_shas).toContain(commitB);
  });
});

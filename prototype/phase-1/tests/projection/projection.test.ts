import { simpleGit, SimpleGit } from 'simple-git';
import { project } from '../../src/projector';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { getDeterministicGit } from '../../src/projection-env';

describe('Basic Projection', () => {
  let repoBuilder: TestRepoBuilder;
  let sourceGit: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    sourceGit = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('should create a data branch with the first projection', async () => {
    const sourceCommit = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const dataCommit = await project(sourceCommit, repoBuilder.repoPath);

    const dataGit = getDeterministicGit(repoBuilder.repoPath);
    const log = await dataGit.log({ 'workspace/data': null });

    expect(log.latest?.hash).toBe(dataCommit);
    expect(log.latest?.message).toContain(sourceCommit);
  });

  it('should maintain a linear history on the data branch', async () => {
    const commit1 = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const dataCommit1 = await project(commit1, repoBuilder.repoPath);

    const commit2 = await repoBuilder.commitFiles({ 'b.txt': '2' }, 'Commit 2');
    const dataCommit2 = await project(commit2, repoBuilder.repoPath);

    const dataGit = getDeterministicGit(repoBuilder.repoPath);
    const commitInfo = await dataGit.show(['-s', '--format=%P', dataCommit2]);
    const parents = commitInfo.trim().split(' ');

    expect(parents).toContain(dataCommit1);
  });

  it('should be idempotent', async () => {
    const sourceCommit = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const dataCommit1 = await project(sourceCommit, repoBuilder.repoPath);
    const dataCommit2 = await project(sourceCommit, repoBuilder.repoPath);

    expect(dataCommit1).toBe(dataCommit2);
  });

  it('should produce a deterministic commit SHA', async () => {
    const sourceCommit = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const sha1 = await project(sourceCommit, repoBuilder.repoPath);

    // Re-create the data branch from scratch to ensure no history dependence.
    const dataGit = getDeterministicGit(repoBuilder.repoPath);
    await dataGit.branch(['-D', 'workspace/data']);

    const sha2 = await project(sourceCommit, repoBuilder.repoPath);

    expect(sha1).toBe(sha2);
  });
});

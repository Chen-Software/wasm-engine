import { getGit } from '../../src/projection-env';
import { project } from '../../src/projector';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { SimpleGit } from 'simple-git';

describe('Step 3 & 5: Basic Projection Logic', () => {
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = repoBuilder.git;
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('P0: creates a data branch and the first projection has no parent', async () => {
    const sourceCommit = await repoBuilder.commit('Commit 1', { 'a.txt': '1' });
    const dataCommitSha = await project(git, sourceCommit);

    const dataGit = getGit(repoBuilder.repoPath);
    const log = await dataGit.log({ 'workspace/data': null });

    expect(log.latest?.hash).toBe(dataCommitSha);

    // The first commit should have no parents
    const commitInfo = await dataGit.show(['-s', '--format=%P', dataCommitSha]);
    expect(commitInfo.trim()).toBe('');
  });

  it('P0: maintains a linear parent chain on the data branch', async () => {
    const commit1 = await repoBuilder.commit('Commit 1', { 'a.txt': '1' });
    const dataCommit1 = await project(git, commit1);

    const commit2 = await repoBuilder.commit('Commit 2', { 'b.txt': '2' });
    const dataCommit2 = await project(git, commit2);

    const dataGit = getGit(repoBuilder.repoPath);
    const commitInfo = await dataGit.show(['-s', '--format=%P', dataCommit2]);

    expect(commitInfo.trim()).toBe(dataCommit1);
  });

  it('P3 & P2: is idempotent and does not create duplicate commits', async () => {
    const sourceCommit = await repoBuilder.commit('Commit 1', { 'a.txt': '1' });
    const dataCommit1 = await project(git, sourceCommit);
    const dataCommit2 = await project(git, sourceCommit);

    expect(dataCommit1).toBe(dataCommit2);

    const dataGit = getGit(repoBuilder.repoPath);
    const log = await dataGit.log({ 'workspace/data': null });
    expect(log.total).toBe(1);
  });

  it('P2: produces a deterministic and bit-for-bit reproducible commit SHA', async () => {
    const sourceCommit = await repoBuilder.commit('Commit 1', { 'a.txt': '1' });
    const sha1 = await project(git, sourceCommit);

    // Delete the data branch and re-project to prove no history dependence
    const dataGit = getGit(repoBuilder.repoPath);
    await dataGit.branch(['-D', 'workspace/data']);

    const sha2 = await project(git, sourceCommit);

    expect(sha1).toBe(sha2);
  });

  it('metadata file correctly records all required fields', async () => {
    const sourceCommit = await repoBuilder.commit('Commit 1', { 'a.txt': 'hello' });
    const dataCommitSha = await project(git, sourceCommit);

    const dataGit = getGit(repoBuilder.repoPath);
    const metadataJson = await dataGit.show([`${dataCommitSha}:metadata/commit.json`]);
    const metadata = JSON.parse(metadataJson);

    expect(metadata.original_commit_sha).toBe(sourceCommit);
    expect(metadata.parent_data_commit_oid).toBeNull();
    expect(metadata.snapshot_hash).toBeDefined();
    expect(metadata.files).toHaveLength(1);
    expect(metadata.files[0].path).toBe('a.txt');
    expect(metadata.files[0].mode).toBe('100644');
  });
});

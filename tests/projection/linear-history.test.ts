import { TestRepoBuilder } from '../harness/test-repo-builder';
import { projectCommit } from '../../src/projector';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

describe('Basic Projection (Linear History)', () => {
  let tmpDir: string;
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;
  const dataBranch = 'workspace/data';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projection-linear-test-'));
    repoBuilder = await TestRepoBuilder.create(tmpDir, 'repo');
    git = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should create a data commit for the first commit in a repo', async () => {
    const sourceCommitSha = await repoBuilder.commit('Initial commit', { 'a.txt': '1' });
    const dataCommitSha = await projectCommit(repoBuilder.repoPath, sourceCommitSha);

    const log = await git.log({ [dataBranch]: null, n: 1 });
    expect(log.latest?.hash).toEqual(dataCommitSha);

    // Check that there are no parents
    const commitInfo = await git.catFile(['-p', dataCommitSha]);
    expect(commitInfo).not.toContain('parent');
  });

  it('should create a correct parent chain on the data branch', async () => {
    const sourceCommit1 = await repoBuilder.commit('Commit 1', { 'a.txt': '1' });
    const dataCommit1 = await projectCommit(repoBuilder.repoPath, sourceCommit1);

    const sourceCommit2 = await repoBuilder.commit('Commit 2', { 'b.txt': '2' });
    const dataCommit2 = await projectCommit(repoBuilder.repoPath, sourceCommit2);

    const sourceCommit3 = await repoBuilder.commit('Commit 3', { 'c.txt': '3' });
    const dataCommit3 = await projectCommit(repoBuilder.repoPath, sourceCommit3);

    const log = await git.log({ [dataBranch]: null });
    expect(log.total).toBe(3);
    expect(log.all[0].hash).toEqual(dataCommit3);
    expect(log.all[1].hash).toEqual(dataCommit2);
    expect(log.all[2].hash).toEqual(dataCommit1);

    const commitInfo = await git.catFile(['-p', dataCommit3]);
    expect(commitInfo).toContain(`parent ${dataCommit2}`);
  });

  it('should be idempotent and not create duplicate data commits', async () => {
    const sourceCommit = await repoBuilder.commit('commit', { 'a.txt': '1' });

    const dataCommit1 = await projectCommit(repoBuilder.repoPath, sourceCommit);
    const dataCommit2 = await projectCommit(repoBuilder.repoPath, sourceCommit);

    expect(dataCommit1).toEqual(dataCommit2);
    const log = await git.log({ [dataBranch]: null });
    expect(log.total).toBe(1);
  });

  it('should store correct metadata in the data commit', async () => {
    const sourceCommit = await repoBuilder.commit('commit with metadata', { 'a.txt': 'data' });
    const dataCommit = await projectCommit(repoBuilder.repoPath, sourceCommit);

    const metadataContent = await git.show([`${dataCommit}:metadata/commit.json`]);
    const metadata = JSON.parse(metadataContent);

    expect(metadata.original_commit_sha).toEqual(sourceCommit);
    expect(metadata.parent_data_commit_oid).toBeNull();
    expect(metadata.snapshot_hash).toBeDefined();
    expect(metadata.files).toHaveLength(1);
    expect(metadata.files[0].path).toEqual('a.txt');
  });
});

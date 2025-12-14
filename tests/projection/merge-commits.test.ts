import { TestRepoBuilder } from '../harness/test-repo-builder';
import { projectCommit } from '../../src/projector';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

describe('Merge Commit Projection', () => {
  let tmpDir: string;
  let repoBuilder: TestRepoBuilder;
  let git: SimpleGit;
  const dataBranch = 'workspace/data';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projection-merge-test-'));
    repoBuilder = await TestRepoBuilder.create(tmpDir, 'repo');
    git = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should project a merge commit with a single data commit parent', async () => {
    // 1. Create base and project it
    const baseCommit = await repoBuilder.commit('base', { 'base.txt': 'base' });
    const baseDataCommit = await projectCommit(repoBuilder.repoPath, baseCommit);

    const mainBranch = await repoBuilder.getCurrentBranch();

    // 2. Create two branches
    await repoBuilder.createBranch('branch-a');
    await repoBuilder.commit('commit-a', { 'a.txt': 'a' });
    await repoBuilder.checkout(mainBranch);
    await repoBuilder.createBranch('branch-b');
    const commitB = await repoBuilder.commit('commit-b', { 'b.txt': 'b' });

    // Project one of the branches to advance the data branch
    await projectCommit(repoBuilder.repoPath, commitB);

    // 3. Merge branches
    await repoBuilder.checkout(mainBranch);
    await repoBuilder.merge('branch-a');
    await repoBuilder.merge('branch-b');
    const mergeCommitSha = (await git.log({n:1})).latest!.hash;

    // 4. Project the merge commit
    const dataCommitSha = await projectCommit(repoBuilder.repoPath, mergeCommitSha);

    // 5. Validation
    const log = await git.log({ [dataBranch]: null });
    expect(log.total).toBe(3);

    const dataCommitInfo = await git.catFile(['-p', dataCommitSha]);
    const parentDataCommits = dataCommitInfo.split('\n').filter(line => line.startsWith('parent '));
    expect(parentDataCommits).toHaveLength(1); // Data branch should be linear

    const metadataContent = await git.show([`${dataCommitSha}:metadata.json`]);
    const metadata = JSON.parse(metadataContent);
    expect(metadata.source_parent_shas).toHaveLength(2);
  });
});

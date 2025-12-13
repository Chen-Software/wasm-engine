import { getGit } from '../../src/projection-env';
import { computeSnapshotHash } from '../../src/snapshot';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { promises as fs } from 'fs';
import path from 'path';

describe('Step 2: Snapshot Hash Computation', () => {
  let repoBuilder: TestRepoBuilder;
  let git: ReturnType<typeof getGit>;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = getGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('produces the same hash for the same tree content', async () => {
    const commitSha = await repoBuilder.commit('Commit 1', { 'a.txt': '1', 'b.txt': '2' });
    const hash1 = await computeSnapshotHash(git, commitSha);
    const hash2 = await computeSnapshotHash(git, commitSha);
    expect(hash1).toBe(hash2);
  });

  it('produces a different hash if file content changes', async () => {
    const commit1 = await repoBuilder.commit('Commit 1', { 'a.txt': '1' });
    const hash1 = await computeSnapshotHash(git, commit1);

    const commit2 = await repoBuilder.commit('Commit 2', { 'a.txt': '2' });
    const hash2 = await computeSnapshotHash(git, commit2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces a different hash if a file is added', async () => {
    const commit1 = await repoBuilder.commit('Commit 1', { 'a.txt': '1' });
    const hash1 = await computeSnapshotHash(git, commit1);

    const commit2 = await repoBuilder.commit('Commit 2', { 'a.txt': '1', 'b.txt': '2' });
    const hash2 = await computeSnapshotHash(git, commit2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces a different hash if a file mode changes', async () => {
    const commit1 = await repoBuilder.commit('Commit 1', { 'script.sh': 'echo "hi"' });
    const hash1 = await computeSnapshotHash(git, commit1);

    await fs.chmod(path.join(repoBuilder.repoPath, 'script.sh'), '755');
    await repoBuilder.git.add('script.sh');
    const commit2 = await repoBuilder.git.commit('Make executable');

    const hash2 = await computeSnapshotHash(git, commit2.commit);

    expect(hash1).not.toBe(hash2);
  });

  it('is not affected by the order of file additions in a commit', async () => {
    const commit1 = await repoBuilder.commit('Commit 1', { 'a.txt': '1', 'b.txt': '2' });
    const hash1 = await computeSnapshotHash(git, commit1);

    // Create a new repo and commit the same files in a different order
    const repoBuilder2 = await TestRepoBuilder.create();
    const git2 = getGit(repoBuilder2.repoPath);
    const commit2 = await repoBuilder2.commit('Commit 1', { 'b.txt': '2', 'a.txt': '1' });
    const hash2 = await computeSnapshotHash(git2, commit2);

    expect(hash1).toBe(hash2);

    await repoBuilder2.cleanup();
  });
});

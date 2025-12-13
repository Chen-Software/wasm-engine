import { simpleGit } from 'simple-git';
import { calculateSnapshotHash } from '../../src/snapshot';
import { TestRepoBuilder } from '../harness/test-repo-builder';
import { promises as fs } from 'fs';
import path from 'path';

describe('Snapshot Hash Computation', () => {
  let repoBuilder: TestRepoBuilder;
  let git: ReturnType<typeof simpleGit>;

  beforeEach(async () => {
    repoBuilder = await TestRepoBuilder.create();
    git = simpleGit(repoBuilder.repoPath);
  });

  afterEach(async () => {
    await repoBuilder.cleanup();
  });

  it('should produce the same hash for the same tree', async () => {
    const commit = await repoBuilder.commitFiles({ 'a.txt': '1', 'b.txt': '2' }, 'Commit 1');
    const hash1 = await calculateSnapshotHash(git, commit);
    const hash2 = await calculateSnapshotHash(git, commit);
    expect(hash1).toBe(hash2);
  });

  it('should produce a different hash when file content changes', async () => {
    const commit1 = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const hash1 = await calculateSnapshotHash(git, commit1);

    const commit2 = await repoBuilder.commitFiles({ 'a.txt': '2' }, 'Commit 2');
    const hash2 = await calculateSnapshotHash(git, commit2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce a different hash when a file is added', async () => {
    const commit1 = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const hash1 = await calculateSnapshotHash(git, commit1);

    const commit2 = await repoBuilder.commitFiles({ 'a.txt': '1', 'b.txt': '2' }, 'Commit 2');
    const hash2 = await calculateSnapshotHash(git, commit2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce a different hash when a file is removed', async () => {
    const commit1 = await repoBuilder.commitFiles({ 'a.txt': '1', 'b.txt': '2' }, 'Commit 1');
    const hash1 = await calculateSnapshotHash(git, commit1);

    await git.rm('b.txt');
    const commit2 = await git.commit('Commit 2').then(r => r.commit);
    const hash2 = await calculateSnapshotHash(git, commit2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce a different hash when file mode changes', async () => {
    const commit1 = await repoBuilder.commitFiles({ 'a.txt': '1' }, 'Commit 1');
    const hash1 = await calculateSnapshotHash(git, commit1);

    // Change the file mode to executable.
    await fs.chmod(path.join(repoBuilder.repoPath, 'a.txt'), '755');
    await git.add('a.txt');
    const commit2 = await git.commit('Commit 2').then(r => r.commit);
    const hash2 = await calculateSnapshotHash(git, commit2);

    expect(hash1).not.toBe(hash2);
  });

  it('should not be affected by the order of files in the commit', async () => {
    // This is implicitly tested by using `git ls-tree -r`, which has a stable sort order.
    // However, we can create two commits with different file addition orders to be sure.
    const repoBuilder2 = await TestRepoBuilder.create();
    const git2 = simpleGit(repoBuilder2.repoPath);

    const commit1 = await repoBuilder.commitFiles({ 'a.txt': '1', 'b.txt': '2' }, 'Commit 1');
    const hash1 = await calculateSnapshotHash(git, commit1);

    // Same files, different commit order.
    const commit2 = await repoBuilder2.commitFiles({ 'b.txt': '2', 'a.txt': '1' }, 'Commit 1');
    const hash2 = await calculateSnapshotHash(git2, commit2);

    expect(hash1).toBe(hash2);

    await repoBuilder2.cleanup();
  });
});

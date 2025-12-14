import { TestRepoBuilder } from '../harness/test-repo-builder';
import { computeSnapshotHash } from '../../src/snapshot';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit } from 'simple-git';

describe('Snapshot Hash Computation', () => {
  let tmpDir: string;
  let repoBuilder: TestRepoBuilder;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-test-'));
    repoBuilder = await TestRepoBuilder.create(tmpDir, 'repo');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should produce the same hash for identical trees in different repos', async () => {
    // Repo 1
    const repoBuilder1 = await TestRepoBuilder.create(tmpDir, 'repo1');
    const commitSha1 = await repoBuilder1.commit('commit', {
      'a.txt': 'hello',
      'b.txt': 'world',
    });
    const hash1 = await computeSnapshotHash(repoBuilder1.repoPath, commitSha1);

    // Repo 2 - different repo, different commit message, but identical tree
    const repoBuilder2 = await TestRepoBuilder.create(tmpDir, 'repo2');
    const commitSha2 = await repoBuilder2.commit('another commit', {
      'a.txt': 'hello',
      'b.txt': 'world',
    });
    const hash2 = await computeSnapshotHash(repoBuilder2.repoPath, commitSha2);

    expect(hash1).toEqual(hash2);
  });

  it('should produce a different hash when file content changes', async () => {
    const commitSha1 = await repoBuilder.commit('commit 1', { 'a.txt': 'hello' });
    const hash1 = await computeSnapshotHash(repoBuilder.repoPath, commitSha1);

    const commitSha2 = await repoBuilder.commit('commit 2', { 'a.txt': 'goodbye' });
    const hash2 = await computeSnapshotHash(repoBuilder.repoPath, commitSha2);

    expect(hash1).not.toEqual(hash2);
  });

  it('should produce a different hash when file mode changes', async () => {
    const commitSha1 = await repoBuilder.commit('commit 1', { 'run.sh': 'echo "hello"' });
    const hash1 = await computeSnapshotHash(repoBuilder.repoPath, commitSha1);

    // Change the file to be executable
    await fs.chmod(path.join(repoBuilder.repoPath, 'run.sh'), '755');
    await simpleGit(repoBuilder.repoPath).add('run.sh');
    const commitSha2 = await repoBuilder.commit('commit 2', {});
    const hash2 = await computeSnapshotHash(repoBuilder.repoPath, commitSha2);

    expect(hash1).not.toEqual(hash2);
  });

  it('should not be affected by the order files are added', async () => {
    // Repo 1: a.txt then b.txt
    const repoBuilder1 = await TestRepoBuilder.create(tmpDir, 'repo1');
    const commitSha1 = await repoBuilder1.commit('commit', {
      'a.txt': 'content',
      'b.txt': 'content'
    });
    const hash1 = await computeSnapshotHash(repoBuilder1.repoPath, commitSha1);

    // Repo 2: b.txt then a.txt
    const repoBuilder2 = await TestRepoBuilder.create(tmpDir, 'repo2');
    const commitSha2 = await repoBuilder2.commit('commit', {
      'b.txt': 'content',
      'a.txt': 'content'
    });
    const hash2 = await computeSnapshotHash(repoBuilder2.repoPath, commitSha2);

    expect(hash1).toEqual(hash2);
  });

  it('should correctly handle nested directories', async () => {
    const commitSha = await repoBuilder.commit('nested', {
      'file.txt': 'root',
      'nested/file.txt': 'nested'
    });
    const hash = await computeSnapshotHash(repoBuilder.repoPath, commitSha);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256
  });
});

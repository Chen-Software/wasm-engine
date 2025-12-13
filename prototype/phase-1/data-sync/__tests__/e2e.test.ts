import { Volume } from 'memfs';
import git from 'isomorphic-git';
import { project } from '../projection';
import { reconstruct } from '../reconstruction';
import path from 'path';

// Helper function to create an in-memory git repository.
async function setupRepo(fs: any, projectDir: string, files: Record<string, string>) {
  await git.init({ fs, dir: projectDir });
  for (const [filepath, content] of Object.entries(files)) {
    const fullpath = path.join(projectDir, filepath);
    await fs.promises.mkdir(path.dirname(fullpath), { recursive: true });
    await fs.promises.writeFile(fullpath, content);
    await git.add({ fs, dir: projectDir, filepath });
  }
  const author = {
    name: 'Test',
    email: 'test@example.com',
    timestamp: Math.floor(Date.now() / 1000),
    timezoneOffset: new Date().getTimezoneOffset(),
  };
  const sha = await git.commit({
    fs,
    dir: projectDir,
    message: 'Initial commit',
    author,
    committer: author,
  });
  return sha;
}

describe('E2E Data Sync', () => {
  let fs: any;
  const projectDir = '/test-repo';

  beforeEach(() => {
    // Create a fresh in-memory filesystem for each test.
    const vol = Volume.fromJSON({});
    fs = vol;
    // Patch the readdir method to be compatible with isomorphic-git.
    const originalReaddir = fs.promises.readdir;
    fs.promises.readdir = (path: string) => originalReaddir.call(fs.promises, path, { withFileTypes: false });
  });

  it('should project a commit and then reconstruct it successfully', async () => {
    // 1. Setup the repo and make a commit.
    const initialFiles = {
      'file1.txt': 'hello world',
      'nested/file2.txt': 'another file',
    };
    const commitOid = await setupRepo(fs, projectDir, initialFiles);

    // 2. Project the commit to the data branch.
    await project({ sourceCommitOid: commitOid, fs, projectDir });

    // 3. Reconstruct the artifacts from the data branch.
    const outputDir = '/reconstructed';
    await reconstruct({ outputDir, fs, projectDir });

    // 4. Verify the reconstructed files.
    const reconstructedFile1 = await fs.promises.readFile(
      path.join(outputDir, 'file1.txt'),
      'utf8',
    );
    const reconstructedFile2 = await fs.promises.readFile(
      path.join(outputDir, 'nested/file2.txt'),
      'utf8',
    );

    expect(reconstructedFile1).toBe('hello world');
    expect(reconstructedFile2).toBe('another file');
  });

  it('should skip projection if it already exists (idempotency)', async () => {
    // 1. Setup the repo and make a commit.
    const commitOid = await setupRepo(fs, projectDir, { 'file.txt': 'content' });

    // 2. Project the commit twice.
    await project({ sourceCommitOid: commitOid, fs, projectDir });
    await project({ sourceCommitOid: commitOid, fs, projectDir });

    // 3. Check the data branch history. There should only be one projection commit.
    const commits = await git.log({ fs, dir: projectDir, ref: 'data' });
    expect(commits).toHaveLength(1);
  });

  it('should handle multiple sequential projections', async () => {
    // 1. Initial commit and projection.
    const commit1Oid = await setupRepo(fs, projectDir, { 'file.txt': 'version 1' });
    await project({ sourceCommitOid: commit1Oid, fs, projectDir });

    // 2. Second commit and projection.
    await fs.promises.writeFile(path.join(projectDir, 'file.txt'), 'version 2');
    await git.add({ fs, dir: projectDir, filepath: 'file.txt' });
    const author = {
      name: 'Test',
      email: 'test@example.com',
      timestamp: Math.floor(Date.now() / 1000),
      timezoneOffset: new Date().getTimezoneOffset(),
    };
    const commit2Oid = await git.commit({
      fs,
      dir: projectDir,
      message: 'Second commit',
      author,
      committer: author,
    });
    await project({ sourceCommitOid: commit2Oid, fs, projectDir });

    // 3. Check the data branch history.
    const commits = await git.log({ fs, dir: projectDir, ref: 'data' });
    expect(commits).toHaveLength(2);

    // 4. Reconstruct and verify the latest version.
    const outputDir = '/reconstructed';
    await reconstruct({ outputDir, fs, projectDir });
    const reconstructedFile = await fs.promises.readFile(
      path.join(outputDir, 'file.txt'),
      'utf8',
    );
    expect(reconstructedFile).toBe('version 2');
  });
});

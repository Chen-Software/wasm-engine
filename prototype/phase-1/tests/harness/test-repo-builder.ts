import { simpleGit, SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * A helper class for building Git repositories for testing purposes.
 */
export class TestRepoBuilder {
  private git: SimpleGit;
  public readonly repoPath: string;

  private constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Creates a new TestRepoBuilder instance and initializes a Git repository.
   */
  public static async create(): Promise<TestRepoBuilder> {
    const repoPath = await fs.mkdtemp('/tmp/test-repo-');
    const builder = new TestRepoBuilder(repoPath);
    await builder.git.init();
    await builder.git.addConfig('user.name', 'Test User');
    await builder.git.addConfig('user.email', 'test@example.com');
    return builder;
  }

  /**
   * Commits a set of files to the repository.
   * @param files - A map of file paths to their content.
   * @param message - The commit message.
   * @returns The SHA of the new commit.
   */
  public async commitFiles(files: Record<string, string>, message: string): Promise<string> {
    for (const [filepath, content] of Object.entries(files)) {
      const fullpath = path.join(this.repoPath, filepath);
      await fs.mkdir(path.dirname(fullpath), { recursive: true });
      await fs.writeFile(fullpath, content);
      await this.git.add(filepath);
    }
    const commitResult = await this.git.commit(message);
    return commitResult.commit;
  }

  /**
   * Cleans up the test repository by deleting it from the filesystem.
   */
  public async cleanup(): Promise<void> {
    await fs.rm(this.repoPath, { recursive: true, force: true });
  }
}

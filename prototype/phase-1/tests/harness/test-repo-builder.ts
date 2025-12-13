import { simpleGit, SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * A builder for creating reproducible Git repositories for testing.
 * It provides a fluent API for committing files, creating branches, and merging.
 */
export class TestRepoBuilder {
  public readonly git: SimpleGit;
  public readonly repoPath: string;

  private constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Asynchronously creates and initializes a new test repository.
   */
  public static async create(): Promise<TestRepoBuilder> {
    const repoPath = await fs.mkdtemp('/tmp/test-repo-');
    const builder = new TestRepoBuilder(repoPath);
    await builder.git.init();
    await builder.git.addConfig('user.name', 'Test User');
    await builder.git.addConfig('user.email', 'test@example.com');
    // Set a default branch name to avoid warnings
    await builder.git.checkoutLocalBranch('main');
    return builder;
  }

  /**
   * Commits one or more files to the current branch.
   */
  public async commit(message: string, files: Record<string, string>): Promise<string> {
    for (const [filepath, content] of Object.entries(files)) {
      const fullpath = path.join(this.repoPath, filepath);
      await fs.mkdir(path.dirname(fullpath), { recursive: true });
      await fs.writeFile(fullpath, content);
    }
    await this.git.add(Object.keys(files));
    const commitResult = await this.git.commit(message);
    return commitResult.commit;
  }

  /**
   * Creates and checks out a new branch.
   */
  public async branch(name: string): Promise<void> {
    await this.git.checkoutLocalBranch(name);
  }

  /**
   * Checks out an existing branch.
   */
  public async checkout(name: string): Promise<void> {
    await this.git.checkout(name);
  }

  /**
   * Merges another branch into the current branch.
   */
  public async merge(name: string): Promise<void> {
    await this.git.merge([name]);
  }

  /**
   * Deletes the temporary repository directory.
   */
  public async cleanup(): Promise<void> {
    await fs.rm(this.repoPath, { recursive: true, force: true });
  }
}

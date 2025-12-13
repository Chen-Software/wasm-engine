import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TestRepoBuilder {
  public git: SimpleGit;
  public readonly repoPath: string;

  private constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  public static async create(basePath: string, repoName: string): Promise<TestRepoBuilder> {
    const repoPath = path.join(basePath, repoName);
    await fs.mkdir(repoPath, { recursive: true });
    const builder = new TestRepoBuilder(repoPath);
    await builder.git.init();
    await builder.git.addConfig('user.name', 'Test User');
    await builder.git.addConfig('user.email', 'test@example.com');
    return builder;
  }

  public async commit(message: string, files: { [filename: string]: string }): Promise<string> {
    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(this.repoPath, filename);
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content);
      await this.git.add(filePath);
    }
    // Explicitly use the current process.env for the command
    const commitResult = await this.git.env(process.env).commit(message);
    return commitResult.commit;
  }

  public async createBranch(branchName: string): Promise<void> {
    await this.git.checkout(['-b', branchName]);
  }

  public async checkout(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  public async merge(branchName: string): Promise<void> {
    await this.git.merge([branchName]);
  }

  public async getCurrentBranch(): Promise<string> {
    const branchSummary = await this.git.branch();
    return branchSummary.current;
  }

  public async createArtifactManifest(manifest: { artifacts: { name: string, files: string[] }[] }): Promise<void> {
    const yaml = await import('js-yaml');
    const manifestContent = yaml.dump(manifest);
    const filePath = path.join(this.repoPath, '.artifacts.yaml');
    await fs.writeFile(filePath, manifestContent);
    await this.git.add(filePath);
  }
}
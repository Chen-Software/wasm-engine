import { SimpleGitOptions, simpleGit } from 'simple-git';

// The deterministic environment variables required for all Git operations.
export const deterministicGitEnvironment = {
  GIT_AUTHOR_NAME: 'projection-bot',
  GIT_AUTHOR_EMAIL: 'projection@localhost',
  GIT_COMMITTER_NAME: 'projection-bot',
  GIT_COMMITTER_EMAIL: 'projection@localhost',
  GIT_AUTHOR_DATE: '1970-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '1970-01-01T00:00:00Z',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'UTC',
};

/**
 * Creates a simple-git instance with a strictly deterministic environment.
 * All Git operations performed with this instance will be repeatable and
 * isolated from the user's local Git configuration.
 *
 * @param baseDir - The path to the Git repository.
 * @returns A simple-git instance configured for deterministic operations.
 */
export function getDeterministicGit(baseDir: string) {
  const options: Partial<SimpleGitOptions> = {
    baseDir,
    binary: 'git',
    maxConcurrentProcesses: 1,
    config: [],
  };

  const git = simpleGit(options);

  // Apply the deterministic environment variables to all git commands.
  git.env(deterministicGitEnvironment);

  return git;
}

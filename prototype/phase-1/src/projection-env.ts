import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';

// The exact, non-negotiable environment for deterministic Git operations.
const PROJECTION_ENV = {
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
 * Creates a simple-git instance configured for deterministic operations.
 * It is pre-configured to use the isolated, deterministic environment.
 *
 * @param baseDir - The path to the Git repository.
 * @returns A simple-git instance.
 */
export function getGit(baseDir: string): SimpleGit {
  const options: Partial<SimpleGitOptions> = {
    baseDir,
    binary: 'git',
    maxConcurrentProcesses: 1,
  };

  const git = simpleGit(options);

  // Apply the deterministic environment to all commands run with this instance.
  git.env(PROJECTION_ENV);

  return git;
}

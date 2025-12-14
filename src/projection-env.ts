// src/projection-env.ts

export function setDeterministicGitEnvironment(): void {
  // Required environment variables for deterministic Git operations
  process.env.GIT_AUTHOR_NAME = 'projection-bot';
  process.env.GIT_AUTHOR_EMAIL = 'projection@localhost';
  process.env.GIT_COMMITTER_NAME = 'projection-bot';
  process.env.GIT_COMMITTER_EMAIL = 'projection@localhost';
  process.env.GIT_AUTHOR_DATE = '1970-01-01T00:00:00Z';
  process.env.GIT_COMMITTER_DATE = '1970-01-01T00:00:00Z';

  // Disable the use of global and system git config files
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';

  // Normalize locale and timezone settings
  process.env.LC_ALL = 'C';
  process.env.LANG = 'C';
  process.env.TZ = 'UTC';
}

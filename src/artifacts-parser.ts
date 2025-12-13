// src/artifacts-parser.ts

import * as yaml from 'js-yaml';
import { simpleGit, SimpleGit } from 'simple-git';

export interface Artifact {
  name: string;
  files: string[];
}

export interface ArtifactManifest {
  artifacts: Artifact[];
}

/**
 * Parses the .artifacts.yaml manifest from a given commit.
 *
 * @param repoPath The file system path to the repository.
 * @param commitSha The SHA of the commit to read from.
 * @returns The parsed ArtifactManifest, or null if the file does not exist.
 */
export async function parseArtifactManifest(repoPath: string, commitSha: string): Promise<ArtifactManifest | null> {
  const git: SimpleGit = simpleGit(repoPath);
  try {
    const manifestContent = await git.show([`${commitSha}:.artifacts.yaml`]);
    return yaml.load(manifestContent) as ArtifactManifest;
  } catch (error) {
    // Assuming error means the file does not exist
    return null;
  }
}

// src/registry.ts

import { simpleGit, SimpleGit } from 'simple-git';
import * as yaml from 'js-yaml';

export const REGISTRY_PATH = '.llm-context/registry.yaml';

export interface Registry {
  [artifactName: string]: {
    latest: string;
    history: string[];
  };
}

export async function readRegistry(git: SimpleGit, dataCommitSha: string): Promise<Registry> {
  try {
    const content = await git.show([`${dataCommitSha}:${REGISTRY_PATH}`]);
    return (yaml.load(content) as Registry) || {};
  } catch {
    return {};
  }
}

export function updateRegistry(
  currentRegistry: Registry,
  artifactNames: string[],
  newDataCommitSha: string
): Registry {
  // Create a deep copy to avoid mutating the original object
  const newRegistry: Registry = JSON.parse(JSON.stringify(currentRegistry));

  for (const name of artifactNames) {
    if (!newRegistry[name]) {
      newRegistry[name] = { latest: '', history: [] };
    }
    newRegistry[name].latest = newDataCommitSha;
    newRegistry[name].history.push(newDataCommitSha);
  }
  return newRegistry;
}

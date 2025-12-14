# Architecture Decisions

This document records the key architectural and implementation decisions made during the development of the Git-native DAG projection system PoC.

## Phase 2 Decisions

- **Tree Construction Strategy**: The projection tree is built in a temporary staging repository to ensure robustness and leverage high-level Git commands.
- **Determinism Enforcement**: Determinism is enforced via a strict set of environment variables.
- **Workspace Reconstruction**: Reconstruction is performed efficiently using `git archive` and `tar`.

## Phase 3 Decisions

- **Multi-File Artifact Definition**: Artifacts are defined in a user-facing `.artifacts.yaml` manifest file. This allows users to define logical groupings of files using familiar glob patterns. The system falls back to a "default" artifact (the entire repository) if this file is not present, ensuring backward compatibility.

- **Registry Update Model: Event Sourcing**: The artifact registry (`.llm-context/registry.yaml`) is updated using an event-sourcing pattern. The registry within a data commit `D(n)` contains the state of the world *after* its parent `D(n-1)` was created. This approach was chosen to resolve a circular dependency, where a commit's final SHA must be known to be included in its own registry. This "one-step-behind" model is deterministic, easy to reason about, and preserves the immutability of the data branch.

- **Atomic Projections**: The projection of all artifacts from a single source commit, along with the update to the metadata and registry, is performed as a single, atomic operation that results in one new data commit. This ensures that the data branch is always in a consistent state.

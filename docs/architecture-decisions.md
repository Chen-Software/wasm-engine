# Architecture Decisions

This document records the key architectural and implementation decisions made during the development of the Git-native DAG projection system PoC.

## 1. Tree Construction Strategy: Staging Repository

**Decision**: The projection tree (containing the `artifacts/` and `metadata/` directories) is built in a temporary, bare Git repository. The resulting tree object is then fetched into the main repository and used to create the final data commit.

**Rationale**: Early attempts to construct the tree using low-level "plumbing" commands (`update-index`, `write-tree`) with a temporary index file proved to be extremely complex and error-prone. This approach was brittle and difficult to debug due to subtle issues with environment variable scoping in `simple-git` and the complexities of correctly building nested tree structures.

The staging repository approach is more robust and reliable because it leverages high-level, battle-tested Git commands (`init`, `add`, `commit`) and allows Git to manage the complexities of the index and object database. This significantly simplified the implementation and eliminated a major source of bugs.

**Consequences**:
- The implementation is more robust and easier to understand.
- There is a slight performance overhead due to the creation of a temporary repository on disk. For the purposes of this PoC, this is an acceptable trade-off for the gain in reliability.

## 2. Determinism Enforcement: Environment Variables

**Decision**: Determinism is enforced by setting a specific set of environment variables (`GIT_AUTHOR_NAME`, `GIT_COMMITTER_DATE`, `LC_ALL`, etc.) for all Git operations.

**Rationale**: This is a standard and effective way to ensure that Git commands produce bit-for-bit identical results across different machines and user configurations. It isolates the projection process from the host environment.

**Consequences**:
- All Git operations must be wrapped in a function that sets these environment variables.
- The test suite must explicitly verify that these variables are being correctly applied and are overriding any user-specific or polluted environment settings.

## 3. Workspace Reconstruction: Git Archive and Tar

**Decision**: Workspace reconstruction is performed by using `git archive` to create a tarball of the `artifacts/` tree, which is then unpacked into the target directory.

**Rationale**: This is a highly efficient and reliable way to export a tree from a Git repository. It correctly preserves file content, directory structure, and file modes (including execute permissions). It is also faster and simpler than iterating through the tree and checking out each file individually.

**Consequences**:
- The implementation has a dependency on the `tar` shell command. This is a reasonable assumption for the Linux/macOS environments targeted by this PoC.

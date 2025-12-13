# Known Limitations & Future Work

This document outlines the known limitations of the current Proof of Concept (PoC) implementation and identifies areas for future work.

## PoC Scope Boundaries

The following features were intentionally deferred to keep the PoC focused on validating the critical path and core architectural principles.

- **Rebase Handling**: The current implementation does not handle rebased source commits. If a source branch is rebased, the projection system will treat the rebased commits as entirely new commits, leading to duplicate projections on the data branch. A future version will need to detect rebased commits and either update the corresponding data commits or provide a clear mechanism for handling them.

- **Error Recovery**: The PoC does not include robust error recovery. If a projection fails, it will simply throw an error. A production system would require a more sophisticated error handling strategy, such as creating error markers on the data branch or implementing transactional logic to ensure that the branch is always in a consistent state.

- **Performance Optimization**: The current implementation is not optimized for performance. The use of a temporary staging repository, while robust, introduces overhead. For large repositories or high-frequency commit rates, performance may be a concern. Future work could explore optimizations such as caching, parallel operations, or a more efficient tree-building strategy if the current approach proves to be a bottleneck.

- **Cross-Platform Compatibility**: The PoC was developed and tested on a Linux-based environment. It has a dependency on the `tar` shell command and makes assumptions about line endings (LF-only). A production version would need to be tested and potentially adapted for other operating systems, particularly Windows (which uses CRLF line endings and has a case-insensitive filesystem).

- **Multi-File Artifacts**: The current model assumes that the entire source tree is a single artifact. The system does not yet support the concept of grouping specific files or directories into distinct, versioned artifacts.

- **Registry Synchronization**: The PoC does not include any logic for synchronizing with a central registry or manifest file (e.g., `.llm-context/registry.yaml`). This will be a critical feature for a production system.

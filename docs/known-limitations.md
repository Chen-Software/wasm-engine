# Known Limitations & Future Work

This document outlines the known limitations of the current Proof of Concept (PoC) implementation and identifies areas for future work.

## Implemented in Phase 3

- **Multi-File Artifacts**: The system now supports the definition of multiple artifacts via an `.artifacts.yaml` manifest.
- **Registry Synchronization**: A deterministic, Git-native artifact registry is now implemented and updated with each projection.

## Future Work (Post-Phase 3)

The following features were intentionally deferred and represent the next logical steps for a production system.

- **Rebase & Orphaned Commit Handling**: The current implementation does not handle rebased source commits. Future work should focus on detecting rebased commits and updating the registry to mark the old data commits as "orphaned" and point to the new, canonical projections.

- **Performance Optimization**: The current implementation is not optimized for performance. For large repositories, the process of creating a temporary staging repository for each projection could become a bottleneck. Future work could explore caching of unchanged artifacts and other performance enhancements.

- **Cross-Platform Compatibility**: The PoC has been developed and tested on a Linux-based environment and has a dependency on the `tar` shell command. A production version would need to be tested and hardened for other operating systems, particularly Windows.

- **Schema Validation**: The `.artifacts.yaml` and `.llm-context/registry.yaml` files are parsed with the assumption that they are correctly formatted. A production system should include robust schema validation to provide clear error messages for malformed user input.

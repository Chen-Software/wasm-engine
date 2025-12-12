---
id: ADR-010
title: "Agent SDK & Toolchain"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
  - ADR-005
tags:
  - sdk
  - developer-experience
---

# 1. Context

To enable developers to build agents that are compliant with the runtime's ABI and security model (see [ADR-005](005-plugin-signing-and-abi-enforcement.md)), a dedicated Software Development Kit (SDK) and toolchain are required.

# 2. Decision

-   **Core SDK:** A primary SDK will be provided in **Rust**, as it offers the best combination of performance, memory safety, and a mature WASM compilation target.
-   **SDK Contents:** The SDK will provide:
    -   Type-safe bindings for the runtime's ABI.
    -   Serialization helpers.
    -   A local test harness for simulating the deterministic scheduler and orchestrator messaging, allowing for unit testing of agents.
-   **Toolchain:** The toolchain will include scripts for compiling, optimizing, and signing the final WASM agent module.

# 3. Rationale

-   **Developer Experience:** A dedicated SDK is critical for developer adoption. It lowers the barrier to entry and reduces the likelihood of bugs.
-   **Compliance:** The SDK and toolchain can enforce best practices and ensure that all generated agents are compliant with the runtime's strict requirements.

# 4. Consequences

-   **Positive:** Dramatically improves the developer experience and the quality of agents built for the platform.
-   **Negative:** Represents a significant engineering investment to build and maintain the SDK and its associated tooling.

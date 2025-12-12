# Technical Critique of the Product Requirements Document (v0.3)

**To**: CTO, Platform Architecture, ML Systems
**From**: Principal Engineer
**Date**: 2025-12-14
**Subject**: Architectural Implications and Second-Order Challenges in PRD v0.3

---

## 1. Overview

The latest PRD (v0.3) is a significant improvement, establishing a firm, technically grounded contract for the runtime. The emphasis on system invariants is precisely what engineering needs to build a robust and predictable system.

This critique focuses on the next layer of architectural challenges that emerge from these stricter requirements. It is intended to provoke discussion on the critical subsystems and trade-offs that will define the success of the implementation.

---

## 2. Analysis of Key Architectural Decisions

### 2.1. The "Orchestrator as Communication Hub" Model

The requirement that "All communication flows through the orchestrator" (4.1.4) is the correct decision for ensuring determinism and replayability. However, we must be clear about the performance trade-offs this imposes.

-   **Challenge**: Forcing all inter-agent communication through the single-threaded Node.js orchestrator introduces a serialization and dispatch bottleneck. High-frequency message passing between agents will be limited by the throughput of the main event loop. This is an acceptable trade-off for control, but it will preclude certain classes of high-performance, tightly coupled agent interactions.
-   **Recommendation**:
    1.  **Acknowledge the Trade-off**: We should explicitly document this limitation. The primary communication pattern is for control signals and structured data, not high-bandwidth streams.
    2.  **Future Extension - Arbitrated Channels**: Propose a future extension for "arbitrated direct memory channels." In this model, the orchestrator could deterministically grant two agents read/write access to a specific, temporary shared memory region. The setup and teardown of this channel would be deterministic, but the communication within it would be at native speed. This preserves the architectural guarantee while allowing for future performance optimizations.

### 2.2. The Agent Developer Experience is Now the Primary Risk

The decision to use WASM for agent logic (2.1) is excellent for security and isolation. However, the PRD now implicitly creates a new, critical dependency: the quality of the agent developer toolchain.

-   **Challenge**: Writing, debugging, and optimizing WASM is a high-friction process. If our Agent SDK is not world-class, the runtime will be powerful but unusable. The PRD defines the runtime's contract, but not how a developer is expected to actually build a compliant agent.
-   **Recommendation**:
    1.  **Elevate the SDK to a Core Product**: The Agent SDK is not a "future extension"; it is a core component that must be co-developed with the runtime from Phase 0.
    2.  **Define the SDK's Scope**: We need a dedicated spec for the SDK. What languages will we officially support (e.g., Rust, C++, AssemblyScript)? What libraries for message passing and memory access will we provide? How will developers debug their WASM modules? Answering these questions is as important as building the scheduler.

### 2.3. Model Management is a Critical Subsystem

The requirement that "Model loading/unloading must be managed centrally by the orchestrator" (4.1.5) and the open question on model versioning (8) touch upon a major subsystem that needs to be formally defined.

-   **Challenge**: The orchestrator's role is scheduling, not managing a complex lifecycle of ML models. This includes fetching, caching, versioning, and managing GPU memory. Mixing these concerns will bloat the orchestrator and violate the single-responsibility principle.
-   **Recommendation**:
    1.  **Define a "Model Management Service"**: We should formally architect a separate internal service that the orchestrator communicates with. Its responsibilities would include:
        -   **Model Registry**: Tracking available models and their versions (using checksums for integrity).
        -   **Caching**: Managing a local cache of model files.
        -   **GPU Memory Management**: Handling the loading and unloading of models into VRAM, potentially with an LRU (Least Recently Used) policy to manage memory pressure.
    2.  **API-Driven**: The orchestrator would interact with this service via a clean internal API (e.g., `modelManager.requestInference(modelId, version, inputBuffer)`). This keeps the scheduler's logic clean and focused on determinism.

### 2.4. DAG Scheduling is a v2 Architecture

The PRD mentions "hooks for future DAG-based scheduling" (4.1.2). We need to be clear that this is not a simple feature addition.

-   **Challenge**: Moving from a linear (priority/FIFO) queue to a Directed Acyclic Graph (DAG) represents a fundamental shift in the scheduler's complexity. It requires tracking dependencies, managing a state machine for each task, and handling conditional execution paths.
-   **Recommendation**:
    1.  **Constrain v1 Scope**: The PRD and all related documents should explicitly state that **v1 will only support linear scheduling**. This is critical for delivering the initial product on time.
    2.  **Treat DAG as a v2 Epic**: Frame DAG scheduling as a major architectural evolution. We can and should design our task objects to be extensible (e.g., by adding a `dependencies` field in the future), but the v1 scheduler logic should not attempt to account for it.

---

## 3. Summary of Recommendations

The PRD is strong. To make it actionable, we must:

1.  **Formalize the Orchestrator's Bottleneck**: Accept and document the performance characteristics of a centralized message bus.
2.  **Prioritize the Developer Experience**: Immediately begin a parallel design effort for the Agent SDK.
3.  **Architect the Model Manager**: Design the model management service as a distinct, critical subsystem from day one.
4.  **Scope Lock v1 Scheduler**: Defer the complexities of DAG scheduling to a future release to ensure v1 is achievable.
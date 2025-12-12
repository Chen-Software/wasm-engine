---
id: ADR-008
title: "Optional UI Framework"
status: "Approved"
date: 2025-12-17
related:
  - ADR-001
tags:
  - ui
  - decoupling
---

# 1. Context

The runtime is designed to be **headless-first**. However, for visualization, debugging, and user interaction, an optional UI layer is required. This ADR defines the architectural relationship between the core runtime and the UI. See [ADR-001](001-shared-runtime-architecture.md).

# 2. Decision

-   **Strict Decoupling:** The UI will always run in a **separate process** from the core runtime orchestrator. This is a non-negotiable architectural invariant.
-   **Read-Only State Channel:** The UI process may subscribe to a read-only state channel from the orchestrator to receive data for visualization.
-   **No Direct Mutation:** The UI must **never** mutate agent state, memory, or scheduler configuration directly. All user actions that intend to influence the runtime must be sent as formal, serializable messages through the orchestrator's public API.
-   **Crash Isolation:** The IPC boundary between the orchestrator and the UI process must guarantee that a crash or freeze in the UI layer cannot impact the stability of the core runtime.
-   **Framework Choice:** The specific UI framework (e.g., Electron, Servo, or a web-based front-end) is considered an implementation detail and is not constrained by this ADR, as long as the decoupling principles are maintained.

# 3. Rationale

-   **Determinism & Stability:** This strict separation is the primary mechanism that protects the runtime's deterministic guarantees from the non-deterministic nature of user interfaces (e.g., unpredictable event timing, rendering loops).
-   **Performance:** It ensures that UI rendering, which can be resource-intensive, does not compete for CPU/GPU resources on the same threads as the performance-critical scheduler and compute workloads.
-   **Flexibility:** By defining a clear, message-based interface, it allows different types of UIs (or even multiple UIs) to be attached to the same runtime instance.

# 4. Consequences

-   **Positive:**
    -   Guarantees the core runtime remains headless and stable.
    -   Protects performance and determinism.
-   **Negative:**
    -   Increases complexity by requiring a formal IPC mechanism between the runtime and the UI.
    -   Can lead to higher latency for displaying state changes compared to a tightly-coupled system.

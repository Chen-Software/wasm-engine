---
id: ADR-004
title: "Shared Memory Ownership & Concurrency Rules"
status: "Approved"
date: 2025-12-17
related:
  - ADR-001
tags:
  - runtime
  - memory-management
  - concurrency
---

# 1. Context

To achieve high-performance, low-latency communication between the Node.js orchestrator and the WASM worker pool, a shared memory (`SharedArrayBuffer`) approach is required. This introduces the risk of race conditions, deadlocks, and data corruption if not managed with a strict concurrency protocol. This ADR defines that protocol.

# 2. Decision

The runtime will adopt a **Triple-Buffering** strategy combined with **Generational Indices** for all high-throughput data exchange between the WASM (producer) and Orchestrator/Servo (consumer) layers.

## 2.1 Triple-Buffering
-   **Structure:** Three identical buffer sets (A, B, C) are allocated within a single `SharedArrayBuffer`.
-   **Flow:**
    1.  WASM writes compute results to the "back buffer" (e.g., A).
    2.  The consumer reads data from the "front buffer" (e.g., B).
    3.  The orchestrator coordinates buffer swaps atomically using `Atomics.compareExchange()` on a metadata index.
-   **Synchronization:** `Atomics.wait()` and `Atomics.notify()` are used to signal buffer readiness, preventing busy-polling.

## 2.2 Generational Indices
-   **Structure:** Pointers or indices into the shared buffer are tagged with a generation counter (e.g., `struct GenIndex { index: u32, generation: u32 }`).
-   **Validation:** Before dereferencing a pointer, the consumer validates that the buffer's current generation matches the index's generation. This prevents Use-After-Free errors on stale data.

# 3. Rationale

-   **Performance:** This model is almost entirely lock-free, eliminating lock contention as a source of performance bottlenecks and latency jitter.
-   **Correctness:** It is a battle-tested pattern used in high-performance graphics and gaming to guarantee that the consumer is never reading a partially-written state and the producer never has to wait for a lock.
-   **Safety:** Generational indices provide a robust mechanism for preventing memory safety errors that can arise from asynchronous buffer access.

# 4. Consequences

-   **Positive:**
    -   Massively reduces risk of deadlocks and race conditions.
    -   Provides predictable, low-latency data exchange.
-   **Negative:**
    -   Higher memory overhead due to the three buffers.
    -   Increased implementation complexity in the memory management subsystem.

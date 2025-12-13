---
id: ADR-012
title: "Ordering-Only Determinism (Deterministic Event Sequencing)"
status: "Proposed"
date: "2025-12-17"
owners: ["Engineering Team"]
reviewers: ["Engineering Team"]
related:
  - "ADR-010"
  - "ADR-011"
tags:
  - "determinism"
  - "ordering"
  - "scheduler"
  - "event-sequencing"
---

# ADR-012: Ordering-Only Determinism (Deterministic Event Sequencing)

## 1. Context / Problem Statement

This ADR specifies the *mechanism* by which the runtime achieves the deterministic goals set forth in `ADR-010` and `ADR-011`. To guarantee reproducibility, the system needs a core scheduling philosophy. The key challenge is that modern hardware (especially GPUs) and software environments introduce low-level nondeterminism (e.g., floating-point rounding, thread scheduling) that makes bit-for-bit equivalence across different platforms nearly impossible.

Attempting to enforce bit-level determinism would severely constrain performance and architectural flexibility. Therefore, we must choose a determinism model that provides logical consistency without requiring binary equivalence.

## 2. Decision

We will adopt **ordering-only determinism** for all agent workflows.

This means the orchestrator's primary responsibility is to enforce a canonical, deterministic **order of operations**. The runtime guarantees that the sequence of events, agent task dispatches, and state transitions is immutable and reproducible. It does *not* guarantee that the underlying byte-level memory layout or floating-point calculations are identical between runs.

The orchestrator guarantees:

*   **Deterministic Event Queue**: A single, global event queue with a fixed processing order.
*   **Deterministic Task Scheduling**: Agents are activated and tasks are dispatched in a predictable, repeatable sequence.
*   **Logical Clock**: Time-based events are driven by a synthetic, deterministic clock, not the system clock.

Agents must be written to be tolerant of micro-level numeric variances (e.g., in GPU-based ONNX inference), as long as the semantic outcome remains consistent.

## 3. Rationale

This approach provides the necessary guarantees for reproducibility without incurring the extreme costs of bit-level determinism.

*   **Aligns with the Single Scheduler Model**: Our architecture already has a central orchestrator, making it the natural authority for defining the global execution order. The scheduler's event log *is* the source of truth.
*   **Hardware Agnostic**: It allows for heterogeneous hardware (different CPUs, GPUs) without breaking reproducibility, as it abstracts away low-level physical differences.
*   **GPU Compatibility**: Forcing bit-level determinism is fundamentally incompatible with high-performance GPU computing via ONNX, which introduces nondeterminism in parallel operations. Ordering-only determinism preserves performance.
*   **Lower Engineering Overhead**: It avoids the need for complex and brittle solutions like deterministic memory allocators, fixed compiler versions, and strict floating-point modes.

## 4. Consequences

### Positive

*   Achieves the reproducibility goals of ADR-011 in a pragmatic way.
*   Maintains high performance, especially for GPU-bound tasks.
*   Simplifies agent development by providing a clear, order-based contract.
*   Enables deterministic replay via the orchestrator's event log.

### Negative / Trade-offs

*   Testing and validation must focus on semantic and state equivalence, not binary diffs.
*   Agents must be designed to be robust to minor floating-point variations.
*   Requires careful design of the orchestrator's central event loop and scheduler.

## 5. Considered Alternatives

### Alternative A: Bit-Level Determinism

*   **Description**: Enforce that every byte of output is identical between runs.
*   **Rejected Because**: As detailed in the rationale, this is practically impossible to achieve in a heterogeneous, high-performance environment with GPUs. The cost and complexity far outweigh the benefits, especially when a single scheduler already provides a canonical event order.

---

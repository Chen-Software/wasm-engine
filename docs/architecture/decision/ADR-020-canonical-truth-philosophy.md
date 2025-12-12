---
id: ADR-020
title: "Canonical Truth Philosophy"
status: "Proposed"
date: "2025-12-18"
owners: ["Engineering Team"]
reviewers: ["Engineering Team"]
related:
  - "ADR-000"
  - "ADR-010"
tags:
  - "truth"
  - "state"
  - "versioning"
  - "constitutional"
  - "runtime-philosophy"
---

# 1. Context

This ADR is a child of `ADR-000: Ontology of the Runtime Universe`. The ontology defines that `Events` and `State` exist, but it does not define the relationship between them or what constitutes the authoritative, "true" state of the system. In a distributed, multi-agent environment, having an unambiguous definition of truth is critical for consistency, reproducibility, and conflict resolution.

This document establishes the constitutional philosophy for what "truth" means within the runtime, how it is derived, and how it is versioned.

# 2. Decision

The runtime adopts an **event-sourced, immutable philosophy of truth**, defined by the following principles:

## 2.1 Events are the Source of Truth

*   The one and only source of canonical truth is the **ordered log of Events**.
*   The state of the universe is not the primary source of truth; it is a **derivative projection** of the event log. `State = f(Event Log)`.

## 2.2 State is a Cached Projection

*   State snapshots (e.g., in-memory objects, database records) are considered **materialized views or caches** of the event log. They exist for performance and convenience but are conceptually secondary.
*   If a state snapshot ever disagrees with the event log, the event log is always considered correct. The state must be discardable and perfectly reconstructible from the log.

## 2.3 Truth is Versioned and Immutable

*   The history of truth is immutable. New events are appended to the log, but existing events are never changed.
*   Every state snapshot is anchored to a specific point in the event log, typically identified by a **Git commit hash** or a sequential ID. This creates a versioned history of truth.

## 2.4 No Side Effects

*   There are no "back doors" to the truth. The only way to change the state of the universe is by introducing a new, sanctioned `Event` into the log through the official, deterministic channels. Direct mutation of state is forbidden.

# 3. Rationale

This philosophy is chosen for its robustness and alignment with the system's core principles of determinism and reproducibility.

*   **Auditability and Traceability**: An event log provides a perfect, immutable audit trail of every single change that has ever occurred in the system. This is invaluable for debugging, security, and compliance.
*   **Enables Deterministic Replay**: By replaying the event log, the exact state of the universe can be reconstructed at any point in time. This is a prerequisite for the reproducibility guarantees of ADR-011.
*   **Simplifies Concurrency**: An append-only log is a simpler concurrency primitive than a complex, mutable state model. It aligns well with distributed systems patterns and reduces the risk of race conditions.
*   **Temporal Queries**: It allows for powerful "time-travel" queries, enabling developers to inspect the state of the system as it existed in the past.

# 4. Consequences

## 4.1 Positive
*   Creates a highly reliable, auditable, and debuggable system.
*   Guarantees that state can always be reconstructed, preventing data corruption.
*   Provides a solid foundation for advanced features like event streaming, analytics, and federated consistency.

## 4.2 Negative
*   Can be more complex to implement initially compared to a simple mutable state model.
*   May require strategies like snapshotting to manage the performance of replaying very long event logs.
*   Requires developers to think in terms of events and commands, which can be a paradigm shift.

This ADR establishes the constitutional definition of truth within the runtime. All systems dealing with state, storage, or versioning must adhere to these principles.

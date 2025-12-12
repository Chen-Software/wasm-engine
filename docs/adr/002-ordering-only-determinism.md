---
id: ADR-002
title: "Ordering-Only Determinism"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
  - ADR-003
tags:
  - runtime
  - scheduler
  - deterministic-execution
---

# 1. Context

This ADR defines the scope of "determinism" for the runtime. See [ADR-001](001-shared-runtime-architecture.md) for the high-level decision to prioritize determinism.

# 2. Decision

The runtime will guarantee **Ordering-Only Determinism**. This means that for a given sequence of inputs, the scheduler will always execute agents in the exact same order, and messages will be delivered in the exact same order.

# 3. Rationale

This level of determinism is sufficient to guarantee reproducible system behavior, which is a primary product goal.

# 4. Consequences

- **Positive:** Enables full replayability of system logs.
- **Negative:** Does not guarantee bit-for-bit identical state across different hardware (e.g., floating point differences), but this is an accepted trade-off.

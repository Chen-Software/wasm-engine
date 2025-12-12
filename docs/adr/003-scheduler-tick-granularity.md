---
id: ADR-003
title: "Scheduler Tick Granularity"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
  - ADR-002
tags:
  - runtime
  - scheduler
---

# 1. Context

This ADR defines the logical tick duration for the deterministic scheduler (see [ADR-002](002-ordering-only-determinism.md)).

# 2. Decision

The scheduler will operate on logical ticks. The maximum number of tasks or agents to be processed per tick will be configurable.

# 3. Rationale

This provides a balance between predictable execution and system responsiveness.

# 4. Consequences

- **Positive:** Decouples the scheduler from wall-clock time, which is a source of non-determinism.
- **Negative:** Requires careful tuning to prevent long-running ticks from blocking the system.

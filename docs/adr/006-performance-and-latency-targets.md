---
id: ADR-006
title: "Performance & Latency Targets"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
tags:
  - runtime
  - performance
---

# 1. Context

This ADR defines the performance and latency targets for the runtime. A system designed for performance must have measurable goals.

# 2. Decision

The following targets are established for v1 of the runtime:
-   **Scheduler Tick Time:** 99th percentile tick time should be under 16ms for a workload of 100 concurrent agents.
-   **Inter-Agent Message Latency:** 99th percentile latency for a message to be brokered through the orchestrator should be under 1ms.
-   **Inference Latency:** This is highly model-dependent, but the overhead introduced by the runtime (queuing, data transfer) should not exceed 5ms on the 99th percentile.

# 3. Rationale

These targets provide a clear, measurable definition of "high-performance" for the initial version of the system.

# 4. Consequences

-   **Positive:** Aligns the engineering team on a concrete set of performance goals.
-   **Negative:** These targets may require significant optimization effort to achieve.

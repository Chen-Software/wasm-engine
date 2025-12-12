---
id: ADR-013
title: "DAG Scheduler v2 Guidelines"
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

While the v1 scheduler will be based on priority and round-robin modes (see [ADR-001](001-shared-runtime-architecture.md)), a future version (v2) is envisioned to support more complex, dependency-based scheduling using a Directed Acyclic Graph (DAG).

# 2. Decision

-   **Task Objects:** The v1 scheduler's API will be designed with a forward-looking "task object" model. In v1, these objects will be simple, but the structure will be extensible to include dependency information in v2.
-   **Dependency Definition:** In v2, a task object will be able to declare a list of other task IDs that must be completed before it can be scheduled.
-   **No Change to Determinism:** The DAG scheduler must still adhere to the strict ordering and determinism guarantees defined in [ADR-002](002-ordering-only-determinism.md).

# 3. Rationale

-   **Future-Proofing:** Designing the v1 API with v2 in mind will make the future transition to a DAG scheduler much smoother and less disruptive.
-   **Expressiveness:** A DAG scheduler will enable the creation of much more complex and efficient multi-agent workflows.

# 4. Consequences

-   **Positive:** Provides a clear evolution path for a key component of the runtime.
-   **Negative:** Adds some minor complexity to the v1 scheduler design to accommodate the future extension points.

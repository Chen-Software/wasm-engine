---
id: ADR-009
title: "Model Caching & GPU Memory Policy"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
tags:
  - runtime
  - onnx
  - memory-management
---

# 1. Context

To avoid the high cost of loading ML models from disk and initializing them on the GPU for every inference request, the runtime needs a caching and memory management policy.

# 2. Decision

-   **Model Caching:** The orchestrator will maintain an in-memory, Least Recently Used (LRU) cache of loaded ONNX models. The size of this cache will be configurable.
-   **GPU Memory Policy:** The orchestrator will be responsible for managing GPU memory. It will pre-load a configurable set of "hot" models at startup and will manage the loading and unloading of other models based on the LRU policy.

# 3. Rationale

-   **Performance:** Caching dramatically reduces inference latency for frequently used models.
-   **Stability:** Centralized management of GPU memory by the orchestrator prevents conflicts and out-of-memory errors that could arise if individual agents managed their own models.

# 4. Consequences

-   **Positive:** Significant improvement in average inference latency.
-   **Negative:** Increased RAM/VRAM usage. Requires careful tuning of the cache size and pre-loading strategy to balance performance and resource consumption.

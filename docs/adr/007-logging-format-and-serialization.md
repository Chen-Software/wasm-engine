---
id: ADR-007
title: "Logging Format & Serialization"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
  - ADR-002
tags:
  - runtime
  - logging
  - deterministic-execution
---

# 1. Context

To support deterministic replay (see [ADR-002](002-ordering-only-determinism.md)), the runtime must have a strictly defined logging and serialization format for all events and messages.

# 2. Decision

-   **Serialization Format:** All logged events (agent inputs, scheduler decisions, messages) will be serialized using `JSON`. While less performant than binary formats, it is human-readable and universally supported, which is critical for debugging.
-   **Log Content:** Logs will contain a timestamp, the source of the event, and a payload. All floating-point numbers will be serialized to a fixed precision to mitigate cross-platform variations.

# 3. Rationale

-   **Reproducibility:** A strict, consistent serialization format is the cornerstone of a deterministic replay system.
-   **Debuggability:** JSON provides a good balance between the strictness needed for replay and the human-readability needed for effective debugging.

# 4. Consequences

-   **Positive:** Enables robust replay and debugging capabilities.
-   **Negative:** JSON serialization can be a performance bottleneck if not managed carefully. Logging may need to be buffered and flushed asynchronously.

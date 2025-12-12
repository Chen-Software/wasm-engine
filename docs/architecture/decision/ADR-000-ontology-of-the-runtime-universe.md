---
id: ADR-000
title: "Ontology of the Runtime Universe"
status: "Approved"
date: "2025-12-19"
tags:
  - "ontology"
  - "constitutional"
  - "foundational"
  - "runtime-philosophy"
related:
  ADRs:
    - "ADR-010: Determinism Philosophy of the Runtime"
    - "ADR-020: Canonical Truth Philosophy"
    - "ADR-030: Agent Isolation Philosophy"
  TDRs:
    - "TDR-001: Runtime Universe Core"
    - "TDR-002: Tick / Time Manager"
    - "TDR-003: Event System"
    - "TDR-004: State & Versioning"
    - "TDR-005: Resource / External Interface"
    - "TDR-006: Agent Runtime"
    - "TDR-007: Identity & Naming"
    - "TDR-008: Dependency / Relationship"
    - "TDR-009: Boundaries & Isolation"
---

# 1. Context

This ADR defines the **foundational ontology of the runtime universe**. It is the constitutional source of truth that specifies the conceptual existence of all core entities, their relationships, and the system's fundamental laws. Before we can define how the system behaves (Execution, ADR-010) or what is true (Truth, ADR-020), we must first define what exists.

This document serves as the single, authoritative reference for all subsequent architectural philosophies (ADRs) and implementation blueprints (TDRs), ensuring that the entire system is built on a coherent and consistent conceptual model.

# 2. Decision

The runtime universe is conceptualized through the following ontological principles:

1.  **Entities**: The universe is composed of fundamental actors, including **Agents**, **Events**, **Resources**, and **Ticks**.
2.  **Time (Ticks)**: Time is discrete and advances in atomic steps called **Ticks**, which provide the canonical ordering for all Events and operations.
3.  **Events**: All changes within the universe are represented by **immutable, ordered records** known as Events.
4.  **State**: The state of the universe is a **derivative of the accumulated Event log**. State is conceptually immutable, and each version is uniquely identified.
5.  **Resources & External Interfaces**: All interactions with the non-deterministic world outside the universe are mediated through controlled **Resources**.
6.  **Agents**: Agents are **autonomous entities** capable of perceiving the universe's State and generating Events.
7.  **Identity & Relationships**: Every entity possesses a **stable, deterministic identity**. Causal and dependency relationships between entities are formally defined.
8.  **Boundaries & Isolation**: A hard **conceptual boundary** separates the internal, deterministic universe from the external world, and also isolates individual Agents from one another.

# 3. Rationale

This ontological model is chosen for several key reasons:

*   **Foundational Clarity**: It provides a single source of truth for all technical design, eliminating ambiguity.
*   **Enables Determinism**: The explicit modeling of Ticks, Events, and Identity is a prerequisite for deterministic execution and replay.
*   **Supports Extensibility**: The clear definition of entities allows for the future introduction of new agent or resource types without violating the core architecture.
*   **Provides Traceability**: It enables all implementation components in the TDRs to be traced directly back to a foundational principle.

# 4. Implementation via Technical Design Records (TDRs)

The ontology defined in this ADR is made concrete through the following Technical Design Records (TDRs), which provide the blueprints for implementation:

| TDR     | Derived Concept              | Focus & Core Components                                         |
| :------ | :--------------------------- | :-------------------------------------------------------------- |
| TDR-001 | Runtime Universe Core        | System-wide runtime, entity registry, logging, universal ID service. |
| TDR-002 | Tick / Time Manager          | Tick counter, scheduler, tick queue, synchronization interfaces. |
| TDR-003 | Event System                 | Event store, dispatcher, immutable and replayable events, serialization. |
| TDR-004 | State & Versioning           | State storage, snapshot manager, hash generator, version resolver. |
| TDR-005 | Resource / External Interface | Resource registry, API adapters, sandboxed inputs/outputs. |
| TDR-006 | Agent Runtime                | Agent loader, lifecycle manager, capability enforcement, event interface. |
| TDR-007 | Identity & Naming            | Deterministic ID generation, name resolution, global identity registry. |
| TDR-008 | Dependency & Relationship    | Causal graph, lineage tracking, DAG manager, dependency resolver. |
| TDR-009 | Boundaries & Isolation       | Conceptual isolation enforcement, sandbox manager, capability monitor. |

# 5. Consequences

*   All TDRs and their resulting implementations trace directly to a single conceptual foundation, ensuring system-wide consistency.
*   Future architectural decisions are constrained by this ontology, guaranteeing that the system's core principles are not violated.
*   The clear hierarchy facilitates engineering reviews and automated verification, as each TDR can be validated against this parent ADR.

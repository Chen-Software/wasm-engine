---
id: ADR-000
title: "Ontology of the Runtime Universe"
status: "Proposed"
date: "2025-12-18"
owners: ["Engineering Team"]
reviewers: ["Engineering Team"]
related:
  - "ADR-010"
  - "ADR-020"
  - "ADR-030"
tags:
  - "ontology"
  - "philosophy"
  - "runtime-principles"
  - "foundational"
---

# 1. Context

Before defining how the system behaves (Execution), what is true (Truth), or how its inhabitants act (Agents), we must first define what exists. This Architecture Decision Record establishes the fundamental ontology of the runtime universe. It is the most abstract and foundational document, defining the essential "matter" and "laws of physics" from which all other architectural principles are derived.

Every complex system has an implicit ontology. By making it explicit, we provide a stable, universal vocabulary and a coherent model for all subsequent design decisions, ensuring that the entire architecture is built upon a single, consistent worldview.

# 2. Decision

The runtime universe is composed of a fixed set of primitive entities and is governed by a core set of ontological laws.

## 2.1 Core Entities

The universe consists of the following, and only the following, types of entities:

*   **Agents**: Autonomous, stateful entities that perform actions.
*   **Events**: Immutable records of occurrences that drive all state changes.
*   **State Snapshots**: Complete, versioned representations of the universe's state at a point in time, anchored to a Git commit.
*   **Message Queues**: Ordered, deterministic channels for delivering events to agents.
*   **Resources**: External or internal capabilities that agents can access via deterministic wrappers (e.g., a file handle, a model inference session).

## 2.2 Ontological Laws

The universe operates according to these fundamental laws:

*   **Discrete Time**: Time does not flow continuously. It advances in discrete, logical steps called **ticks**. All operations are aligned with this tick-based timeline.
*   **Modeled Reality**: The state of the universe is not an accident of execution; it is a pure, mathematical function of `(commit, event sequence)`. There is no other source of truth.
*   **Immutable History**: The past is fixed. Events, once recorded in the event sequence, cannot be altered. All state changes are the result of applying new events to the previous state.
*   **The Great Divide**: A hard boundary exists between the internal, deterministic universe and the external, nondeterministic multiverse. Everything *outside* the universe (e.g., network, disk I/O, system clock) is considered inherently chaotic and **must** be accessed through a wrapper that converts its effects into deterministic events.

# 3. Rationale

This ontology is chosen to create a system that is predictable, reproducible, and analyzable by design.

*   **Eliminates Ambiguity**: By defining a closed set of entities, it prevents the introduction of unforeseen or "magical" components that could violate architectural principles.
*   **Enables Formal Reasoning**: The `state = f(commit, events)` model allows the system to be treated as a formal, mathematical construct, which is the foundation for determinism and reproducibility.
*   **Provides a Stable Foundation**: All higher-level concepts like "truth" (ADR-020) and "execution" (ADR-010) have a concrete set of entities to act upon. This prevents them from becoming abstract and untethered from the implementation.
*   **Safety by Default**: The explicit boundary between the deterministic interior and the chaotic exterior forces a disciplined approach to I/O and side effects, which is a primary source of bugs in complex systems.

# 4. Consequences

## 4.1 Positive
*   Provides a simple, powerful, and consistent mental model for all developers.
*   Makes the system's behavior formally verifiable and testable.
*   Establishes the necessary preconditions for deterministic replay and all other constitutional principles.
*   Serves as a clear guide for what can and cannot be built within the core runtime.

## 4.2 Negative
*   Imposes a very rigid structure on the system's architecture. All new features must conform to this ontology.
*   Requires upfront design work to create the deterministic wrappers for all external interactions.

This ADR is the ultimate root of the system's architectural constitution. All other ADRs in the `0xx` series are its direct or indirect children.

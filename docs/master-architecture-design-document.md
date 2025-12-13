# Master Architecture Design Document

**Status:** Approved
**Version:** 3.0
**Date:** 2025-12-17

---

## 1. Overview

This document provides a high-level overview of the `wasm-engine` shared runtime. It serves as a master index for the **Architecture Decision Records (ADRs)** that define the system's design.

The authoritative technical contract for implementation is the **[Authoritative Technical Specification Document (ATSD)](./atsd-multi-agent-runtime.md)**, which synthesizes these ADRs into a formal specification.

The primary goal of this architecture is to create a **local-first, deterministic, multi-agent runtime**. For a full breakdown of the product vision and requirements, please see the **[Product Requirements Document (PRD)](./prd-local-first-multi-agent-runtime.md)**.

## 2. High-Level System Diagram
```mermaid
graph TD
    subgraph Core Runtime
        O["Node.js Orchestrator<br>Deterministic Scheduler<br>State & IPC Hub"]
        W["WASM Worker Pool<br>(Agent Logic)"]
        ONNX["ONNX Runtime<br>(GPU/CPU Accelerator)"]
    end

    subgraph Optional Components
        UI["UI Process<br>(Read-Only State Observer)"]
    end

    O -->|Manages Lifecycle| W
    O -->|Routes Inference Requests| ONNX
    W -->|Sends Messages| O
    ONNX -->|Returns Results| O
    O -->|Streams State (Read-Only)| UI
```

## 3. Core Components

The runtime is a hybrid system composed of three primary components:

1.  **Node.js Orchestrator:** The central hub of the system. It is responsible for:
    -   Running the deterministic scheduler.
    -   Managing the lifecycle of all agents.
    -   Brokering all inter-agent communication.
    -   Routing ML inference requests to the ONNX Runtime.

2.  **WASM Worker Pool:** Executes all agent logic. Each agent runs in a sandboxed, memory-isolated WASM module, ensuring security and stability.

3.  **ONNX Runtime:** Handles all ML inference tasks. It provides a unified API for leveraging GPU acceleration where available, while ensuring deterministic fallback to CPU.

## 4. Architecture Decision Records (ADRs)

The specific design and rationale for each part of the architecture are detailed in the following ADRs.

---
adr_index:
  - id: ADR-001
    title: "Shared Runtime (Node.js + WASM + ONNX)"
    status: "Approved"
    scope: "Core orchestrator, CPU/GPU execution, optional UI"
    link: "./adr/001-shared-runtime-architecture.md"

  - id: ADR-002
    title: "Ordering-Only Determinism"
    status: "Proposed"
    scope: "Scheduler & replay determinism"
    link: "./adr/002-ordering-only-determinism.md"

  - id: ADR-003
    title: "Scheduler Tick Granularity"
    status: "Proposed"
    scope: "Logical tick duration, max tasks per tick"
    link: "./adr/003-scheduler-tick-granularity.md"

  - id: ADR-004
    title: "Shared Memory Ownership Rules"
    status: "Approved"
    scope: "Single-writer, multi-reader policies"
    link: "./adr/004-shared-memory-ownership-rules.md"

  - id: ADR-005
    title: "Plugin Signing & ABI Enforcement"
    status: "Proposed"
    scope: "Module security and ABI versioning"
    link: "./adr/005-plugin-signing-and-abi-enforcement.md"

  - id: ADR-006
    title: "Performance & Latency Targets"
    status: "Proposed"
    scope: "Metrics for CPU/GPU and messaging"
    link: "./adr/006-performance-and-latency-targets.md"

  - id: ADR-007
    title: "Logging Format & Serialization"
    status: "Proposed"
    scope: "Deterministic event serialization"
    link: "./adr/007-logging-format-and-serialization.md"

  - id: ADR-008
    title: "Optional UI Framework"
    status: "Approved"
    scope: "Servo vs Electron usage, decoupling"
    link: "./adr/008-optional-ui-framework.md"

  - id: ADR-009
    title: "Model Caching & GPU Memory Policy"
    status: "Proposed"
    scope: "LRU caching, preloading heuristics"
    link: "./adr/009-model-caching-and-gpu-memory-policy.md"

  - id: ADR-010
    title: "Agent SDK & Toolchain"
    status: "Proposed"
    scope: "Languages, debugging, compliance tools"
    link: "./adr/010-agent-sdk-and-toolchain.md"

  - id: ADR-011
    title: "Fault Injection & Stress Testing"
    status: "Proposed"
    scope: "Crash recovery and validation scenarios"
    link: "./adr/011-fault-injection-and-stress-testing.md"

  - id: ADR-012
    title: "Cross-Platform Build & Packaging"
    status: "Proposed"
    scope: "Platform-specific artifacts and dependencies"
    link: "./adr/012-cross-platform-build-and-packaging.md"

  - id: ADR-013
    title: "DAG Scheduler v2 Guidelines"
    status: "Proposed"
    scope: "Task objects, dependencies, v2 extensions"
    link: "./adr/013-dag-scheduler-v2-guidelines.md"
---

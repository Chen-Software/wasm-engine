# wasm-engine

## A Shared Runtime for Local-First Multi-Agent Orchestration

### 1. Overview

`wasm-engine` is the shared execution runtime for a **local-first, multi-agent system**. Its purpose is to provide a unified, stable, and deterministic contract for agent lifecycle, scheduling, communication, and compute. The runtime is designed to operate in fully headless environments and ensures that identical input sequences yield identical system behavior, making it a predictable and reproducible substrate for complex AI systems.

This project is currently in the **blueprint phase**. The architecture is well-defined in the accompanying documentation, which serves as a guide for its implementation.

### 2. Core Principles & Invariants

The runtime is built on a set of non-negotiable architectural guarantees:

-   **Deterministic Execution:** All scheduling is deterministic. The exact same sequence of inputs will produce the exact same global state evolution, every time.
-   **Agent Isolation:** Agents (CPU-bound logic) execute in a sandboxed WASM environment. They are memory-isolated and cannot communicate directly with each other. All communication is brokered by the central orchestrator.
-   **Local-First & Headless-First:** The runtime has no dependency on cloud connectivity and is designed to operate without a graphical interface. UI is an optional, decoupled, read-only observer.
-   **Unified Compute Abstraction:** GPU-accelerated inference is provided opportunistically via ONNX Runtime. The runtime guarantees that the system's functional behavior remains identical when falling back to CPU.

### 3. Project Documentation

This repository contains the foundational documents that define the project's vision, architecture, and requirements.

-   **[Product Requirements Document (PRD)](./docs/prd-local-first-multi-agent-runtime.md):** Defines the "what" and "why." It outlines the product goals, non-goals, and the key invariants of the runtime.
-   **[Architecture Design Document (ADD)](./docs/ADD-electron-servo-wasm.md):** Defines the "how." This document details the technical implementation strategy, including the advanced patterns for memory management, threading, and communication.
-   **[Technical Analysis Report](./docs/llm-inference-architecture-analysis.md):** Provides the context and justification for the chosen architectural path by analyzing various alternatives for local LLM inference.
-   **[Critique of the PRD](./docs/prd-critique.md):** An architectural review of the product requirements, validating the design and identifying potential risks.

### 4. High-Level Roadmap

1.  **Build & Integration:** Set up the build pipelines for Rust (Servo, WASM) and integrate the required native libraries (e.g., ONNX Runtime) into the orchestrator.
2.  **Scheduler & Lifecycle:** Implement the deterministic scheduler and the core agent lifecycle management APIs.
3.  **Memory & Communication:** Implement the shared memory manager and the orchestrator-brokered messaging system.
4.  **Reference Implementation:** Create a minimal, end-to-end "hello world" multi-agent system to validate the core invariants.

### 5. Directory Structure
```
.
├── apps/                 # Main application code (e.g., Electron-based UI)
├── docs/                 # All project documentation (PRD, ADD, etc.)
├── packages/             # Reusable modules (e.g., WASM agent ABI)
└── README.md
```

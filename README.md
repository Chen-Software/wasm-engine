# wasm-engine

## A Shared Runtime for Local-First Multi-Agent Orchestration

### 1. Overview

`wasm-engine` is the shared execution runtime for a **local-first, multi-agent system**. Its purpose is to provide a unified, stable, and deterministic contract for agent lifecycle, scheduling, communication, and compute. The runtime is designed to operate in fully headless environments and ensures that identical input sequences yield identical system behavior, making it a predictable and reproducible substrate for complex AI systems.

This project is currently in the **blueprint phase**. The architecture is well-defined in the accompanying documentation, which serves as a guide for its implementation.

### 2. Core Principles & Invariants

The runtime is built on a set of non-negotiable architectural guarantees, as detailed in our **[Architecture Decision Records (ADRs)](./docs/adr/)**. Key principles include:

-   **Deterministic Execution:** All scheduling is deterministic to ensure reproducibility.
-   **Agent Isolation:** Agents execute in a sandboxed WASM environment with no direct system access.
-   **Local-First & Headless-First:** The runtime has no dependency on cloud connectivity and is designed to operate without a UI.
-   **Unified Compute Abstraction:** ML inference is handled via ONNX Runtime to provide a consistent API for both CPU and GPU.

### 3. Project Documentation

This repository is structured around a set of core documents that define the project's vision, architecture, and requirements.

-   **[Master Architecture Design Document](./docs/master-architecture-design-document.md):** The primary entry point for understanding the high-level system architecture. It provides an overview of the core components and contains the master index of all Architecture Decision Records (ADRs).
-   **[Architecture Decision Records (ADRs)](./docs/adr/):** A directory containing the detailed rationale for every significant architectural decision in the project.
-   **[Product Requirements Document (PRD)](./docs/prd-local-first-multi-agent-runtime.md):** Defines the "what" and "why" of the project, outlining goals, non-goals, and key invariants.

### 4. High-Level Roadmap

1.  **Implement Core ADRs:** Implement the designs specified in the "Approved" ADRs, including the core runtime, scheduler, and memory management.
2.  **Develop Agent SDK:** Build out the Rust-based SDK to enable agent development.
3.  **Reference Implementation:** Create a minimal, end-to-end multi-agent system to validate the core invariants.

### 5. Directory Structure
```
.
├── apps/                 # Optional UI applications
├── docs/                 # All project documentation
│   ├── adr/              # Architecture Decision Records
│   ├── master-architecture-design-document.md
│   └── prd-local-first-multi-agent-runtime.md
├── packages/             # Reusable modules (e.g., Agent SDK)
└── README.md
```

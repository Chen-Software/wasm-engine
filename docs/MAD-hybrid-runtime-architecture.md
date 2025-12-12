---
title: Hybrid Local-First Runtime Architecture for Multi-Agent Systems and WebLLM
status: Revised / Engineering Review
date: 2025-12-13
authors: [Jules]
---

# 1. Overview

This document describes the revised high-level technical architecture of a local-first hybrid runtime for multi-agent orchestration and LLM inference. The core change is the adoption of ONNX Runtime for GPU compute to ensure deterministic scheduling and robust headless operation, a critical requirement for multi-agent systems.

**Objectives**:
1.  Enable CPU-bound tasks (agent logic) with safe sandboxing via **WASM**.
2.  Enable GPU-bound tasks (LLM inference) using a reliable, cross-platform solution: **ONNX Runtime**.
3.  Provide deterministic, turn-based orchestration for multiple agents.
4.  Support an **optional, decoupled UI** for monitoring without interfering with the core runtime.
5.  Ensure robust headless operation with no cloud dependencies.

---

# 2. Architectural Principles
-   **Deterministic Orchestration**: The Electron/Node.js main process acts as a central orchestrator, managing a predictable task queue for all agents.
-   **Hybrid Execution**: CPU-bound tasks are executed by WASM workers; GPU-bound tasks are offloaded to the ONNX Runtime.
-   **Sandboxing & Isolation**: Agents running in WASM workers are isolated. The ONNX runtime manages its own execution context, separate from the main orchestrator.
-   **Shared Memory**: Zero-copy shared buffers are used for efficient data exchange between the orchestrator, WASM workers, and the ONNX runtime.
-   **Decoupled UI**: The visualization layer (e.g., implemented with Servo) is optional and does not participate in the core computation loop, preventing UI-related performance issues.

---

# 3. Core Components

| Component | Role / Responsibility |
| :--- | :--- |
| **Electron/Node.js Runtime** | The primary runtime. The Node.js process orchestrates agent tasks, manages the task queue, and allocates shared memory. |
| **Main Orchestrator** | A module within the main process that implements deterministic, turn-based scheduling for agents. |
| **WASM Worker Pool** | Executes CPU-bound agent logic in isolated worker threads. Communicates via shared memory buffers. |
| **ONNX Runtime** | Manages and executes GPU-bound inference tasks. Provides automatic CPU fallback, ensuring headless operation is reliable. |
| **Shared Memory Buffers** | Enables low-latency, zero-copy data transfer between the orchestrator, WASM workers, and the ONNX Runtime. |
| **Optional UI (Servo)** | A completely decoupled component for advanced real-time visualization of agent states and runtime metrics. |

---

# 4. Data and Task Flow

```mermaid
flowchart TB
    subgraph Core Runtime
        Orchestrator[Main Orchestrator (Electron/Node.js)]
        WorkerPool[WASM Workers (CPU Tasks)]
        ONNX[ONNX Runtime (GPU Tasks)]
        SharedMem[Shared Memory Buffers]
    end

    subgraph Optional Decoupled UI
        ServoUI[Servo for Visualization]
    end

    Orchestrator --> WorkerPool
    WorkerPool --> SharedMem
    Orchestrator --> ONNX
    ONNX --> SharedMem
    Orchestrator -- Observes --> SharedMem
    Orchestrator -- Pushes State --> ServoUI
```

**Explanation**:
1.  **Task Scheduling**: The Orchestrator dequeues a task for an agent.
2.  **CPU Execution**: CPU-bound logic is sent to a WASM worker, which writes results to a shared memory buffer.
3.  **GPU Execution**: If the task requires LLM inference, the Orchestrator passes the relevant data (via shared memory) to the ONNX Runtime for execution.
4.  **Deterministic Control**: The Orchestrator waits for the current task to complete (either from WASM or ONNX) before scheduling the next task, ensuring a predictable execution order.
5.  **UI Updates**: The Orchestrator can optionally push state updates to the Servo UI for visualization.

---

# 5. Component Interactions
1.  **Orchestrator ↔ WASM Workers**: The orchestrator dispatches tasks and memory buffers to workers and is notified upon completion.
2.  **Orchestrator ↔ ONNX Runtime**: The orchestrator initiates inference sessions with the ONNX Runtime, passing input tensors and receiving outputs via shared memory.
3.  **Orchestrator ↔ Optional UI (Servo)**: The orchestrator sends read-only data or metrics to the UI layer for visualization. The UI has no direct access to the computation pipeline.

---

# 6. Threading and Concurrency Model
-   **Electron Main Process**: Single-threaded event loop for orchestration, ensuring deterministic task scheduling.
-   **WASM Worker Threads**: A pool of isolated threads for parallel execution of CPU-bound agent logic.
-   **ONNX Runtime Threads**: Manages its own internal thread pool for executing GPU kernels and coordinating device memory transfers.
-   **Servo UI Thread**: If used, Servo runs in its own process/thread, completely decoupled from the core runtime's threads.

---

# 7. Headless vs Non-Headless Operation

| Mode | Role of Components |
| :--- | :--- |
| **Non-Headless (with UI)** | The full stack is active: Electron/Node.js orchestrator, WASM workers, ONNX Runtime, and the optional Servo UI for visualization. |
| **Headless (no UI)** | The core runtime (Orchestrator, WASM, ONNX) runs without any UI. ONNX's CPU fallback ensures it operates reliably even without a GPU context. |

---

# 8. Design Considerations / Constraints
-   **ONNX Runtime Dependency**: The build and packaging process must include the ONNX Runtime library for all target platforms.
-   **Deterministic Scheduling**: The orchestrator must be carefully designed to prevent race conditions and ensure a strict, turn-based execution flow for agents.
-   **Shared Memory Management**: Requires robust synchronization mechanisms (`Atomics`) to prevent data corruption between processes.
-   **UI Decoupling**: The interface between the orchestrator and the optional Servo UI must be strictly enforced to prevent the UI from impacting runtime performance.

---

# 9. Summary

This revised Master Architecture provides:
-   A **deterministic and reliable** runtime for multi-agent orchestration using Electron/Node.js.
-   High-performance CPU and GPU execution via **WASM workers** and the **ONNX Runtime**.
-   Guaranteed support for **headless operation**.
-   A clear separation between the core runtime and an **optional, decoupled visualization layer (Servo)**.

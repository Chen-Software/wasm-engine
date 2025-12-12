# Master Architecture Design (MAD)

**Title**: Hybrid Local-First Runtime Architecture for Multi-Agent Systems and WebLLM
**Status**: Proposed / Engineering Review
**Date**: 2025-12-12

---

## Related Documents

- **[ADR-001: Hybrid Runtime Architecture](./ADR-001-hybrid-runtime-architecture.md)**: Justification for the chosen hybrid of Electron, ONNX Runtime, and WASM.

---

## 1. Overview

This document describes the high-level technical architecture of a local-first hybrid runtime for multi-agent orchestration and LLM inference. The architecture is designed for deterministic, high-performance execution in both headless and non-headless (UI-enabled) modes.

**Objectives**:
1.  Enable CPU-bound tasks (e.g., agent logic) with safe sandboxing via **WebAssembly (WASM)**.
2.  Enable GPU-accelerated LLM inference via **ONNX Runtime**, with automatic CPU fallback.
3.  Provide deterministic, reproducible orchestration of multi-agent tasks.
4.  Support an optional, decoupled UI for monitoring and visualization.
5.  Ensure robust, cross-platform, local-first execution with no cloud dependencies.

---

## 2. Architectural Principles

-   **Hybrid Compute**: CPU-bound tasks are executed by WASM workers, while GPU-bound inference is handled by ONNX Runtime.
-   **Deterministic Orchestration**: A central Node.js/Electron orchestrator manages a deterministic task queue for all agent actions and inference requests.
-   **Production-Grade GPU Inference**: Leverages the stability and cross-platform support of ONNX Runtime for GPU acceleration, avoiding experimental technologies for core compute.
-   **Decoupled UI**: The optional UI layer (Electron or Servo-enhanced) is fully decoupled from the compute plane, ensuring that monitoring does not interfere with agent execution.
-   **Safety and Isolation**: WASM provides sandboxing for agent logic, while the ONNX Runtime is a proven, secure inference engine.

---

## 3. Core Components

| Component                          | Role / Responsibility                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Node.js / Electron Runtime**     | The primary host process. Provides the event loop, Node.js APIs, and orchestrates all other components.                 |
| **Main Orchestrator (in Node.js)** | Manages a deterministic task scheduler, coordinates IPC between components, and handles state management.               |
| **WASM Worker Pool**               | Executes CPU-bound agent logic in sandboxed, isolated worker threads. Communicates via message passing or shared memory. |
| **ONNX Runtime**                   | Executes LLM inference on GPU (e.g., CUDA, TensorRT) with automatic and reliable fallback to CPU.                       |
| **Optional UI / Monitoring Layer** | An Electron-based UI for visualizing agent state and system metrics. May embed **Servo** for advanced, GPU-accelerated visualizations. |
| **Shared Memory / Buffers**        | Used for efficient, low-latency data exchange between the orchestrator, WASM workers, and the ONNX Runtime.            |

---

## 4. Data and Task Flow

```mermaid
flowchart TB
    subgraph "Local-First Runtime"
        Orchestrator[Main Orchestrator (Node.js/Electron)]
        WorkerPool[WASM Workers (CPU Agent Logic)]
        ONNX[ONNX Runtime (GPU/CPU Inference)]
        SharedMem[Shared Memory Buffers]
        UI[Optional UI Layer]
    end

    Orchestrator -- "Schedules CPU Task" --> WorkerPool
    WorkerPool -- "Writes Results" --> SharedMem
    Orchestrator -- "Schedules GPU Task" --> ONNX
    ONNX -- "Writes Results" --> SharedMem

    WorkerPool -- "Requests Inference" --> Orchestrator

    UI -- "Reads State for Visualization" --> Orchestrator

```

**Explanation**:
1.  **Task Scheduling**: The **Orchestrator** receives tasks (e.g., execute agent logic, perform LLM inference).
2.  **CPU Tasks**: Agent logic is dispatched to the **WASM Worker Pool**. Workers execute the logic and write results to **Shared Memory**. If an agent needs to perform inference, it sends a request back to the orchestrator.
3.  **GPU Tasks**: The orchestrator sends inference requests to the **ONNX Runtime**, which executes the model on the appropriate device (GPU or CPU) and writes the output to **Shared Memory**.
4.  **Result Aggregation**: The orchestrator reads results from shared memory to coordinate the next steps in the agent lifecycle.
5.  **UI Visualization**: The optional **UI Layer** reads state from the orchestrator via IPC to provide monitoring without impacting the compute loop.

---

## 5. Component Interactions

-   **Orchestrator ↔ WASM Workers**:
    -   The orchestrator uses a deterministic scheduler (e.g., round-robin) to assign tasks to WASM workers.
    -   Communication occurs via message channels (`postMessage`) or a carefully managed `SharedArrayBuffer` with `Atomics` for synchronization.
-   **Orchestrator ↔ ONNX Runtime**:
    -   The orchestrator serializes inference requests to ensure deterministic execution order.
    -   It passes input tensors (often located in shared memory) to ONNX and receives output tensors.
-   **Optional UI ↔ Orchestrator**:
    -   The UI is a read-only consumer of state. It requests data from the orchestrator via IPC and renders it. It does not have direct access to the compute components.

---

## 6. Headless vs. Non-Headless Operation

| Mode                       | Role of Components                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------- |
| **Non-Headless (with UI)** | The full stack is active: Electron hosts the orchestrator, compute runtimes, and the UI. |
| **Headless (no UI)**       | The Electron/Node.js process runs without a window. The UI layer is never initialized, saving resources. The core orchestrator, WASM pool, and ONNX Runtime function identically. |

---

## 7. Summary

This Master Architecture provides a robust, stable, and high-performance hybrid runtime for local-first multi-agent systems:
-   It leverages production-ready technologies for its core compute functions (**WASM** and **ONNX Runtime**).
-   It ensures deterministic and reproducible agent behavior through a centralized orchestrator.
-   It supports both headless and UI-integrated modes, with a clear separation between computation and visualization.

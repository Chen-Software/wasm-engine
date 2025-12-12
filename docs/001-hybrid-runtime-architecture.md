---
status: Revised
date: 2025-12-13
authors: [Jules]
version: 2.0
---

# Architecture Decision Record (ADR)

**Title**: Hybrid Runtime Architecture for Local-First Multi-Agent and WebLLM Compute

---

## 1. Context

This ADR revises the previous decision regarding the GPU compute runtime. The goal remains to build a local-first, high-performance runtime for multi-agent orchestration and local LLM inference. However, a technical assessment revealed that Servo is unsuitable for the core runtime due to concerns about deterministic scheduling and safety in a multi-agent context.

The runtime must:
1.  Support CPU-bound computation (agent logic, inference) efficiently and safely.
2.  Support GPU-bound computation (matrix-heavy operations) reliably and deterministically.
3.  Operate in a headless mode without requiring a UI or rendering context.
4.  Ensure deterministic scheduling, low-latency communication, and safe sandboxing for multiple agents.

---

## 2. Decision

Adopt a hybrid runtime architecture orchestrated by **Electron/Node.js** that combines:
1.  **Electron/Node.js** as the primary runtime for deterministic task scheduling and orchestration.
2.  **WebAssembly (WASM)** modules running in worker threads for CPU-bound agent logic.
3.  **ONNX Runtime** for GPU-bound inference tasks, providing reliable execution and automatic CPU fallback.
4.  **Servo** as an **optional and decoupled UI layer** for advanced visualizations only. It will not participate in the core agent computation or orchestration pipeline.

---

## 3. Rationale

The decision is based on the need for a deterministic and safe shared runtime, which Electron/Node.js provides, while the previous choice (Servo) introduced significant risks.

| Requirement | Why this approach |
| :--- | :--- |
| **Deterministic Scheduling** | The Node.js event loop, controlled by a central orchestrator, allows for predictable, turn-based scheduling of agent tasks. |
| **Safe Shared Memory / IPC** | Node.js provides robust mechanisms to safely coordinate `SharedArrayBuffer` and `Atomics` between WASM workers. |
| **Concurrency Control** | The orchestrator can manage explicit task queues for both CPU (WASM) and GPU (ONNX) workloads, preventing conflicts. |
| **Headless Support** | Node.js is designed for headless operation. ONNX Runtime's CPU fallback ensures GPU tasks can run without a rendering context. |
| **Reliable GPU Compute** | ONNX Runtime is a mature, cross-platform library for GPU inference that guarantees deterministic execution. |

---

## 4. Architecture Overview

The core runtime consists of the Electron/Node.js orchestrator, WASM workers for CPU tasks, and ONNX Runtime for GPU tasks. Servo is an optional, external component for UI only.

```mermaid
flowchart LR
    subgraph Core Runtime (Electron/Node.js)
        MainProcess[Main Orchestrator]
        WorkerPool[WASM Worker Pool for CPU tasks]
        ONNXRuntime[ONNX Runtime for GPU tasks]
        SharedMem[Shared Memory / Buffers]
    end

    subgraph Optional UI
        ServoUI[Servo for Visualization]
    end

    MainProcess --> WorkerPool
    WorkerPool --> SharedMem
    MainProcess --> ONNXRuntime
    ONNXRuntime --> SharedMem
    MainProcess --> ServoUI
```

---

## 5. Consequences

**Benefits**:
-   **Deterministic Orchestration**: Ensures reproducible behavior for multi-agent systems.
-   **High Reliability**: Uses mature technologies (Node.js, WASM, ONNX) for the core runtime.
-   **Robust Headless Mode**: Guaranteed to run without a UI, with CPU fallback for GPU tasks.
-   **Safe Concurrency**: Clear separation of concerns and controlled access to shared resources.
-   **Cross-Platform Consistency**: The chosen stack is well-supported on Windows, macOS, and Linux.

**Trade-offs / Risks**:
-   **New Dependency**: Adds ONNX Runtime to the project, which will need to be managed.
-   **UI Complexity**: If advanced visualizations are required, managing a decoupled Servo instance adds architectural overhead.

---

## 6. Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **Electron + WASM + Servo (for GPU)** | Proposed leveraging Servo's rendering engine for GPU tasks. | Unsafe for deterministic scheduling, unreliable headless mode, and unproven shared memory model for agent orchestration. **Rejected due to high risk.** |
| **Node.js + Native GPU Libs** | Offers the highest possible performance for GPU compute. | Platform-specific, significantly increases packaging complexity, and creates a higher maintenance burden. |
| **Electron + WASM only** | Simple and stable stack. | Lacks reliable, cross-platform GPU acceleration for LLM tasks. |

---

## 7. Next Steps
1.  Prototype the `Electron + WASM + ONNX Runtime` integration with a simple LLM inference pipeline.
2.  Define the API and data transfer conventions between the Node.js orchestrator and the ONNX Runtime.
3.  Implement a deterministic task scheduler in the main orchestrator to manage the agent task queue.
4.  Document the shared memory layout and synchronization mechanisms.
5.  (Optional) Design the decoupled interface for the Servo visualization layer to consume data from the core runtime.

---

**Decision Owner**: [Jules]

**Reviewers**: Engineering Team

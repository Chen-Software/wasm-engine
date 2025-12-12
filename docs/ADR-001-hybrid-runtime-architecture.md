# ADR-001: Hybrid Local-First Multi-Agent Runtime Architecture

**Date**: 2025-12-12
**Status**: Proposed for Engineering Review
**Decision Owner**: Engineering Team

---

## 1. Context

We are designing a local-first environment for multi-agent LLM inference. Key requirements:
- **Local-first execution**: All computation occurs on the user’s machine without mandatory cloud dependencies.
- **Multi-agent orchestration**: Multiple agents must run concurrently with deterministic scheduling.
- **GPU acceleration**: Leverage GPUs for LLM inference where available.
- **Headless operation**: Must support execution without UI.
- **Optional rich desktop UI**: For visualization, monitoring, or debugging.
- **Cross-platform**: Linux, macOS, and Windows.
- **Safe integration of WASM agents and GPU compute**.

The original proposal suggested Servo WebGPU + Electron + Node.js + WASM, but technical review identified major risks:
- Servo WebGPU is experimental, unsafe for production inference, and has undefined memory semantics with WASM.
- Deterministic multi-agent scheduling is not feasible with Servo’s asynchronous GPU pipeline.
- Servo lacks headless fallback and cross-platform GPU stability.

---

## 2. Decision

Adopt a hybrid architecture using:
1.  **Node.js / Electron** as the shared runtime and orchestrator
    -   Handles multi-agent task scheduling, IPC, and optional UI hosting.
2.  **WASM worker pool** for CPU-bound agent logic
    -   Sandboxed execution of agent behavior, isolated per agent.
3.  **ONNX Runtime** for GPU and CPU inference
    -   Handles LLM model execution with automatic CPU fallback.
4.  **Optional Servo** for advanced desktop UI
    -   Only for visualizations; no compute or orchestration responsibility.

---

## 3. Rationale

1.  **Deterministic multi-agent orchestration**
    -   Node.js orchestrator can schedule agents in a controlled, reproducible manner.
    -   GPU tasks submitted via ONNX Runtime can be serialized or queued explicitly.
2.  **Safe memory model**
    -   WASM workers and ONNX Runtime use well-defined memory buffers; avoids undefined behavior of Servo + SharedArrayBuffer.
3.  **Cross-platform reliability**
    -   Node.js + ONNX Runtime is fully supported across Linux, Windows, and macOS.
4.  **GPU acceleration without risk**
    -   ONNX Runtime is a production-proven ML inference engine; automatic fallback ensures headless reliability.
5.  **Optional high-performance UI**
    -   Servo may be embedded for GPU-accelerated visualizations, decoupled from computation.
6.  **Simplified architecture**
    -   Reduces complexity from 4 risky runtimes to 3 proven components (Electron/Node.js, WASM, ONNX Runtime).

---

## 4. Consequences

**Positive**:
-   Deterministic agent execution; reproducible multi-agent runs.
-   Safe CPU/GPU memory management; reduced risk of crashes or corruption.
-   Cross-platform GPU support with fallback to CPU.
-   Optional UI enhancements without impacting core inference.
-   Easier debugging, monitoring, and profiling.

**Negative / Trade-offs**:
-   Servo UI integration adds maintenance overhead if used.
-   Electron runtime size is larger than Servo alone (~150 MB).
-   Some advanced GPU-accelerated UI features may be limited compared to full Servo WebGPU.
-   Requires explicit orchestration for GPU task ordering to maintain determinism.

---

## 5. Architecture Overview

**Headless Mode (No UI):**

```
+---------------------------+
| Node.js Orchestrator      |
| - Agent Scheduler         |
| - IPC / Task Queues       |
+------------+--------------+
             |
+------------v--------------+
| WASM Worker Pool          |
| - CPU-bound agent logic   |
+------------+--------------+
             |
+------------v--------------+
| ONNX Runtime              |
| - GPU / CPU inference     |
| - Automatic CPU fallback  |
+---------------------------+
```

**Non-Headless Mode (Optional UI with Electron & Servo):**

```
+---------------------------+
| Electron Main (Orchestrator) |
| - Agent Scheduler         |
| - IPC / Task Queues       |
+------------+--------------+
             |
+------------v--------------+
| WASM Worker Pool          |
| - CPU-bound agent logic   |
+------------+--------------+
             |
+------------v--------------+
| ONNX Runtime              |
| - GPU / CPU inference     |
| - Automatic CPU fallback  |
+---------------------------+
             |
+------------v--------------+
| Optional UI Layer          |
| Electron Renderer          |
| Servo (optional)           |
| - GPU-accelerated visualizations |
+---------------------------+
```

**Communication & Scheduling Notes**:
-   **CPU tasks**: WASM workers run agent logic; results communicated via message queues or SharedArrayBuffer with Atomics.
-   **GPU tasks**: ONNX Runtime executes LLM inference; orchestrator serializes or queues tasks for determinism.
-   **UI tasks**: Optional Servo visualizations do not interfere with compute; read-only access to agent state via orchestrator.

---

## 6. Implementation Guidance

1.  **Task Scheduling**:
    -   Implement round-robin or DAG-based scheduler in Node.js orchestrator.
2.  **WASM Integration**:
    -   Spawn isolated workers per agent; communicate via message channels or safe shared memory.
3.  **ONNX Runtime Integration**:
    -   Load LLM models in ONNX format.
    -   Configure GPU execution provider (CUDA/TensorRT) with CPU fallback.
    -   Serialize GPU tasks to maintain deterministic order.
4.  **Optional UI Integration**:
    -   Embed Servo renderer within Electron window for visualization.
    -   UI reads agent state from orchestrator via IPC.
    -   Do not submit any GPU compute tasks from Servo.
5.  **Headless Mode**:
    -   Skip Servo; run Node.js + WASM + ONNX Runtime only.

---

## 7. Open Questions / Decisions

1.  GPU backends: CUDA vs TensorRT vs ROCm depending on target platform.
2.  Number of concurrent agents supported per machine (memory layout, scheduling).
3.  Whether Servo UI is mandatory or optional for production deployments.
4.  How to visualize multi-agent state efficiently without blocking computation.

---

## 8. Decision Outcome

-   **Selected architecture**: Node.js/Electron orchestrator + WASM CPU workers + ONNX Runtime GPU inference + optional Servo UI.
-   **Rejected**: Servo WebGPU as a compute backend due to experimental status, undefined memory safety, and non-determinism.

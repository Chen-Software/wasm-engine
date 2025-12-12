---
Status: Proposed
Owners: [Engineering Team]
Reviewers: [Engineering Team]
Date: 2025-12-12
Version: 0.2
ID: 3b95ebbd87fc61525c970ac6180ccd397b449d31
---

# Hybrid Runtime Technology Selection
## Architecture Decision Record

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

The technical review highlighted critical gaps in the original Servo-based proposal. The shift to ONNX Runtime addresses these as follows:

1.  **Production Readiness & Reliability**
    -   **Issue**: Servo WebGPU is experimental with no known production LLM deployments and lacks tensor libraries.
    -   **Solution**: ONNX Runtime is a battle-tested inference engine with 1000+ production deployments and optimized kernels for CPU/GPU.

2.  **Deterministic Multi-Agent Orchestration**
    -   **Issue**: Servo’s async GPU pipeline and work-stealing schedulers make determinism impossible.
    -   **Solution**: Node.js orchestrator can implement explicit round-robin or DAG-based scheduling. GPU tasks via ONNX can be serialized to ensure reproducible execution order.

3.  **Memory Safety & Isolation**
    -   **Issue**: Sharing `SharedArrayBuffer` between WASM and Servo (across process/thread boundaries) has undefined semantics and risks data corruption.
    -   **Solution**: Use explicit serialization or memory-mapped files for cross-process communication. WASM workers remain sandboxed, and ONNX Runtime manages its own GPU memory safely.

4.  **Cross-Platform & Headless Fallback**
    -   **Issue**: Servo WebGPU lacks a graceful fallback if GPU drivers are missing or incompatible (e.g., Windows/Direct3D bugs).
    -   **Solution**: ONNX Runtime supports Linux, Windows, and macOS with automatic fallback to CPU if GPU acceleration fails, ensuring the system runs on any hardware.

5.  **Simplified Architecture**
    -   **Issue**: Managing 4 experimental runtimes (Electron, Node, WASM, Servo) creates high maintenance and debugging complexity.
    -   **Solution**: Reducing to 3 proven components (Node/Electron, WASM, ONNX) simplifies the stack and debugging.

---

## 4. Consequences

**Positive**:
-   **Determinism**: Reproducible agent execution via explicit scheduling.
-   **Safety**: Reduced risk of memory corruption and crashes.
-   **Reliability**: Automatic CPU fallback ensures the app works everywhere.
-   **Performance**: Optimized inference via ONNX Runtime (CUDA/TensorRT/CoreML).
-   **Observability**: Easier to profile and debug standard Node.js/ONNX stack.

**Negative / Trade-offs**:
-   **Electron Size**: Electron runtime is still large (~150 MB).
-   **Serialization Overhead**: Explicit data passing (vs. unsafe shared memory) adds slight latency (~1-5%), but is worth the safety trade-off.
-   **UI Separation**: Servo UI must be strictly decoupled from compute, requiring IPC for state updates.

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

### Core Components
1.  **Task Scheduling**: Implement a round-robin or DAG-based scheduler in Node.js.
2.  **WASM Integration**: Spawn isolated workers per agent; use explicit serialization or safe shared memory (Atomics).
3.  **ONNX Integration**: Load LLM models in ONNX format; configure GPU providers (CUDA, TensorRT, CoreML) with CPU fallback.

### Implementation Roadmap

**Phase 1: Proof of Concept (Weeks 1–4)**
-   Create headless Node.js + ONNX Runtime inference harness.
-   Load a small LLM (e.g., 1B parameter) and benchmark CPU vs. GPU latency.
-   Validate deterministic scheduling with simple agents.

**Phase 2: WASM Integration (Weeks 5–8)**
-   Integrate WASM worker pool for agent logic.
-   Implement IPC/shared buffer communication with proper synchronization.
-   Test multi-agent concurrent inference with resource contention.

**Phase 3: UI & Monitoring (Weeks 9–12)**
-   Add optional Electron UI with live agent status dashboard.
-   Implement task queue visualization and performance profiling.

**Phase 4: Optimization & Hardening (Weeks 13+)**
-   Profile hot paths (orchestration, inference, IPC).
-   Implement graceful degradation (GPU -> CPU).
-   Comprehensive cross-platform testing (Windows, macOS, Linux).

---

## 7. Open Questions / Decisions

1.  **GPU Backend Selection**: Confirm target user hardware (NVIDIA vs AMD vs Mac) to prioritize ONNX providers (CUDA vs ROCm vs CoreML).
2.  **Inference Library**: ONNX Runtime is selected, but TVM could be an alternative for exotic hardware.
3.  **Concurrency Limits**: Determine max agents per machine based on memory layout.
4.  **Model Serving**: Decide if models are bundled or dynamically loaded (affects startup time).

---

## 8. Decision Outcome

-   **Selected architecture**: Node.js/Electron orchestrator + WASM CPU workers + ONNX Runtime GPU inference + optional Servo UI.
-   **Rejected**: Servo WebGPU as a compute backend due to experimental status, undefined memory safety, and non-determinism.

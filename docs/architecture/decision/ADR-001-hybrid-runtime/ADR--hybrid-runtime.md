---
Status: Proposed
Date: 2025-12-12
Version: 0.4
Owners: [Engineering Team]
Reviewers: [Engineering Team]
Tags: [Architecture, Runtime, Node.js, Bun, WASM, ONNX, Electron, WebGPU]

---

# ADR: Node.js + WASM + ONNX Runtime as the Shared Runtime (Updated)

## 1. Context / Problem Statement

We need a production-ready, native-first, headless runtime for a local-first multi-agent system with these requirements:

* **CPU-bound agent logic**: Sandbox execution with deterministic behavior.
* **GPU-bound inference**: Efficient execution of LLMs and ML workloads on GPU with CPU fallback.
* **Deterministic scheduling**: Repeatable execution across agents for debugging and reliability.
* **Cross-platform support**: Linux, Windows, macOS.
* **Optional UI**: The core runtime must be headless with an optional decoupled interface.

Previous approaches using Servo WebGPU were rejected due to experimental API safety risks, non-deterministic scheduling, and unreliable headless support.

---

## 2. Decision

Adopt a **Node.js orchestrator + WASM worker pool + ONNX Runtime** stack as the core runtime, with a fully optional decoupled UI.

### Key Components

1. **Node.js Orchestrator (Shared Runtime)**
   * Central scheduler, task queue manager, IPC hub.
   * Deterministic scheduling with configurable strategies (round-robin, priority-based).
   * Manages WASM workers and ONNX Runtime execution.

2. **WASM Worker Pool**
   * Executes CPU-bound agent logic in sandboxed threads.
   * Communication via `SharedArrayBuffer` with `Atomics` for high-performance, safe data sharing.
   * Ensures isolation between agents and the orchestrator.

3. **ONNX Runtime**
   * Executes GPU-bound inference (LLMs and other ML models).
   * CPU fallback for environments without compatible GPU.
   * Model management and deterministic execution.

4. **Optional UI Layer**
   * Fully decoupled for visualization and control (read-only access).
   * Communicates with orchestrator via IPC (WebSockets, memory-mapped files).
   * Does not interact directly with WASM workers or ONNX Runtime.

---

## 3. Considered Alternatives

| Alternative | Pros | Cons |
| :--- | :--- | :--- |
| Servo WebGPU | Rust-native, lightweight | Experimental, unsafe for compute, unreliable headless, non-deterministic scheduling |
| Node.js + WASM + ONNX Runtime | Stable, safe, deterministic, GPU/CPU fallback, cross-platform | UI must be decoupled, separate toolchain for ONNX and WASM |
| Bun + WASM + ONNX Runtime | Fast JS runtime, simplified development, experimental | Limited native addon support, GPU bindings immature, less ecosystem stability |
| Electron + WebGPU | Browser-based UI + Node.js integration | Requires unsafe flags for WebGPU, heavy runtime footprint, headless reliability issues, non-deterministic GPU task execution |

**Decision Rationale:** Node.js + WASM + ONNX Runtime is the only alternative that fully meets core requirements for determinism, safety, and production readiness, while providing a stable path for GPU and CPU computation. Other options are either experimental or carry operational risks for headless multi-agent execution.

---

## 4. Consequences

### Positive

* Deterministic, reproducible agent scheduling.
* Safe memory model using WASM sandboxing and `SharedArrayBuffer` + `Atomics`.
* Robust GPU acceleration with automatic CPU fallback.
* Fully headless operation for edge or server deployments.
* Cross-platform support with proven runtime components.

### Trade-offs

* Decoupled UI introduces minor IPC overhead.
* Requires configuration of toolchains for WASM and ONNX Runtime.

---

## 5. Architecture Overview

```
+---------------------------+
|    Node.js Orchestrator   |
|  - Deterministic Scheduler|
|  - IPC & Task Queues      |
+------------+--------------+
             |
  +----------+----------+
  |                     |
+---v------------------+  +---v------------------+
|  WASM Worker Pool    |  |    ONNX Runtime      |
| - CPU-bound agents   |  | - GPU/CPU Inference  |
+----------------------+  +----------------------+
             |
   Optional Decoupled UI (Read-Only)
```

### Communication Guidelines

* **In-process:** `SharedArrayBuffer` + `Atomics` for high-speed data exchange.
* **Cross-process:** IPC via WebSockets or memory-mapped files for optional UI.
* **UI is read-only** and never directly modifies agent memory.

---

## 6. Memory & Resource Management

* WASM workers maintain private linear memory (heap).
* Shared memory for orchestrator ↔ workers communication is strictly synchronized.
* ONNX Runtime manages GPU memory separately; orchestrator and workers do not access GPU memory directly.
* Node.js orchestrator monitors CPU and memory usage and schedules workers accordingly.

---

## 7. Future Enhancements

* Advanced scheduling algorithms (e.g., DAG-based scheduling).
* Dynamic scaling of WASM worker pool based on system load.
* WASI integration for controlled system resource access from WASM.
* Optional integration of WebGPU through Dawn or other native backends for GPU compute if needed.

---

## 8. References

* [ONNX Runtime Documentation](https://onnxruntime.ai/docs/)
* [WebAssembly Threads and Atomics (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly)
* [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)

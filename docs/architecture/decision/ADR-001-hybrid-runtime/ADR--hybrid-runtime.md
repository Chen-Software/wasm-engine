---
Status: Approved
Owners: [Engineering Team]
Reviewers: [Engineering Team]
Date: 2025-12-12
Version: 1.0
ID: 3b95ebbd87fc61525c970ac6180ccd397b449d31
---

# ADR: Node.js + WASM + ONNX Runtime as the Shared Runtime
## Architecture Decision Record

---

## 1. Context / Problem Statement

We need a shared runtime for a local-first, multi-agent system with the following requirements:
- **CPU-bound agent logic**: Agents must run in a sandboxed, high-performance environment.
- **GPU-bound LLM inference**: The system must leverage GPU acceleration for large model inference.
- **Deterministic scheduling**: Agent execution must be reproducible for debugging and reliability.
- **Cross-platform support**: The runtime must support Linux, Windows, and macOS.
- **Headless operation**: The system must run without a graphical interface for server-like deployments.

The original proposal considered a hybrid runtime using `Servo + Electron + WASM + Node.js`, with Servo WebGPU intended for GPU compute. However, a detailed technical review identified critical issues with this approach:

- **Experimental Technology**: Servo WebGPU is not production-ready and is unsafe for compute-intensive tasks.
- **Undefined Memory Safety**: The semantics for shared memory between WASM and Servo are unclear, creating a high risk of data corruption.
- **Non-Deterministic Scheduling**: Servo's asynchronous GPU task model makes deterministic agent scheduling impossible.
- **Unreliable Headless Mode**: The lack of a stable CPU fallback in Servo makes headless operation unreliable.
- **Inconsistent GPU Portability**: Cross-platform GPU support is not guaranteed.

---

## 2. Decision

We will adopt a revised architecture centered on **Node.js** as the primary orchestrator, combined with **WASM workers** for CPU-bound agent logic and **ONNX Runtime** for GPU-bound inference.

### Key Components:
1.  **Shared Runtime (Orchestrator)**: **Node.js**
    -   Manages the entire agent lifecycle, including task queues, priorities, and deterministic scheduling.
    -   Handles Inter-Process Communication (IPC), shared memory (`SharedArrayBuffer`), and message queues.
2.  **CPU Logic**: **WASM Workers**
    -   Execute agent logic in a sandboxed environment, preventing main-thread blocking and ensuring security.
    -   Communicate with the Node.js orchestrator via `SharedArrayBuffer` with `Atomics` for low-latency data exchange or standard message queues.
3.  **GPU Logic**: **ONNX Runtime**
    -   Handles all LLM inference and other GPU-intensive compute tasks.
    -   Provides deterministic execution guarantees and automatic CPU fallback, ensuring reliability in headless deployments or on machines without a compatible GPU.
4.  **Headless-First Design**:
    -   The core architecture is designed for fully headless operation.
    -   Any user interface (UI) is considered optional and is decoupled from the core runtime.

---

## 3. Considered Alternatives

| Alternative | Pros | Cons |
| :--- | :--- | :--- |
| **Servo WebGPU for GPU** | Lightweight, Rust-native, open ecosystem. | Experimental, unsafe for compute, undefined memory sharing, unreliable headless fallback. |
| **Node.js + WASM + ONNX Runtime** | Proven orchestration, deterministic scheduling, safe memory model, reliable GPU/CPU fallback, cross-platform. | Requires a separate, decoupled UI integration if a graphical interface is needed. |

**Decision Rationale**: The `Node.js + WASM + ONNX Runtime` stack is the only alternative that meets all core requirements for a deterministic, safe, and production-ready multi-agent system. It replaces high-risk experimental components with battle-tested, industry-standard technologies.

---

## 4. Consequences

### Positive:
-   **Deterministic Scheduling**: The Node.js orchestrator enables reproducible agent behavior.
-   **Memory Safety**: Communication via `SharedArrayBuffer` with `Atomics` or serialized messages provides a well-defined and safe memory model.
-   **Reliable Compute**: ONNX Runtime offers robust GPU acceleration with automatic CPU fallback, ensuring the system runs on any hardware.
-   **Headless Operation**: The architecture is optimized for server-like deployments without a UI.
-   **Cross-Platform Confidence**: The chosen components have proven track records on Linux, Windows, and macOS.

### Negative / Trade-offs:
-   **UI Decoupling**: Any UI layer (such as one built with Servo) must be strictly separated from the core runtime, which may introduce minor performance overhead due to serialization and IPC.
-   **Toolchain Complexity**: The development environment requires setting up toolchains for both ONNX Runtime and WASM.

---

## 5. Implementation Notes / Architecture Overview

### Architecture (Headless Mode):
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
```

### IPC & Shared Memory Guidelines:
-   **In-process Communication**: Use `SharedArrayBuffer` with `Atomics` for high-performance, low-latency, and safe data exchange between the Node.js orchestrator and WASM workers.
-   **Cross-process Communication**: For communication with a decoupled UI or other external processes, use memory-mapped files or serialized messages (e.g., JSON, MessagePack).
-   **UI is Read-Only**: A UI should only read agent state and should never write directly to shared agent memory.

### Key Principles:
-   The UI must be optional and fully decoupled from the core logic.
-   All GPU compute is delegated exclusively to ONNX Runtime.
-   Deterministic scheduling is enforced by the Node.js orchestrator's task queues.

---

## 6. References
-   [ONNX Runtime Documentation](https://onnxruntime.ai/docs/)
-   [WebAssembly Threads and Atomics (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly)
-   [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)

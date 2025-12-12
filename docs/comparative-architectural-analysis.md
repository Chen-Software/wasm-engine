# Comparative Architectural Analysis for a Local-First Multi-Agent Runtime

**Status**: Draft
**Version**: 1.0
**Date**: 2025-12-12
**Audience**: CTO, Architecture, Engineering
**Context**: This document provides a comparative analysis of architectural choices for the `wasm-engine` project, evaluated against the key product requirements defined in our [Product Requirements Document (PRD)](./PRD-local-first-multi-agent-runtime.md).

---

## 1. Core Architectural Requirements

Based on the PRD, the following five requirements are paramount and serve as the primary criteria for this analysis:

1.  **Determinism**: The runtime must guarantee reproducible multi-agent execution.
2.  **GPU Acceleration & Safety**: The runtime must provide reliable, cross-platform GPU acceleration for ML inference with a safe CPU fallback.
3.  **Headless-First Operation**: The core runtime must be fully functional without a UI.
4.  **Agent Sandboxing**: CPU-bound agent logic must be securely isolated.
5.  **Cross-Platform Uniformity**: The runtime's behavior must be identical across Linux, Windows, and macOS.

---

## 2. Architectural Candidates

We evaluated three high-level architectural approaches:

### **Option A: Pure Browser-Based (WASM in Chrome/Firefox)**
-   **Description**: A standard web application where WASM agents run in browser tabs/workers. GPU access would rely on the browser's WebGPU implementation.
-   **Components**: Web Browser (Chrome/Firefox), Web Workers, WASM, WebGPU.

### **Option B: Pure Rust/Native (Tokio + wgpu + wasmtime)**
-   **Description**: A fully native application written in Rust. `tokio` would provide asynchronous orchestration, `wgpu` would provide direct GPU access, and `wasmtime` would run WASM agents.
-   **Components**: Rust, Tokio, wgpu, wasmtime.

### **Option C: Hybrid Node.js Orchestrator (Chosen Architecture)**
-   **Description**: A hybrid model where a Node.js process acts as a central, deterministic orchestrator. It manages a pool of WASM workers for CPU tasks and uses a dedicated, production-ready library (ONNX Runtime) for GPU/CPU inference.
-   **Components**: Node.js/Electron, WASM Workers, ONNX Runtime.

---

## 3. Comparative Analysis

| Requirement                       | Option A: Pure Browser-Based                                | Option B: Pure Rust/Native                                     | Option C: Hybrid Node.js Orchestrator (Chosen)                   |
| --------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| **1. Determinism**                | 🔴 **Poor**. Browser schedulers are non-deterministic and cannot guarantee task ordering across runs. | 🟡 **Achievable, but Complex**. `tokio` is highly concurrent; enforcing strict determinism requires significant and complex engineering effort. | ✅ **Excellent**. A single-threaded Node.js event loop provides a natural foundation for a deterministic, serializable task scheduler. |
| **2. GPU Acceleration & Safety**  | 🔴 **Poor**. WebGPU is experimental, performance is inconsistent, and there is no guaranteed CPU fallback, making it unsuitable for reliable, headless inference. | 🟡 **Good, but Platform-Specific**. `wgpu` is powerful but requires manual management of GPU backends (Vulkan, Metal, DX12), increasing cross-platform complexity. | ✅ **Excellent**. ONNX Runtime is a production-proven, cross-platform engine that provides stable GPU acceleration with automatic, reliable CPU fallback. |
| **3. Headless-First Operation**   | 🔴 **Poor**. This architecture is fundamentally UI-first and cannot operate without a browser environment. | ✅ **Excellent**. A native Rust application is inherently headless. A UI would be an optional layer. | ✅ **Excellent**. The Node.js orchestrator is headless by default. An optional UI (e.g., Electron) can be attached without altering the core runtime. |
| **4. Agent Sandboxing**           | ✅ **Excellent**. Browsers provide a mature and secure sandbox for WASM execution in web workers. | ✅ **Excellent**. `wasmtime` is a production-grade, secure runtime for sandboxing WASM modules. | ✅ **Excellent**. Node.js `worker_threads` provide a robust and secure environment for running sandboxed WASM modules. |
| **5. Cross-Platform Uniformity**  | 🟡 **Good**. While web applications are cross-platform, minor behavioral differences and performance characteristics exist between browsers and OSes. | 🟡 **Good, but High Effort**. Achieving identical behavior with native code, especially for GPU operations, requires extensive platform-specific testing and tuning. | ✅ **Excellent**. Node.js and ONNX Runtime are designed and tested for uniform behavior across all three target platforms, significantly reducing engineering overhead. |

---

## 4. Decision and Justification

**Decision**: **Option C: Hybrid Node.js Orchestrator** is selected.

**Justification**:

The hybrid Node.js approach provides the best balance of features to meet our core product requirements. Its primary strengths are:

1.  **Superior Determinism**: The Node.js event loop is the ideal foundation for the deterministic, single-threaded orchestration required by the PRD. This is a significant advantage over the complex, non-deterministic nature of browser and pure-Rust schedulers.
2.  **Unmatched GPU Safety and Reliability**: By leveraging ONNX Runtime, we adopt a mature, industry-standard solution for ML inference. This de-risks the most critical part of our compute stack, providing stable GPU acceleration and guaranteed CPU fallback, which is something neither the browser's experimental WebGPU nor a manually managed `wgpu` implementation can offer out of the box.
3.  **Optimal Balance of Power and Simplicity**: This architecture combines the proven sandboxing of WASM and the power of ONNX Runtime with the simple, effective orchestration of Node.js, delivering on all key requirements with the lowest engineering complexity and highest cross-platform reliability.

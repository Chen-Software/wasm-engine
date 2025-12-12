# Requirements Traceability Matrix

**Document**: Local-First Multi-Agent Runtime
**Version**: 1.0 (corresponds to PRD v. 2025-12-12)

---

This matrix traces the high-level goals and functional requirements from the Product Requirements Document (PRD) to the corresponding sections in the Master Architecture Design (MAD) and relevant Architecture Decision Records (ADRs). It ensures that all product requirements are met by the technical design.

## 1. Goals Traceability

| PRD Goal (Section 3.1) | Description | Architectural Implementation (MAD Sections) | Justification (ADR) |
| :--- | :--- | :--- | :--- |
| **G1: Deterministic multi-agent orchestration** | Reproducible task ordering and controlled concurrency. | **2. Architectural Principles** (Deterministic Orchestration), **3. Core Components** (Main Orchestrator), **6. Threading Model** (Electron Main Process) | **ADR-01**: The selection of Node.js as the orchestrator is explicitly to enable deterministic, single-threaded scheduling. |
| **G2: Hybrid compute pipeline** | Use WASM for CPU logic and ONNX for GPU/CPU inference. | **2. Architectural Principles** (Hybrid Execution), **3. Core Components** (WASM Worker Pool, ONNX Runtime) | **ADR-01**: Rejection of Servo for compute and selection of ONNX was driven by the need for a reliable hybrid pipeline. |
| **G3: Local-first architecture** | No runtime dependency on remote APIs; fully offline operation. | **1. Overview**, **7. Headless vs Non-Headless Operation** | The entire architecture is predicated on local execution, with no components requiring external network access to function. |
| **G4: Headless-first runtime** | The core system must run without a UI. | **7. Headless vs Non-Headless Operation**, **3. Core Components** (Optional UI) | **ADR-02**: The explicit decoupling of the UI layer ensures the core runtime's independence. |
| **G5: Extensible agent framework** | Support for third-party agent modules. | **8. Scalability and Extensibility**, **PRD Section 7.1** (Agent Interface) | The architecture supports this via the WASM ABI, but the MAD could be stronger in detailing the plugin model. *(Action: Refine MAD Section 8)* |
| **G6: Cross-platform** | Works on Linux, Windows, macOS. | **3. Core Components** (Use of Node.js, WASM, ONNX which are all cross-platform) | The technology stack was chosen specifically for its cross-platform capabilities. |

## 2. Functional Requirements Traceability

| PRD Functional Requirement (Section 5) | Description | Architectural Implementation (MAD Sections) |
| :--- | :--- | :--- |
| **FR-5.1.1: Execute N agents deterministically** | Agents run concurrently in a deterministic order. | **3. Core Components** (Main Orchestrator), **6. Threading Model** |
| **FR-5.1.2: Shared message bus** | Guaranteed ordering for inter-agent communication. | **PRD Section 7.2** (Orchestrator Messaging API). *(Action: This is a software pattern that needs to be explicitly designed within the Orchestrator. Add to MAD.)* |
| **FR-5.1.3: Atomic/lock-free memory** | Mechanisms for shared memory access. | **3. Core Components** (Shared Memory Buffers), **9. Design Considerations** (Shared memory management) |
| **FR-5.1.4: Agent sandboxing** | Agents must run in full isolation. | **2. Architectural Principles** (Sandboxing & Isolation), **3. Core Components** (WASM Worker Pool) |
| **FR-5.2: WASM Execution** | Memory limits, non-blocking execution. | **3. Core Components** (WASM Worker Pool), **6. Threading Model** |
| **FR-5.3: GPU/CPU Inference** | Use ONNX with automatic CPU fallback. | **3. Core Components** (ONNX Runtime), **7. Headless vs Non-Headless Operation** |
| **FR-5.4: Orchestrator** | Task queuing (FIFO, priority), predictable scheduling. | **3. Core Components** (Main Orchestrator). *(Action: Scheduling strategy needs its own design document.)* |
| **FR-5.5: Optional UI** | Attachable, read-only, unidirectional IPC. | **3. Core Components** (Optional UI), **5. Component Interactions**, **9. Design Considerations** (UI Decoupling) |

## 3. Non-Functional Requirements Traceability

| PRD Non-Functional Requirement (Section 6) | Description | Architectural Implementation (MAD Sections) |
| :--- | :--- | :--- |
| **NFR-6.1: Performance** | <10 ms overhead for orchestrator tick. | This is a performance budget that will need to be validated during implementation and benchmarking (Roadmap Phase 1). |
| **NFR-6.2: Latency** | Inference latency must be GPU-bound. | **3. Core Components** (ONNX Runtime). This is an explicit goal of using a native inference engine. |
| **NFR-6.3: Isolation** | Full sandboxing of WASM modules. | **2. Architectural Principles** (Sandboxing & Isolation), **3. Core Components** (WASM Worker Pool). |
| **NFR-6.4: Security** | No shared raw pointers; structured cloning. | The messaging API (FR-5.1.2) should enforce this. Shared memory (FR-5.1.3) is an exception that must be managed carefully. |
| **NFR-6.5: Portability** | Works on Linux, macOS, Windows. | The choice of Node.js, WASM, and ONNX as core technologies ensures this. |
| **NFR-6.6: Determinism** | Reproducible agent execution order. | **2. Architectural Principles** (Deterministic Orchestration), **3. Core Components** (Main Orchestrator). |

---
**Summary of Actions**:
1.  Refine MAD Section 8 to better detail the agent plugin/extensibility model.
2.  Add detail to the MAD about the orchestrator's message bus implementation.
3.  Prioritize the creation of the "Orchestrator Scheduling Specification" document.

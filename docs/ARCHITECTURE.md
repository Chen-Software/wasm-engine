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
1.  Enable CPU-bound agent logic with safe sandboxing via **WebAssembly (WASM)**.
2.  Enable GPU-accelerated LLM inference via **ONNX Runtime**, with automatic CPU fallback.
3.  Provide deterministic, reproducible orchestration of multi-agent tasks via a **central Node.js orchestrator**.
4.  Support an optional, decoupled UI for monitoring and visualization.
5.  Ensure robust, cross-platform, local-first execution with no cloud dependencies.

---

## 2. Architectural Principles

-   **Shared Runtime & Central Orchestration**: A single Node.js/Electron process acts as the shared runtime, providing a central orchestrator that handles deterministic scheduling, IPC, and concurrency control.
-   **Hybrid Compute**: CPU-bound tasks are executed by WASM workers, while GPU-bound inference is handled by ONNX Runtime.
-   **Production-Grade GPU Inference**: Leverages the stability and cross-platform support of ONNX Runtime for all GPU compute, ensuring reliable headless operation.
-   **Decoupled UI**: The optional UI layer is fully decoupled from the compute plane. **Servo is used for visualization only** and does not participate in core scheduling or compute.
-   **Safety and Isolation**: WASM provides sandboxing for agent logic, while the ONNX Runtime is a proven, secure inference engine.

---

## 3. Core Components

| Component                          | Role / Responsibility                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Node.js / Electron Runtime**     | The primary host process. Provides the event loop and acts as the shared runtime for all components.                  |
| **Main Orchestrator (in Node.js)** | Manages a deterministic task scheduler, coordinates IPC, and handles all state and memory management.                   |
| **WASM Worker Pool**               | Executes CPU-bound agent logic in sandboxed, isolated worker threads.                                                 |
| **ONNX Runtime**                   | Executes all GPU-bound LLM inference tasks, with automatic and reliable fallback to CPU.                                |
| **Optional UI / Monitoring Layer** | An Electron-based UI for visualization. May embed **Servo** for advanced, GPU-accelerated graphics, but is read-only.   |
| **IPC & Shared Memory**            | Communication primitives managed by the orchestrator. All data transfer to/from compute layers (WASM/ONNX) is explicit. |

---

## 4. Architecture & Data Flow

The architecture is designed to operate identically in two modes: headless and non-headless (UI-enabled). The core compute logic remains the same, with the UI acting as an optional, decoupled layer.

```mermaid
flowchart TB
    subgraph "Core Runtime"
        direction LR
        subgraph "Headless / Non-UI Mode"
            NodeOrch["Node.js Orchestrator\n(Deterministic Scheduler, IPC)"]
            WASM["WASM Worker Pool\n(CPU-Bound Agent Logic)"]
            ONNX["ONNX Runtime\n(GPU + CPU Fallback Inference)"]

            NodeOrch -- "Schedules & Routes Tasks" --> WASM
            NodeOrch -- "Schedules & Routes Tasks" --> ONNX
            WASM -- "Results / IPC" --> NodeOrch
            ONNX -- "Results / IPC" --> NodeOrch
        end
    end

    subgraph "Optional UI Layer"
        direction LR
        ElectronRenderer["Electron Renderer\n(UI Logic)"]
        ServoUI["Servo View\n(GPU-Accelerated Visualization)"]

        ElectronRenderer -- "Renders Into" --> ServoUI
        ElectronRenderer -- "Requests State via IPC" --> NodeOrch
    end

    style "Optional UI Layer" fill:#f9f9f9,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
```

**Data Flow Explanation**:
1.  **Task Scheduling**: The **Node.js Orchestrator** receives all tasks and places them into a deterministic queue.
2.  **CPU Tasks**: Agent logic is dispatched to the **WASM Worker Pool**.
3.  **GPU Tasks**: All inference tasks are dispatched to the **ONNX Runtime**.
4.  **Communication**: All communication, including shared memory buffer handles, flows through the orchestrator. There is no direct communication or zero-copy sharing between WASM and an optional Servo UI.
5.  **UI Visualization**: In UI mode, the **Electron Renderer** requests state from the orchestrator via IPC and uses it to render monitoring views, optionally using an embedded **Servo** view for high-performance visualizations.

---

## 5. Implementation Roadmap

```mermaid
gantt
    title Local-First Multi-Agent Runtime Implementation Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Phase 1: Proof of Concept
    Node.js + ONNX Runtime harness      :done,    des1, 2025-12-12, 2025-12-19
    Load small LLM in ONNX format       :done,    des2, 2025-12-12, 2025-12-20
    Benchmark CPU/GPU latency           :active,  des3, 2025-12-20, 2025-12-26
    Validate deterministic scheduling   :active,  des4, 2025-12-20, 2025-12-26

    section Phase 2: WASM Integration
    Integrate WASM worker pool          :         des5, 2025-12-27, 2026-01-10
    Implement safe IPC / serialization  :         des6, 2025-12-27, 2026-01-10
    Test multi-agent concurrency        :         des7, 2026-01-11, 2026-01-24

    section Phase 3: Optional UI & Visualization
    Add Electron Renderer (optional)    :         des8, 2026-01-25, 2026-02-07
    Embed Servo UI (optional)           :         des9, 2026-01-25, 2026-02-07
    Implement agent dashboard & logs    :         des10, 2026-01-25, 2026-02-07

    section Phase 4: Optimization & Hardening
    Profile orchestration & GPU paths   :         des11, 2026-02-08, 2026-02-21
    Implement graceful GPU fallback     :         des12, 2026-02-08, 2026-02-21
    Cross-platform testing              :         des13, 2026-02-22, 2026-03-07
```

---

## 6. Summary

This Master Architecture provides a robust and production-ready runtime:
-   It uses a **shared Node.js/Electron runtime** for deterministic orchestration.
-   It leverages proven technologies for compute: **WASM** for CPU logic and **ONNX Runtime** for reliable GPU inference.
-   **Servo's role is strictly limited to optional, decoupled UI visualization**, removing it from the critical compute path.
-   The design supports both headless and UI-integrated modes effectively.

---

## 7. Designing for Servo or More Open Web Platforms

A core strategic goal is to minimize dependency on the Chrome/Electron ecosystem while still providing a rich, optional UI. The architecture achieves this through the following design principles:

1.  **Headless-First Core**: The orchestrator (`Node.js`) + compute (`WASM` + `ONNX Runtime`) layers are fundamentally headless. They form a self-contained, high-performance runtime that does not require a UI, ensuring determinism and reliability.
2.  **Servo for an Open UI**: By embedding **Servo** as the optional UI renderer, the project can leverage an open, Rust-based, and lightweight engine that is independent of Chromium. It can render standard HTML/CSS/JS dashboards for monitoring.
3.  **Decoupled Communication**: The UI layer communicates with the orchestrator via safe, standardized IPC (e.g., JSON, MessagePack). It has no direct access to the compute pipelines, reinforcing the separation of concerns.
4.  **Future Flexibility**: This headless-first approach allows for future UI implementations that are even more platform-agnostic, such as serving a web interface from the orchestrator that any modern browser could render.

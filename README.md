# wasm-engine

Welcome to `wasm-engine`, a next-generation runtime engine designed to provide an operating system-level platform for high-performance, graphically-intensive applications.

This project is currently in the **conceptual phase**. The architecture serves as a blueprint for a runtime that combines sandboxed, near-native computation with a high-throughput, parallel rendering pipeline.

## Core Technologies

The engine's architecture is built upon a powerful combination of modern technologies:

- **Electron / Node.js**: Serves as the host environment, providing the main event loop, OS-level integration, and the central orchestrator for all agent tasks.
- **WebAssembly (WASM)**: For running sandboxed, CPU-bound agent logic at near-native speed in isolated worker threads.
- **ONNX Runtime**: A production-grade inference engine for executing LLM models on the GPU (with CPU fallback), ensuring high-performance, cross-platform reliability.
- **Servo (Optional)**: Can be embedded for advanced, GPU-accelerated UI visualizations, but is fully decoupled from the core compute and inference pipeline.

## Project Goals

The primary goals of this architectural design are:
- **Maximum Performance**: Leverage multithreading, GPU acceleration, and zero-copy memory operations to achieve the highest possible throughput.
- **Responsive UI**: Ensure the user interface remains smooth and responsive at all times by offloading heavy work to separate threads.
- **Scalability**: Build a foundation that can scale with increasing computational and rendering demands.

## Architecture Overview

The system is designed around a central **Orchestrator** running in the main Node.js/Electron process. This orchestrator manages and schedules tasks across two primary compute layers:

1.  **WASM Worker Pool**: Executes sandboxed, CPU-bound agent logic.
2.  **ONNX Runtime**: Handles GPU-accelerated (with CPU fallback) LLM inference.

These components communicate efficiently using a combination of message passing and shared memory buffers to minimize data copying and ensure low-latency, deterministic execution. An optional UI layer can be-used for monitoring without interfering with the core compute pipeline.

For a complete and consolidated overview of the project's architecture, product requirements, and design decisions, please see the **[Master Architecture Design Document (ADD)](docs/ARCHITECTURE.md)**. For a detailed breakdown of the product vision, goals, and requirements, please see the **[Product Requirements Document (PRD)](docs/PRD-local-first-multi-agent-runtime.md)**. For the authoritative engineering contract, see the **[Authoritative Technical Specification Document (ATSD)](docs/ATSD.md)**.

## Getting Started

*(This section will be updated once the project implementation begins.)*

## Contributing

*(This section will be updated once the project is ready for open-source contributions.)*

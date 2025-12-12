---
id: ADR-001
title: "Shared Runtime Architecture (Node.js + WASM + ONNX Runtime)"
status: "Approved"
date: 2025-12-17
related:
  - ADR-002
  - ADR-003
  - ADR-004
  - ADR-005
  - ADR-007
  - ADR-008
tags:
  - runtime
  - wasm
  - onnx
  - deterministic-execution
---

## 1. Context

The project requires a local-first, deterministic multi-agent runtime capable of:
- High performance CPU + GPU inference
- Deterministic scheduling and replay
- Strict isolation for agents
- A long-term ecosystem aligned with open standards (WASM, ONNX, WebGPU)
- Optional UI that does not degrade compute performance
- Cross-platform operation (Linux, macOS, Windows)

Two competing runtime approaches were considered:
1. Pure Node.js acting as the entire compute and orchestration layer
2. Hybrid runtime combining Node.js, WASM workers, and ONNX Runtime

Additional UI frameworks (Servo/Electron) were evaluated, but they are explicitly decoupled from this decision.

The architecture must support:
- High concurrency (dozens–hundreds of agents)
- Deterministic ticks + ordered state transitions
- Isolation via WASM
- GPU acceleration without compromising determinism contracts
- A stable plugin ABI for agent authors

## 2. Decision

The runtime will adopt a hybrid architecture, consisting of:

### 2.1 Node.js as the Primary Orchestrator
- Scheduler, tick clock, replay logs
- Capability enforcement and plugin ABI
- Inter-process communication (IPC) with UI (if present)
- Routing inference requests to ONNX Runtime
- Managing deterministic message queues

### 2.2 WASM Worker Pool (Rust/C++ compiled to WASM)
- Executes agent logic deterministically
- Sandboxed, isolated memory heaps
- Communication via SharedArrayBuffer + Atomics
- Metered and bounded instruction execution
- No direct system or GPU access

### 2.3 ONNX Runtime
- High-performance inference (WebGPU/DML/CUDA/CPU)
- Deterministic CPU execution
- GPU variants acceptable with minor nondeterministic variance
- Central model cache + GPU memory handler
- Orchestrator-controlled access via RPC-like API

### 2.4 Optional UI Layer (Out of Scope for ADR-001)
Covered under ADR-008.
UI has zero influence on runtime performance or determinism.

## 3. Rationale

This architecture is selected because it uniquely satisfies the system constraints:

### 3.1 Determinism Requirements
Pure Node.js cannot guarantee deterministic execution across threads.
WASM + Atomics provides:
- Deterministic execution paths
- Isolated heaps
- Replayable steps
- Instruction metering

### 3.2 Compute Performance
WASM handles CPU-bound agent logic efficiently.
ONNX Runtime provides:
- GPU acceleration
- Multi-threaded CPU inference
- Cross-platform parity
- ML model determinism guarantees

Node.js alone cannot match this performance profile.

### 3.3 Cross-Platform Reliability
The hybrid model provides consistent behavior across:
- Linux — primary target
- macOS — development and testing
- Windows — enterprise adoption

### 3.4 Extensibility & Security
The ABI plugin model ensures:
- Capability-based restrictions
- Zero direct OS or GPU access for agents
- Versioned agent interfaces

Pure Node.js allows unbounded agent behavior unless extensively sandboxed.

### 3.5 Future Evolution
The architecture supports:
- DAG scheduler upgrade (ADR-013)
- Shared memory ownership policy (ADR-004)
- Model caching and GPU memory policy (ADR-009)
- Fault injection and reproducible debugging (ADR-011)

## 4. Consequences

### 4.1 Positive
- Deterministic multi-agent orchestration
- High-performance inference capabilities
- Full isolation of untrusted agent logic
- Modular, ADR-driven evolution path
- Optional UI with zero runtime impact
- Reproducible execution logs and debugging
- Aligned with open standards (WASM, ONNX, WebGPU, Node.js)

### 4.2 Negative
- More complex build system (WASM + Node + ONNX)
- Multi-language toolchain increases onboarding complexity
- Higher initial engineering investment
- Requires memory-safe languages for WASM components
- More maintenance around ABI versioning

### 4.3 Neutral / Trade-offs
- GPU inference determinism ≠ CPU-bitwise determinism
- IPC complexity increases slightly but improves modularity
- UI must always remain optional and isolated

## 5. Status

Approved and referenced in the Master Architecture Design Document (ADD).

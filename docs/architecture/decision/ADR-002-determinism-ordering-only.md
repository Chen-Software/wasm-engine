---
id: ADR-002
title: "Ordering-Only Determinism for Federated Multi-Agent Runtime"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
  - ADR-003
tags:
  - runtime
  - determinism
  - scheduler
---

# ADR-002: Ordering-Only Determinism for Federated Multi-Agent Runtime

## 1. Context / Problem Statement

Our local-first, federated multi-agent system runs with a **shared single scheduler** inside the runtime orchestrator (Node.js/Electron). Agents execute CPU-bound logic inside WASM workers and GPU-bound inference via ONNX Runtime. Deterministic scheduling is essential for reproducibility, replay, conflict resolution, and debugging.

There are two broad determinism strategies:

1. **Bit-Level Determinism**
   All outputs—down to the byte—must be identical across executions.

2. **Ordering-Only Determinism**
   The *logical order of operations* is consistent, but byte-level memory layout, low-level floating-point differences, or instruction-level nondeterminism may vary underneath. Semantic results remain the same.

Achieving bit-level determinism across heterogeneous agents, platforms, CPUs, and GPU inference engines is extremely costly and brittle. Our architecture already guarantees a **single global scheduler**, so full bit-level determinism is not required to ensure global consistency.

The runtime needs reproducibility and correctness, not binary equivalence.

---

## 2. Decision

We adopt **ordering-only determinism** for all CPU-bound and GPU-bound agent workflows executed within the shared runtime. The orchestrator enforces a deterministic *event order* rather than attempting to equalize low-level execution outputs.

The orchestrator guarantees:

* Deterministic ordering of agent tasks
* Deterministic message passing between agents
* Deterministic state-transition sequences
* Deterministic scheduling across CPU and GPU workloads
* Deterministic replay of execution by preserving event order

Agents may internally have nondeterministic memory layouts or floating-point differences as long as they comply with the orchestrator’s canonical ordering contract.

---

## 3. Rationale (Why Ordering-Only Determinism Is Better for This Architecture)

### 3.1 Aligns with the Single Scheduler Model

Our runtime orchestrator already defines the authoritative **global execution order**. This eliminates Heisenbugs from concurrency and provides reproducibility without byte-level constraints.
→ The scheduler order *is* the determinism boundary.

### 3.2 Supports Heterogeneous Agents and Hardware

Federated agents may run:

* different WASM builds
* different CPU microarchitectures
* different GPU or CPU inference paths
* different OS-level floating-point behavior

Bit-level determinism would require locking down hardware, compilers, allocators, math libraries, and ONNX inference kernels. Ordering-only determinism avoids these requirements.

### 3.3 Bit-Level Determinism Is Incompatible with ONNX + GPU Execution

GPU inference kernels introduce nondeterministic:

* thread scheduling
* reduction ordering
* FP rounding
* vendor driver variations

To force bit-level determinism across GPUs would require:

* disabling GPU parallelism
* forcing CPU inference only
* or building custom deterministic kernels

All of which contradict system goals.

### 3.4 Supports Federated Deployment and Replay

Deterministic ordering gives:

* reproducible replays
* deterministic conflict resolution
* consistent event logs
* ability to simulate/refactor agent logic without binary reproducibility requirements

This matches distributed system best practices (CRDTs, event sourcing, multi-agent coordination).

### 3.5 Lower Engineering Overhead and Better Performance

Bit-level determinism imposes:

* deterministic allocators
* deterministic thread schedulers
* fixed compiler versions
* strict FP modes
* deterministic memory-layout rules
* restricted dependencies

All unnecessary given our single-scheduler architecture.

Ordering-only determinism yields:

* easier maintenance
* simpler debugging
* higher performance (especially on GPU compute)
* fewer constraints on agents

---

## 4. Consequences

### Positive

* Reproducible multi-agent behavior via deterministic event ordering
* Compatible with heterogeneous CPU and GPU hardware
* Maintains performance on GPU inference
* Enables deterministic replay via the orchestrator log
* Simplifies agent development and dependency management
* Compatible with Node.js, WASM workers, and ONNX Runtime without modification

### Negative / Trade-offs

* Low-level byte-for-byte equality between runs is not guaranteed
* Floating-point nondeterminism remains at micro-level, though irrelevant at the semantic layer
* Testing must focus on agent-state equivalence, not binary equivalence

---

## 5. Implementation Notes

### Deterministic Scheduling Rules

* A single global event queue per orchestrator instance
* Canonical ordering for:

  * agent task dispatch
  * message delivery
  * state transitions
  * GPU inference job submission
* Time-based events use synthetic logical clocks or monotonic counters
* Replay uses the exact recorded event sequence

### Agent Contracts

Agents must be:

* pure or side-effect constrained relative to input events
* free of external nondeterministic IO dependencies unless wrapped by orchestrator
* tolerant to micro-level numeric nondeterminism

### Storage and Replay

* Persist event ordering logs
* Reconstruct state solely from ordered inputs
* GPU inference results may differ slightly in FP rounding but must preserve semantic equivalence

---

## 6. Considered Alternatives

### Bit-Level Determinism

**Pros:**

* Exact binary replay
* Useful for blockchain or consensus engines

**Cons:**

* Impossible across GPUs without disabling parallelism
* Requires custom deterministic kernels for ONNX
* Incompatible with federated heterogeneous environments
* Major runtime and performance penalties
* Not necessary given a global deterministic scheduler

Decision: **Rejected** due to extreme complexity and no benefit within this architecture.

---

## 7. References

* ADR-001: Shared Runtime Architecture
* Node.js Worker Thread Determinism Guidelines
* WebAssembly Threads & Atomics Specifications
* ONNX Runtime Execution Provider Determinism Notes
* Research on deterministic distributed systems (CRDTs, event sourcing, transactional graphs)

# Product Requirements Document (PRD) v0.2

**Title:** Shared Runtime for Local-First Multi-Agent Orchestration
**Status:** Draft for Engineering Review
**Version:** 0.2
**Date:** 2025-12-15
**To:** CTO, Platform Architecture, ML Systems
**From:** Principal Engineer
**Owners:** Engineering Team
**Reviewers:** CTO, Platform Architecture, ML Systems

---

## 1. Product Summary

The runtime provides a **deterministic, reproducible, and secure execution environment** for heterogeneous agents:

* CPU-bound WASM logic
* GPU-accelerated ML inference via ONNX Runtime
* Fully headless operation; optional read-only UI

**Enhancements in v0.5:**

1. Formal **determinism contracts** for scheduler, WASM, and ONNX runtime.
2. Shared memory + message-passing standards.
3. ABI & plugin security model specification.
4. Quantified **performance and reproducibility targets**.
5. Incorporates TSD principles to make the PRD actionable for engineering.

---

## 2. Product Goals

1. **Deterministic Multi-Agent Execution**
   * Scheduler guarantees reproducible ordering; deterministic tick clock enforced.
   * WASM agent execution bounded and metered; no wall-clock dependencies.
   * ONNX runtime must operate in deterministic mode; CPU fallback preserves functional reproducibility.

2. **Unified Compute Framework**
   * CPU logic sandboxed in WASM with instruction metering.
   * GPU/CPU inference via ONNX Runtime, centrally managed by orchestrator.

3. **Local-First, Headless-First Operating Model**
   * Fully functional without UI or cloud connectivity.
   * Optional UI strictly read-only, pull-based.

4. **Cross-Platform Uniformity**
   * Identical behavior across Linux, Windows, macOS.

5. **Model Management Service**
   * Handles model lifecycle, caching, GPU memory, versioning.
   * Orchestrator interacts via API: `requestInference(modelId, version, inputBuffer)`.

6. **Agent Developer Experience**
   * Agent SDK elevated to core product.
   * Provides language bindings (Rust, C++, AssemblyScript), message APIs, memory access libraries, and debugging tools.

7. **ABI & Plugin Security Model**
   * All plugins signed, versioned, and capability-declared.
   * ABI versioning enforced; orchestrator rejects incompatible modules.

---

## 3. Determinism Contracts

| Subsystem | Contract |
|-----------|----------|
| Scheduler | Linear FIFO/priority queue; logical clock ensures tick reproducibility; DAG deferred to v2. |
| WASM Agent | Step execution bounded and metered; no wall-clock I/O unless sandboxed; reproducible outputs per identical input sequence. |
| ONNX Runtime | CPU execution deterministic; GPU requires deterministic kernels; fallback to CPU maintains functional consistency. |

---

## 4. Shared Memory + Message Passing

* **Scope:** Orchestrator ↔ WASM agents
* **Mechanism:** `SharedArrayBuffer` + `Atomics`
* **Ownership Rules:** Single-writer, multi-reader; zero-copy only within orchestrator domain
* **Messaging API:**
  * `publish(topic, message)` → broadcast, FIFO per topic
  * `send(agentId, message)` → directed message
  * `joinChannel(agentId, channel)` → subscribe to named channel
* **Replayable:** All messages serialized with timestamps and logical tick references

---

## 5. Agent ABI & Plugin Model

| Feature | Description |
|---------|-------------|
| ABI Functions | `agent_init()`, `agent_step(context_ptr)`, `agent_receive(message_ptr)`, `agent_shutdown()` |
| Plugin Security | Signed modules with declared capabilities; version compatibility enforced |
| Sandboxing | No direct OS access; I/O and GPU access brokered through orchestrator |
| Versioning | ABI v1 enforced; orchestrator rejects mismatched plugin versions |

---

## 6. Architecture Principles (from TSD)

* **Node.js Orchestrator:** deterministic scheduler, state hub, message broker, replay logger
* **WASM Worker Pool:** CPU agent execution, instruction metering, sandboxed
* **ONNX Runtime:** GPU/CPU inference, deterministic mode, centrally managed
* **Optional UI:** read-only, pull-based snapshot, process-isolated

---

## 7. Performance & Reproducibility Targets

| Metric | Target |
|--------|--------|
| Scheduler tick overhead | < 10 ms per 50 agents |
| CPU agent step | < 5 ms per step under nominal workload |
| ONNX inference latency variance | ±5% across runs and platforms |
| Replay determinism | 100% bit-level reproducibility on CPU, functional reproducibility on GPU |
| Message throughput | ≥ 10k messages/sec via orchestrator bus without breaking determinism |

---

## 8. Acceptance Criteria

1. Deterministic replay across multiple runs (CPU bit-level, GPU functional).
2. Linear scheduler produces stable order under load.
3. WASM workers fully isolated with bounded execution.
4. ONNX inference consistent with GPU/CPU fallback.
5. Headless runtime operates across Linux, Windows, macOS.
6. UI attach/detach without affecting runtime.
7. No direct cross-agent communication; all flows through orchestrator.
8. Model management service functional and accessible via orchestrator API.
9. Agent SDK enables building, testing, and debugging compliant WASM agents.
10. Plugins enforce signing, versioning, and capability constraints.

---

## 9. Open Questions

* Arbitrated direct agent-to-agent memory channels: v1 or deferred?
* DAG scheduler release plan for v2.
* Logging format/versioning for cross-platform replay.

---

## 10. Future Extensions

* DAG-based scheduler (v2).
* Multi-instance federation.
* Dynamic scaling of WASM workers.
* Multi-tenant agent sandboxes.
* WASI-based host integration.

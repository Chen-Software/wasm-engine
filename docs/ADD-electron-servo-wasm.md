# Architecture Design Document: Electron + Servo + WASM Stack

**Version: 2.0**
**Date: 2025-12-13**

---

## 1. Overview

This architecture combines Electron for UI and orchestration, Servo for GPU-accelerated rendering, and WebAssembly (WASM) for high-performance computation. The primary goal is to achieve maximum CPU/GPU throughput and low-latency rendering (<16 ms frame times with minimal jitter) by employing advanced systems engineering patterns.

This document outlines a robust blueprint focusing on concurrency, resource management, and a tight feedback loop for performance profiling.

---

## 2. System Components

### 2.1 Electron Layer
- **Responsibilities:** UI rendering, OS integration, orchestration of worker threads, and serving as the central hub for the application lifecycle.
- **Processes:**
    - **Main process:** Manages app lifecycle, orchestrates tasks, and serves as the IPC hub for non-critical signals.
    - **Renderer process:** Displays the UI. **Crucially, it directly hosts the Servo engine via FFI for the hot latency path**, eliminating IPC overhead for rendering.

### 2.2 Servo Layer
- **Responsibilities:** Multi-threaded, GPU-accelerated rendering and layout calculations.
- **Integration:** Embedded as a Rust library (`servo_embed`) directly within the Electron renderer process using Node-API (FFI). This provides the lowest possible latency for frame updates.

### 2.3 WebAssembly (WASM) Layer
- **Responsibilities:** CPU-heavy, parallelizable computation (e.g., physics, simulations, data transformation).
- **Integration:** Loaded within a dedicated, NUMA-aware worker thread pool managed by the Electron main process. Data exchange occurs via a shared `SharedArrayBuffer`.

---

## 3. Memory Architecture & Management

### 3.1 Triple-Buffering for Contention-Free Rendering
To eliminate race conditions between WASM workers (producers) and the Servo engine (consumer), we will implement a **triple-buffering** strategy.

- **Structure:** Three identical buffer sets (A, B, C) are allocated within a single `SharedArrayBuffer`.
- **Flow:**
    1.  WASM writes compute results to the "back buffer" (e.g., A).
    2.  Servo reads layout data from the "front buffer" (e.g., B).
    3.  The Electron main process coordinates buffer swaps atomically using `Atomics.compareExchange()` on a metadata index.
- **Synchronization:** `Atomics.wait()` and `Atomics.notify()` are used to signal buffer readiness, preventing busy-polling and ensuring workers sleep until there is work to do.

### 3.2 Shared Memory Layout
The `SharedArrayBuffer` is partitioned into non-overlapping regions to prevent false sharing and improve cache performance.

```
[ Metadata (64B) | WASM Compute A (N) | WASM Compute B (N) | WASM Compute C (N) |
  Servo Layout A (M) | Servo Layout B (M) | Servo Layout C (M) | Result Cache (K) ]
  ↑
  Atomic flags for buffer state at offset 0–32
```

### 3.3 Generational Indices for Data Integrity
To prevent Use-After-Free (UAF) race conditions when passing pointers between WASM and Servo, we will use **generational indices**.

- **Structure:** An index is combined with a generation counter. `struct GenIndex { index: u32, generation: u32 }`
- **Validation:** Before dereferencing a pointer, Servo validates that the buffer's current generation matches the index's generation. Stale indices are safely rejected.

---

## 4. Thread Management & Scheduling

### 4.1 Mechanical Sympathy: Core Affinity and NUMA-Awareness
To maximize cache locality and minimize context-switching, threads are pinned to specific physical cores.

- **Topology Detection:** At startup, the application detects CPU core count and NUMA node topology.
- **Hybrid Thread Pool:** Cores are partitioned:
    - **Cores 0–2:** Reserved for the Electron main/UI thread and OS headroom.
    - **Cores 3–N/2:** Dedicated to the WASM worker pool.
    - **Cores N/2+1–N:** Dedicated to Servo’s internal rendering threads.
- **Implementation (Rust):**
  ```rust
  // Pseudo-code: affinity example
  let wasm_pool = ThreadPoolBuilder::new()
      .num_threads(cpu_count / 2)
      .spawn_handler(|f| {
          thread::Builder::new()
              .spawn_with_affinity(cores_3_to_half)
              .unwrap_or_else(|| thread::spawn(f))
      })
      .build_global();
  ```

### 4.2 Work-Stealing Queues & Backpressure
- **Work-Stealing:** The WASM thread pool uses a work-stealing queue (e.g., from Rust's `rayon` or `tokio`) to reduce lock contention and keep thread caches warm.
- **Backpressure:** If the result queue for Servo fills up, task submission from the Electron main process is slowed or paused. This prevents memory bloat and cascading latency spikes.

---

## 5. IPC and Data Flow

### 5.1 Eliminating IPC on the Hot Path
The primary performance bottleneck of traditional Electron architectures is IPC. We mitigate this as follows:
- **In-Process FFI:** Servo is embedded in the renderer process, allowing for direct, zero-copy function calls via Node-API.
- **Lock-Free Ring Buffers:** For non-critical control signals (e.g., task scheduling), a lock-free ring buffer is implemented in the shared `SharedArrayBuffer`. This provides a bounded, high-speed communication channel without kernel-level IPC.

### 5.2 Lock-Free Ring Buffer Example (Rust)
```rust
// Shared memory layout
struct TaskQueue {
    head: AtomicU32,        // Readers increment
    tail: AtomicU32,        // Writers increment
    tasks: [Task; 1024],    // Fixed-size ring
}

impl TaskQueue {
    // WASM worker: submit result
    fn submit(&self, result: Task) -> Result<(), &str> {
        let tail = self.tail.load(Ordering::Acquire);
        let next = (tail + 1) % 1024;
        if next == self.head.load(Ordering::Acquire) {
            return Err("full"); // Queue full, apply backpressure
        }
        self.tasks[tail as usize] = result;
        self.tail.store(next, Ordering::Release);
        // Atomics::notify(&self.tail, ...); // Notify consumer
        Ok(())
    }

    // Servo: consume result
    fn consume(&self) -> Option<Task> {
        let head = self.head.load(Ordering::Acquire);
        if head == self.tail.load(Ordering::Acquire) {
            return None; // Empty
        }
        let task = self.tasks[head as usize];
        self.head.store((head + 1) % 1024, Ordering::Release);
        Some(task)
    }
}
```

---

## 6. Performance & Latency Profiling

A system designed for performance must be measurable.
- **Frame-Time Instrumentation:** Key execution stages (task queueing, WASM execution, Servo layout, UI rendering) will be instrumented with `performance.now()` timestamps. This allows for a detailed breakdown of the latency budget.
- **Jitter Monitoring:** We will track the variance in frame times, as consistent latency is more critical for user experience than a low average with high variance.
- **Profiler Integration:** Use platform-native tools like `perf` (Linux) or Instruments (macOS) to identify low-level bottlenecks like cache misses and lock contention. If lock contention exceeds 5% of samples, the relevant synchronization mechanism will be redesigned.

### Example Instrumentation (JavaScript)
```javascript
const t0 = performance.now();
wasm_worker.postMessage({ task, token: t0 });
// In worker: self.postMessage({ type: 'timing', token: t0, wasm_start: t1, wasm_end: t2 });
// Main process correlates timings to identify bottlenecks.
```

---

## 7. GPU Acceleration Strategy

To fully leverage Servo, we must ensure a zero-copy pipeline from rendering to screen.
- **End-to-End GPU Rendering:** Use WebGPU or a compatible graphics API to compose the Electron UI and Servo's output directly on the GPU. Both components render to the same GPU framebuffer, avoiding costly CPU readbacks.
- **Pipelined Transfers:** If readback is unavoidable for specific tasks, use dedicated GPU-to-CPU transfer queues (e.g., Direct3D 12 copy queues) and pipeline them to avoid stalling the main rendering command stream.

---

## 8. Build & Deployment Strategy

- **WASM:** Compile with `--target wasm32-unknown-unknown` and enable `simd128`, `bulk-memory`, and `atomics` features. Run `wasm-opt -O3` to optimize.
- **Servo:** Compile as a static Rust library with Link-Time Optimization (LTO) and Profile-Guided Optimization (PGO) for maximum performance.
- **Electron:** Use `node-ffi-napi` or a similar library for the Servo bindings. Preload all WASM modules at startup to avoid runtime JIT variance.

---

## 9. Future Enhancements
- GPU acceleration for WASM (WebGPU via Electron).
- Dynamic worker scaling based on CPU load.
- Advanced scheduling to prioritize rendering frames vs. computation.
- WASI integration for direct system access from WASM modules.

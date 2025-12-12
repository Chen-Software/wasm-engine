# Architecture Design Document & Technical Review: Electron + Servo + WASM Stack

## 1. Overview & Strengths

This architecture combines a layered design that correctly separates concerns:
- **Electron**: Handles orchestration, OS integration, and UI.
- **Servo**: Provides GPU-accelerated, parallel rendering.
- **WebAssembly (WASM)**: Executes CPU-intensive, sandboxed computation.

The use of shared memory is a key strength, as it avoids expensive serialization and data copying between high-performance components. However, to achieve the performance and stability goals, several critical challenges in memory management, threading, and inter-process communication must be addressed.

This document details those challenges and proposes concrete, optimized solutions.

---

## 2. Architecture Visualization

```mermaid
graph TD
    subgraph "User Interface & Orchestration (Electron)"
        direction LR
        subgraph "Main Process"
            direction TB
            EM_Orchestrator["Task Orchestrator & IPC Hub"]
            EM_FS["Node.js APIs (File System, etc.)"]
        end

        subgraph "Renderer Process"
            direction TB
            UI_DOM["UI (DOM)"]
            FFI_Bindings["FFI Bindings (Node-API)"]
        end

        EM_Orchestrator -- "IPC (Control Msgs)" --> FFI_Bindings
    end

    subgraph "High-Performance Computation"
        direction LR
        subgraph "WASM Worker Threads"
            direction TB
            WASM_Pool["Worker Thread Pool<br>(Core-Affinitized)"]
        end
    end

    subgraph "GPU-Accelerated Rendering (In-Process)"
        direction LR
        subgraph "Servo Engine"
            direction TB
            Servo_Embed["Servo Embedded Library"]
            Servo_Threads["Internal Render Threads<br>(Core-Affinitized)"]
            Servo_GPU["GPU Acceleration (WebGPU/Vulkan)"]
            Servo_Embed --> Servo_Threads & Servo_GPU
        end
    end

    subgraph "Zero-Copy Data Exchange"
        SharedMem["SharedArrayBuffer<br>(Triple-Buffered, Partitioned)"]
    end

    EM_Orchestrator -- "Spawns & Manages" --> WASM_Pool
    FFI_Bindings -- "Direct FFI Calls" --> Servo_Embed

    WASM_Pool -- "Read/Write<br>(Compute Buffers + Gen Indices)" --> SharedMem
    Servo_Embed -- "Read/Write<br>(Layout Buffers + Gen Indices)" --> SharedMem

    Servo_Embed -- "Frame Ready" --> FFI_Bindings
    UI_DOM -- "Reads<br>(Result Buffers)" --> SharedMem


    style "Main Process" fill:#D6EAF8,stroke:#333,stroke-width:2px
    style "Renderer Process" fill:#D6EAF8,stroke:#333,stroke-width:2px
    style "WASM Worker Threads" fill:#D5F5E3,stroke:#333,stroke-width:2px
    style "Servo Engine" fill:#FDEDEC,stroke:#333,stroke-width:2px
    style SharedMem fill:#FEF9E7,stroke:#333,stroke-width:2px
```

---

## 3. Core Challenges & Solutions

### 3.1. Memory Management – Lifecycle & Contention

**Problem:** The initial design's use of a single `SharedArrayBuffer` introduces significant risks of data corruption from race conditions and contention between WASM workers (writing) and the Servo engine (reading).

**Solution:**

1.  **Triple-Buffering:** Implement a triple-buffering strategy for shared data. Designate three identical buffer sets (A, B, C). At any given time, one buffer is being written to by WASM, one is being read from by Servo, and the third is idle, ready for the next swap. The Electron main process coordinates buffer swaps using atomic compare-and-swap (CAS) operations on flags or offsets in a dedicated metadata region.

2.  **Efficient Synchronization:** Use `Atomics.wait()` and `Atomics.notify()` to synchronize access between threads. This allows workers to sleep efficiently until a buffer is ready for processing, avoiding power-hungry busy-polling loops.

3.  **Clear Memory Ownership:** Partition the `SharedArrayBuffer` into distinct, non-overlapping regions for each component (e.g., a WASM compute zone, a Servo layout zone, and a metadata zone). This partitioning prevents "false sharing" where unrelated data on the same cache line causes unnecessary invalidations.

**Refined Memory Layout:**
```
[ Metadata (64B) | WASM Compute A (N) | WASM Compute B (N) | WASM Compute C (N) |
  Servo Layout A (M) | Servo Layout B (M) | Servo Layout C (M) | Result Cache (K) ]
  ↑
  Atomic flags/offsets for buffer state at offset 0–32
```

### 3.2. Thread Management – Starvation & Latency Spikes

**Problem:** The formula `#CPU_cores - 1` for WASM workers is an oversimplification. It doesn't account for Servo's own multithreading capabilities and risks oversubscription—creating more logical threads than available physical cores. This leads to excessive context-switching, cache thrashing, and unpredictable latency spikes.

**Solution:**

1.  **Thread Affinity & NUMA-Aware Scheduling:** Where possible, bind threads to specific physical cores. WASM workers should be affinitized to one set of cores, while Servo's rendering threads are pinned to another. On multi-socket systems, align thread pools with NUMA nodes to maximize L3 cache locality.

2.  **Hybrid Thread Pool:** Implement a hybrid model with reserved cores to prevent priority inversion where critical UI threads starve:
    - **Cores 0–2:** Reserved for Electron main, UI rendering, and OS overhead.
    - **Cores 3–N/2:** Dedicated to the WASM worker pool.
    - **Cores N/2+1–N:** Dedicated to Servo's internal rendering thread pool.

3.  **Work-Stealing Queues:** Replace a single, global task queue with a work-stealing scheduler (e.g., using Rust's `rayon` or `tokio`). Each worker maintains its own task queue, reducing lock contention and keeping CPU caches "warm" with relevant data.

4.  **Backpressure:** Implement a backpressure mechanism. If the result queue from the WASM workers fills up, the main process should temporarily slow down or halt task submission. This prevents unbounded memory growth and cascading latency failures under heavy load.

**Pseudo-Code Example (Rust):**
```rust
// Illustrates setting thread affinity in a builder pattern
let wasm_pool = ThreadPoolBuilder::new()
    .num_threads(cpu_count / 2)
    .spawn_handler(|f| {
        thread::Builder::new()
            .spawn_with_affinity(cores_3_to_half) // Hypothetical affinity function
            .unwrap_or_else(|| thread::spawn(f))
    })
    .build_global();
```

### 3.3. IPC Overhead – The Latency Bottleneck

**Problem:** Using standard IPC for communication between the Electron renderer and the Servo engine creates a significant bottleneck. On a 120Hz display, the entire frame budget is only ~8.3ms. An IPC round-trip can easily consume 1–2ms of this budget, limiting the system's performance ceiling.

**Solution:**

1.  **Embed Servo In-Process (Recommended):** For the lowest possible latency, embed the Servo library directly into the Electron renderer process. Communication can then occur via a high-performance Foreign Function Interface (FFI) using Node-API native bindings. This completely eliminates IPC from the hot path (compute → render → screen).
    - **Trade-off:** This approach reduces process isolation. A crash in the Servo engine would bring down the entire renderer process. This risk must be weighed against the significant latency gains (~0.5–1ms per frame).

2.  **Memory-Mapped Files (If Isolation is Required):** If process isolation is a strict requirement, use memory-mapped files for exchanging large data buffers instead of traditional pipe/socket IPC. This mechanism is significantly lower latency as it involves sharing physical memory pages directly.

3.  **Lock-Free Ring Buffer for Control Signals:** For small, frequent control messages (like task scheduling or frame sync signals), implement a lock-free ring buffer within the shared memory region. Writers and readers update atomic head/tail pointers, enabling bounded, high-speed, and contention-free communication without involving the OS kernel.

### 3.4. Data Flow – Preventing Serialization & Race Conditions

**Problem:** The idea to "use indices/pointers instead of arrays" is correct but needs a robust synchronization model. If WASM generates an index that Servo then dereferences, there must be a mechanism to prevent use-after-free errors if the underlying buffer has already been swapped.

**Solution:**

1.  **Generational Indices:** Tag each buffer "generation" with a unique, monotonically increasing version number. When WASM produces a result, it includes the generation number alongside the index. Before Servo dereferences an index, it first validates that the index's generation matches the currently active buffer generation. Stale indices are safely rejected.

    ```rust
    struct GenerationalIndex {
        index: u32,
        generation: u32,
    }

    // In Servo:
    // if active_buffer.generation() != provided_index.generation {
    //     // Skip this data or wait for the correct buffer
    // }
    ```
2.  **Bounded Queues for Handoffs:** Use a fixed-size ring buffer (as described in the IPC section) for the handoff of results from WASM to Servo. This ensures predictable memory usage and latency without the risk of unbounded allocations.

3.  **Cross-Component Pointer Validation:** Treat all data passed between components as untrusted. Before dereferencing any index or pointer from another component into the shared memory space, rigorously validate its bounds and generation to prevent memory access violations.

---

## 4. Performance Measurement & Profiling

A robust measurement strategy is non-negotiable for a performance-critical system.

1.  **Frame-Time Breakdown Instrumentation:** Instrument the entire pipeline to log high-precision timestamps at each critical stage:
    - Task queued
    - WASM processing starts
    - WASM processing ends
    - Servo processing starts
    - Servo processing ends
    - Frame presented to the OS
    This allows for precise identification of latency bottlenecks.

2.  **Jitter Monitoring:** Track the *variance* in frame times, not just the average. High jitter (e.g., fluctuating between 5ms and 20ms) creates a poor user experience, even if the average latency is acceptable.

3.  **System-Level Profiling:** Use platform-native profiling tools like `perf` (Linux) or Instruments (macOS) to detect low-level issues such as cache misses, lock contention, and excessive context switches. If lock contention exceeds 5% of samples, the synchronization mechanism needs to be redesigned.

**Example Instrumentation Flow:**
```javascript
// Electron Main
const t0 = performance.now();
// Use a unique token to correlate measurements across threads
const taskToken = { taskId: 42, timestamp: t0 };
wasm_worker.postMessage({ task, token: taskToken });

// In WASM worker, log start/end times against the token.
// In Servo, log start/end times against the token.
// Correlate all logs to build a complete picture of a single frame's lifecycle.
```

---

## 5. GPU Integration Strategy

**Problem:** Simply having Servo render with the GPU is not enough. If Servo renders to a GPU texture and Electron then reads that texture back to the CPU for display (`readPixels`), the performance benefits are negated by the high latency of a PCIe round-trip.

**Solution:**

- **End-to-End GPU Rendering:** The optimal solution is to keep the entire rendering pipeline on the GPU. Use a modern graphics API like WebGPU (or Direct3D 12/Vulkan via native bindings) to compose the Electron UI and the Servo-rendered content directly into the same GPU framebuffer. This avoids any costly CPU readback.

- **Pipelined GPU-to-CPU Transfers (If Readback is Unavoidable):** If readback is an absolute necessity, use dedicated GPU-to-CPU transfer queues (e.g., Direct3D 12 copy queues) that can run asynchronously. This allows you to pipeline operations: begin submitting the GPU work for frame `N+1` while the results for frame `N` are still being transferred back to the CPU, minimizing pipeline stalls.

---

## 6. Revised Build & Deployment Strategy

- **WASM Compilation:** Compile with `--target wasm32-unknown-unknown` and enable the `simd128`, `bulk-memory`, and `atomics` features for maximum performance.
- **Servo Compilation:** Build Servo as a static Rust library with Link-Time Optimization (LTO) and Profile-Guided Optimization (PGO) enabled in the release profile.
- **Electron Integration:** Use `node-ffi-napi` or a similar FFI library for high-performance bindings to the Servo library. Preload and precompile all WASM modules at application startup to avoid runtime JIT variance and ensure predictable performance.

---

## 7. Summary of Recommendations

- **Memory:** Use a **triple-buffered** system with atomic synchronization and partitioned memory regions.
- **Threads:** Use **dedicated, core-affinitized thread pools** for UI, WASM, and Servo, and implement a work-stealing task queue.
- **IPC:** **Embed Servo directly in-process** and use an FFI. If isolation is required, use memory-mapped files and a lock-free ring buffer for communication.
- **Data Flow:** Use **generational indices** to ensure data integrity and prevent race conditions.
- **Performance:** **Instrument every stage** of the pipeline and target a frame latency of **<16ms (<8ms for 120Hz)** with minimal jitter.
- **GPU:** Ensure an **end-to-end GPU rendering pipeline** to avoid CPU readback stalls.

# Engineering Onboarding: Internal APIs and Architecture

**Welcome to the Wasm-Engine Team!**

This document provides a technical overview of the internal architecture and the core APIs you will be working with. It is intended for new engineers joining the project.

**Prerequisites**:
- Familiarity with the **Product Requirements Document (PRD)**.
- A thorough understanding of the **Master Architecture Design (MAD)**.

---

## 1. Core Philosophy: The Orchestrator is King

Our entire system is built around a single, critical principle: **the orchestrator is the single source of truth**. It is a single-threaded, deterministic engine responsible for scheduling all agent activity. To maintain determinism, no other part of the system is allowed to make its own scheduling decisions.

-   **Your work must never block the orchestrator's event loop.**
-   **Complex or long-running tasks must be offloaded to WASM workers or the ONNX Runtime.**

---

## 2. Codebase Structure

```
/src
├── orchestrator/      # The core deterministic scheduler and task queue
│   ├── scheduler.js
│   └── task_queue.js
├── wasm_runtime/      # Manages the WASM worker pool
│   ├── worker_manager.js
│   └── worker_thread.js   # The code that runs inside each worker
├── onnx_runtime/      # Interface to the ONNX Runtime
│   └── onnx_bridge.js
├── ipc/                # APIs for inter-process communication
│   ├── ui_channel.js      # The read-only channel for the optional UI
│   └── agent_bus.js       # The primary message bus for agent communication
└── common/              # Shared utilities, constants, and data structures
    └── memory_layout.js   # Defines the structure of the SharedArrayBuffers
```

---

## 3. Internal APIs

This section describes the primary internal interfaces. These are not public APIs for agent developers, but rather the contracts between our system's components.

### 3.1 Orchestrator API (`orchestrator/scheduler.js`)

The scheduler is the heart of the system.

```javascript
class Scheduler {
  /**
   * Adds a task to the central queue.
   * @param {Task} task - The task object, containing agentId, type, and payload.
   */
  enqueueTask(task) { /* ... */ }

  /**
   * Executes a single "tick" of the runtime. This is the main loop.
   * It will dequeue the next task, dispatch it to the appropriate runtime (WASM or ONNX),
   * and handle the result.
   */
  tick() { /* ... */ }
}
```

### 3.2 Agent Message Bus API (`ipc/agent_bus.js`)

This is the **primary way agents should communicate**. It is a safe, structured API that abstracts away the complexity of shared memory.

```javascript
class AgentMessageBus {
  /**
   * Broadcasts a message to all agents subscribed to a topic.
   * @param {string} topic
   * @param {object} message - A serializable JavaScript object.
   */
  publish(topic, message) { /* ... */ }

  /**
   * Sends a direct message to a specific agent.
   * @param {string} agentId
   * @param {object} message
   */
  send(agentId, message) { /* ... */ }
}
```

### 3.3 WASM Worker Manager API (`wasm_runtime/worker_manager.js`)

This module is responsible for managing the lifecycle of the WASM worker threads.

```javascript
class WasmWorkerManager {
  /**
   * Creates and initializes the worker pool.
   * @param {number} poolSize
   */
  constructor(poolSize) { /* ... */ }

  /**
   * Dispatches a CPU-bound task to an available worker.
   * Returns a Promise that resolves with the result.
   * @param {WasmTask} task
   * @returns {Promise<any>}
   */
  dispatchTask(task) { /* ... */ }
}
```

### 3.4 ONNX Bridge API (`onnx_runtime/onnx_bridge.js`)

This is the interface for scheduling GPU-bound inference tasks. It is responsible for data transfer to and from the ONNX Runtime.

```javascript
class OnnxBridge {
  /**
   * Loads a model and prepares it for inference.
   * @param {string} modelPath
   */
  async loadModel(modelPath) { /* ... */ }

  /**
   * Executes an inference session.
   * @param {string} modelId
   * @param {SharedArrayBuffer} inputBuffer - A buffer containing the input tensor data.
   * @param {SharedArrayBuffer} outputBuffer - A buffer to write the output tensor data into.
   * @returns {Promise<void>}
   */
  async runInference(modelId, inputBuffer, outputBuffer) { /* ... */ }
}
```

---

## 4. Working with Shared Memory

While the message bus is the preferred communication channel, you may occasionally need to work directly with `SharedArrayBuffer` for performance-critical tasks.

-   **Memory Layout**: The structure of our shared buffers is defined in `common/memory_layout.js`. This is the single source of truth for buffer offsets and data types. **Never use magic numbers** to access buffer locations.
-   **Synchronization**: All access to shared memory **must** be synchronized using `Atomics` (`Atomics.wait`, `Atomics.notify`, `Atomics.store`, etc.). The orchestrator uses a turn-based model, but synchronization is still required when passing data between the main thread and workers.
-   **Tooling**: Familiarize yourself with the memory debugging tools available in modern versions of Node.js and Chrome DevTools. They are essential for diagnosing issues related to shared memory.

---

## 5. Getting Started: Your First Week

1.  **Day 1**: Set up your development environment. Read the PRD and MAD in full.
2.  **Day 2**: Clone the repository and run the existing test suite. Familiarize yourself with the codebase structure.
3.  **Day 3**: Your mentor will assign you a good first bug, likely a small, well-defined issue in one of the `common` utilities or the `ipc` layer.
4.  **Day 4-5**: Implement the fix, write a unit test, and submit your first pull request. Use this as an opportunity to learn our code review and CI/CD process.

Welcome aboard!

---
id: ADR-005
title: "Plugin Signing & ABI Enforcement"
status: "Proposed"
date: 2025-12-17
related:
  - ADR-001
tags:
  - runtime
  - security
  - abi
---

# 1. Context

To ensure the integrity and security of the multi-agent system, the runtime must have a mechanism to verify the authenticity of agent plugins (WASM modules) and enforce a stable Application Binary Interface (ABI).

# 2. Decision

-   **Plugin Signing:** All agent WASM modules must be cryptographically signed. The orchestrator will verify this signature before loading the module.
-   **ABI Enforcement:** The runtime will expose a versioned ABI. Each agent must declare the ABI version it targets. The orchestrator will refuse to load agents that target an incompatible or unknown ABI version.

# 3. Rationale

-   **Security:** Signing prevents the execution of unauthorized or tampered agent code.
-   **Stability:** A versioned ABI ensures that changes to the runtime's internal APIs do not break existing agents, and vice-versa.

# 4. Consequences

-   **Positive:** Greatly improves the security and stability of the system.
-   **Negative:** Adds complexity to the agent development and deployment workflow, requiring a signing and versioning process.

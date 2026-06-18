---
name: pi-a2a-communication
phase: "Phase 1: A2A Client Extension (pi package)"
progress: 25
status: active
last_updated: 2026-06-18
---

# PLAN — pi-a2a-communication

## Current Release: v0.1.0-alpha.1 | Next: v0.2.0-alpha.2 (Client Polish)

### Release History

| Version | Date | Description |
|---------|------|-------------|
| v0.1.0-alpha.1 | 2026-06-18 | Fork from DrOlu/pi-a2a-communication v1.0.1, A2A v1.0 spec fixes, TDD scaffold, renamed to pi-a2a-communication |

### Upcoming Releases

| Version | Phase | Description | Status |
|---------|-------|-------------|--------|
| v0.2.0-alpha.2 | Phase 1 | Client tool polish, streaming improvements | ⬜ Planned |
| v0.3.0-alpha.3 | Phase 1 | Package publish to npm | ⬜ Planned |
| v1.0.0 | Phase 2 | Stable client release | ⬜ Deferred |

**See:** [A2A Migration Plan](../../../personal-vault/02-Areas/Infrastructure/pi-cross-node-comms/wiki/architecture/A2A-migration-plan.md) for the full migration context.

---

## Phase 1: A2A Client Extension

### Objective

Produce a polished, spec-compliant A2A client extension for pi that provides slash commands (`/a2a-discover`, `/a2a-send`, etc.) and tools (`a2a_call`, `a2a_parallel`) for pi agents. This is a pi package installable via `npm install pi-a2a-communication`.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│              pi-a2a-communication (this package)      │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Slash         │  │ Tools         │  │ Agent       │ │
│  │ Commands      │  │ a2a_call,     │  │ Discovery   │ │
│  │ /a2a-discover │  │ a2a_parallel  │  │ + Cards     │ │
│  │ /a2a-send     │  │               │  │ + Caching   │ │
│  │ /a2a-status   │  │               │  │             │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │        │
│  ┌──────┴─────────────────┴──────────────────┴──────┐ │
│  │                  A2A Client                       │ │
│  │  sendMessage, sendStreamingMessage, getTask,       │ │
│  │  cancelTask, discoverAgent                        │ │
│  └──────────────────────┬────────────────────────────┘ │
│                         │ A2A Protocol (JSON-RPC)      │
└─────────────────────────┼──────────────────────────────┘
                          │
                   ┌──────┴──────┐
                   │  A2A Server  │  ← pi-a2a-gateway (separate project)
                   │  (remote)    │
                   └─────────────┘
```

---

## v0.2.0-alpha.2 — Client Tool Polish

- [ ] 2.1 Improve `/a2a-send` command output formatting
  - goal: Slash command provides clear, readable output for task results
  - verify: `/a2a-send` command returns formatted response with status, duration, and artifact summary
- [ ] 2.2 Improve `/a2a-discover` command with better Agent Card display
  - goal: Agent discovery shows capability, endpoint, and authentication info clearly
  - verify: `/a2a-discover` command renders Agent Card in readable format
- [ ] 2.3 Add error handling and retry for client operations
  - goal: Client gracefully handles network errors, timeouts, and malformed responses
  - verify: Error scenarios return actionable error messages, not stack traces
- [ ] 2.4 Improve streaming client experience
  - goal: `sendStreamingMessage` provides incremental SSE updates visible in pi
  - verify: Streaming tasks show progress updates in pi console

## v0.3.0-alpha.3 — Package Publish

- [ ] 3.1 Clean up package.json for npm publish
  - goal: Package is ready for public npm registry
  - verify: `npm publish --dry-run` succeeds with correct file list
- [ ] 3.2 Update README with installation and usage instructions
  - goal: Users can install and configure the extension from README alone
  - verify: Fresh install following README works end-to-end
- [ ] 3.3 Add CONTRIBUTING.md and LICENSE (if missing)
  - goal: Open-source contribution guidelines are clear
  - verify: CONTRIBUTING.md covers fork, branch, PR process
- [ ] 3.4 Publish to npm as pi-a2a-communication
  - goal: Package is available on npm registry
  - verify: `npm install pi-a2a-communication` works

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fork pi-a2a-communication | Fork then enhance | Base has protocol code but no tests, streaming, or execution bridge |
| A2A spec compliance first | Fix spec gaps before features | Protocol compliance is foundational |
| Separate client from server | Client = pi package, Server = standalone binary | Different deployment models, different lifecycles |
| Keep a2a-server.ts for local testing | Local test server in client package | Useful for development; production server is pi-a2a-gateway |
| TDD mandatory | Characterization → spec → unit | Prevents regression on protocol compliance |

## Open Items

- Should `a2a-server.ts` be removed from the client package entirely, or kept as a dev dependency?
- Enterprise types (LoadBalanceStrategy, AgentPool, workflows) — implement here or leave for pi-a2a-gateway?
- Task persistence backend: file, SQLite, or in-memory Map with snapshots — server concern?

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-18*
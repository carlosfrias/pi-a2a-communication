---
name: pi-a2a-communication
summary: "A2A v1.0 spec-compliant client extension for pi. Characterization tests done, spec fixes applied. Next: client-side tool polish, streaming improvements, package publish."
status: active
phase: "Phase 1: A2A Client Extension (pi package)"
progress: 25
tracked: true
created: 2026-06-18
updated: 2026-06-18
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**Forked from DrOlu/pi-a2a-communication v1.0.1. A2A v1.0 spec compliance fixes applied. Characterization tests passing. This is the CLIENT extension (slash commands + tools). The standalone gateway server is a separate project: pi-a2a-gateway.**

## Current State

| Component | ID | Status | Priority |
|-----------|-----|--------|----------|
| A2A v1.0 Spec Compliance | M1.5 | ✅ Done | — |
| Characterization Tests | M1.4 | ✅ Done | — |
| Agent Card Generator | M2.2 | ✅ Done | — |
| Client Tool Polish | M4.1 | ⬜ Not started | 🟡 Medium |
| Streaming SSE Client | M4.2 | ⬜ Not started | 🟡 Medium |
| Package Publish to npm | M4.3 | ⬜ Not started | 🟡 Medium |

## Milestone Progress (from pi-cross-node-comms PLAN)

| Milestone | Task | Status | Tracked In |
|-----------|------|--------|------------|
| M1.1 | Fork pi-a2a-communication | ✅ Done | pi-cross-node-comms |
| M1.2 | Audit source code | ✅ Done | pi-cross-node-comms |
| M1.3 | Set up test framework | ✅ Done | pi-cross-node-comms |
| M1.4 | Write characterization tests | ✅ Done | pi-cross-node-comms |
| M1.5 | Update pi-package.json + rename | ✅ Done | This project |
| M1.6 | Fix A2A v1.0 spec compliance | ✅ Done | pi-cross-node-comms |
| M2.2 | Generate Agent Cards | ✅ Done | pi-cross-node-comms |
| M4.1 | Client tool polish | ⬜ | This project |
| M4.2 | Streaming SSE client improvements | ⬜ | This project |
| M4.3 | Package publish | ⬜ | This project |

## Active Work

- [ ] **M4.1: Client tool polish** — Improve slash commands and tool functions for production use
- [ ] **M4.2: Streaming SSE client** — Enhance client-side streaming support
- [ ] **M4.3: Package publish** — Publish to npm as pi-a2a-communication

## Key Gaps (from Source Audit)

| Gap | Severity | Description |
|-----|----------|-------------|
| `executePiTask()` stub | 🔴 Critical | Returns placeholder string — server-only concern, moves to pi-a2a-gateway |
| Enterprise types unused | 🟡 Medium | `LoadBalanceStrategy`, `AgentPool`, `workflows` defined but not implemented |
| CORS: `Access-Control-Allow-Origin: *` | 🟡 Medium | Insecure for production — server concern, moves to pi-a2a-gateway |
| In-memory task store | 🟡 Medium | `this.tasks = new Map()` — no persistence across restarts |
| No rate limiting | 🟡 Medium | Production ingress needs rate limiting — server concern |

## Design Decisions

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Fork pi-a2a-communication | Fork then enhance | Base package has protocol implementation but no tests, no streaming, no execution bridge. Fork allows TDD-driven development. | 2026-06-18 |
| A2A v1.0 spec compliance first | Spec compliance before features | Protocol compliance is foundational. Can't build features on a non-compliant base. | 2026-06-18 |
| Separate client from server | pi-a2a-communication = client, pi-a2a-gateway = server | Client extension (slash commands + tools) is a pi package. Server/gateway is a standalone binary. Different deployment models, different lifecycles. | 2026-06-18 |
| Keep a2a-server.ts for local testing | Local test server in client package | Useful for development and testing. Production server is pi-a2a-gateway. | 2026-06-18 |

## Handoff Notes

**Project freshly renamed from pi-a2a-gateway to pi-a2a-communication.** M1 milestones (fork, audit, tests, spec fixes) are done. The package now has a clear identity: CLIENT EXTENSION only. Server responsibilities moved to pi-a2a-gateway (separate project). Next milestones are client-side polish and package publishing.

**Cross-references:**
- Parent project: [pi-cross-node-comms](../pi-cross-node-comms/AGENTS.md) — A2A migration tracked in its PLAN
- Sibling project: [pi-a2a-gateway](../pi-a2a-gateway/AGENTS.md) — standalone A2A server
- Migration plan: [A2A-migration-plan.md](../../../personal-vault/02-Areas/Infrastructure/pi-cross-node-comms/wiki/architecture/A2A-migration-plan.md)
- Executive paper: [A2A-migration-executive-paper.md](../../../personal-vault/02-Areas/Infrastructure/pi-cross-node-comms/wiki/architecture/A2A-migration-executive-paper.md)

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1.0-alpha.1 | 2026-06-18 | Initial fork, spec compliance fixes, TDD scaffold, FPB project setup |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-18*
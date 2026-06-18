---
name: pi-a2a-communication
summary: "A2A v1.0 spec-compliant client extension for pi. 84 tests passing. Installed and ready. Next: M4.1 client polish, then npm publish."
status: active
phase: "M4: Client Polish — v0.2.0-alpha.2"
progress: 40
tracked: true
created: 2026-06-18
updated: 2026-06-18
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**A2A v1.0 spec-compliant pi extension. 84 tests passing. Installed in pi. Client-only package — server code belongs in pi-a2a-gateway.**

## Current State

| Component | Status | Details |
|-----------|--------|---------|
| Spec compliance | ✅ Done | 10 fixes applied: method names, agent-card path, resubscribe, push config, extended card |
| Characterization tests | ✅ Done | 4 suites (types, config, server, task-manager), 74 tests |
| Spec compliance tests | ✅ Done | 10 tests, all passing |
| Package identity | ✅ Done | `pi-a2a-communication` v0.1.0-alpha.1, installed via `pi install` |
| Agent Cards | ✅ Done | 8 cards + fleet registry in `~/.pi/agent/a2a/agents/` |

## Completed (M1–M2)

- [x] M1.1: Fork to `carlosfrias/pi-a2a-communication`
- [x] M1.2: Audit source code (7 files, 3,260 lines, 10 critical gaps)
- [x] M1.3: Vitest framework (84 tests)
- [x] M1.4: Characterization tests (4 suites)
- [x] M1.5: Package renamed to `pi-a2a-communication` v0.1.0-alpha.1
- [x] Spec compliance: JSON-RPC methods, agent-card path, resubscribe, push config, extended card
- [x] M2.2: Agent Cards generated for 7 fleet nodes + orchestrator
- [x] Project split: client (this package) vs server (pi-a2a-gateway)

## Active Work

- [ ] **M4.1: Client tool polish** — Improve `/a2a-send` formatting, `/a2a-discover` display, error handling
- [ ] **M4.2: Streaming SSE client** — Improve `sendStreamingMessage` UX in pi console
- [ ] **M4.3: Package publish** — Publish to npm as `pi-a2a-communication`

## Design Decisions

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Fork then enhance | Fork DrOlu v1.0.1 | Base has protocol code but no tests; TDD approach on fork | 2026-06-18 |
| Spec compliance first | Fix before features | Protocol compliance is foundational | 2026-06-18 |
| Client/server split | Client in this package, server in pi-a2a-gateway | Different deployment models and lifecycles | 2026-06-18 |
| Keep a2a-server.ts locally | Dev/test server stays in client package | Useful for local testing; production server is pi-a2a-gateway | 2026-06-18 |

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Pi extension entry point, slash commands, tools |
| `a2a-client.ts` | A2A client for calling remote agents |
| `a2a-server.ts` | Local test server (production server is pi-a2a-gateway) |
| `task-manager.ts` | Task lifecycle management |
| `agent-discovery.ts` | Agent Card discovery and caching |
| `config.ts` | Configuration management |
| `types.ts` | Type definitions including A2A_METHODS, AGENT_CARD_PATH |
| `tests/` | 84 tests (74 characterization + 10 spec-compliance) |
| `scripts/generate-agent-cards.ts` | Fleet Agent Card generator |

## Cross-References

| Project | Relationship |
|---------|--------------|
| [pi-a2a-gateway](../pi-a2a-gateway/AGENTS.md) | Standalone A2A server (sibling) |
| [pi-cross-node-comms](../pi-cross-node-comms/AGENTS.md) | Parent project, A2A migration tracked in its PLAN |
| [A2A Migration Plan](../../../personal-vault/02-Areas/Infrastructure/pi-cross-node-comms/wiki/architecture/A2A-migration-plan.md) | Full migration strategy |

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1.0-alpha.1 | 2026-06-18 | Fork, spec fixes, TDD scaffold, project split |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-18*
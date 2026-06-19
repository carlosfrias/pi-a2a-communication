---
name: pi-a2a-communication
phase: "M5: Upstream Integration — Fork Archived"
progress: 90
status: active
last_updated: 2026-06-19
---

# PLAN — pi-a2a-communication

## Current: v1.0.1 (upstream) deployed to all fleet nodes

### Release History

| Version | Date | Description |
|---------|------|-------------|
| v1.0.1 (upstream) | 2026-06-18 | Deployed to all 7 fleet nodes via `pi install npm:pi-a2a-communication` |
| v0.1.0-alpha.1 (fork) | 2026-06-18 | Fork with A2A v1.0 spec fixes, 84 tests — **to be archived** |

---

## M5: Upstream Integration (Current)

- [x] M5.1: Install upstream v1.0.1 on all fleet nodes
- [x] M5.2: Deploy per-node config with `server.enabled: true`
- [x] M5.3: Deploy Agent Cards to all fleet nodes
- [x] M5.4: Verify A2A servers on all 7 nodes (44 integration tests passing)
- [x] M5.5: Archive fork (`carlosfrias/pi-a2a-communication`)
- [ ] M5.6: Submit spec compliance issues to upstream (`DrOlu/a2a-communication`)
- [ ] M5.7: Remove fork from pi-a2a-gateway dev dependencies

## Spec Compliance Issues to Upstream

| Issue | Fix | Priority |
|-------|-----|----------|
| HTTP 400 for JSON-RPC errors | Return HTTP 200 with JSON-RPC error body | High |
| No WWW-Authenticate on 401 | Add `WWW-Authenticate: Bearer` header | Medium |
| tasks/get response format | Return `{result: {task: ...}}` not `{task: ...}` | Medium |
| Legacy API paths | Add `/message/send` and `/.well-known/agent.json` as aliases | Low |

---

## Completed Milestones

### M1: Fork & Audit (Done)
- [x] M1.1: Fork to `carlosfrias/pi-a2a-communication`
- [x] M1.2: Audit source code (7 files, 3,260 lines, 10 critical gaps)
- [x] M1.3: Vitest framework (84 tests)
- [x] M1.4: Characterization tests (4 suites)
- [x] M1.5: Package renamed to `pi-a2a-communication` v0.1.0-alpha.1

### M2: Agent Cards (Done)
- [x] M2.2: Generate Agent Cards for 7 fleet nodes + orchestrator
- [x] M2.3: Deploy Agent Cards to all fleet nodes

### M3: Fleet Deployment (Done)
- [x] M3.1: Deploy config to all 7 nodes
- [x] M3.2: Restart pi on all nodes
- [x] M3.3: Verify A2A servers on all nodes

### M4: Client Polish (Cancelled)
- [-] M4.1: Client tool polish — **Cancelled**: using upstream v1.0.1
- [-] M4.2: Streaming SSE client — **Cancelled**: using upstream v1.0.1
- [-] M4.3: Package publish — **Cancelled**: using upstream v1.0.1

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Use upstream v1.0.1 on fleet | Not our fork | Fork was for gateway testing; fleet uses npm package directly |
| Archive fork | Yes | No longer needed; spec fixes go upstream |
| Spec fixes to upstream | Submit as issues/PRs | Better for the community; we don't maintain a fork |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-19*
---
name: pi-a2a-communication
summary: "Upstream v1.0.1 deployed to all fleet nodes. Fork archived. A2A servers active on all 7 nodes."
status: active
phase: "M5: Upstream Integration — Fork Archived"
progress: 90
tracked: true
created: 2026-06-18
updated: 2026-06-19
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**Upstream v1.0.1 deployed to all 7 fleet nodes. Fork to be archived. A2A servers active and tested. Spec fixes to upstream.**

## What's Done

- ✅ Upstream `pi-a2a-communication@1.0.1` installed on all 7 fleet nodes
- ✅ A2A servers active on port 10000 on all nodes
- ✅ Bearer token auth configured (`lab-fleet-2026`)
- ✅ Agent Cards deployed to all nodes
- ✅ 44 integration tests passing across all 7 nodes
- ✅ Fork `carlosfrias/pi-a2a-communication` created (to be archived)
- ✅ Spec compliance issues identified (upstream fixes needed)

## Active Work

- [ ] **Archive fork** — `carlosfrias/pi-a2a-communication` is no longer needed; fleet uses upstream v1.0.1
- [ ] **Upstream spec fixes** — Submit issues/PRs to `DrOlu/a2a-communication` for:
  - HTTP 400 for JSON-RPC errors (should be 200 per spec)
  - No `WWW-Authenticate` header on 401 responses
  - `tasks/get` returns task directly (should return `result.task`)
  - Legacy paths (`/sendMessage` vs `/message/send`, `/.well-known/agent-card` vs `/.well-known/agent.json`)

## Key Decisions

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Use upstream v1.0.1 on fleet | Not our fork | Fork was for gateway testing; fleet uses npm package | 2026-06-18 |
| A2A runs inside pi | Not standalone | Same deployment model as coms-net | 2026-06-18 |
| Per-node config | `~/.pi/agent/a2a/config.json` | Standard pi extension config path | 2026-06-18 |
| Agent Cards | `~/.pi/agent/a2a/agents/{hostname}-agent.json` | Per-node identity | 2026-06-18 |
| Archive fork | Yes | No longer needed; spec fixes go upstream | 2026-06-19 |

## Spec Compliance Issues (Upstream)

| Issue | Severity | Description |
|-------|----------|-------------|
| Wrong HTTP status for JSON-RPC errors | High | Returns 400 instead of 200 for JSON-RPC error responses |
| Missing WWW-Authenticate | Medium | 401 responses lack `WWW-Authenticate: Bearer` header |
| tasks/get response format | Medium | Returns task directly instead of `{result: {task: ...}}` |
| Legacy paths | Low | Uses `/sendMessage` and `/.well-known/agent-card` instead of spec paths |

## Cross-References

| Project | Status | Relationship |
|---------|--------|--------------|
| [pi-a2a-gateway](../pi-a2a-gateway/FOCUS.md) | Active, A4 blocked | Fleet integration tests + reference code |
| [pi-cross-node-comms](../pi-cross-node-comms/FOCUS.md) | DEPRECATED, sunset | Being replaced by A2A |

---

*Last updated: 2026-06-19*
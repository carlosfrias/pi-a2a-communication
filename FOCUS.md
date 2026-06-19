---
name: pi-a2a-communication
summary: "Upstream v1.0.1 deployed to all fleet nodes. Fork archived. 7 A2A v1.0 spec gaps identified (S1–S6b). A2A servers active on all 7 nodes."
status: active
phase: "M5: Upstream Integration — Fork Archived"
progress: 95
tracked: true
created: 2026-06-18
updated: 2026-06-19
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**Upstream v1.0.1 deployed to all 7 fleet nodes. Fork archived. A2A servers active and tested. 7 spec gaps identified (S1–S6b), deferred to upstream.**

## What's Done

- ✅ Upstream `pi-a2a-communication@1.0.1` installed on all 7 fleet nodes
- ✅ A2A servers active on port 10000 on all nodes
- ✅ Bearer token auth configured (`lab-fleet-2026`)
- ✅ Agent Cards deployed to all nodes
- ✅ 44 integration tests passing across all 7 nodes
- ✅ Fork `carlosfrias/pi-a2a-communication` archived on GitHub
- ✅ Conformance audit completed (deepseek-v4-pro:cloud + kimi-k2.7-code:cloud)
- ✅ 19-test Vitest conformance suite (6 passing, 13 failing)

## Active Work

- [x] **Archive fork** — `carlosfrias/pi-a2a-communication` archived on GitHub
- [>] **Upstream spec fixes** — Deferred (not submitting issues to DrOlu/pi-a2a-communication at this time)

## Key Decisions

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Use upstream v1.0.1 on fleet | Not our fork | Fork was for gateway testing; fleet uses npm package | 2026-06-18 |
| A2A runs inside pi | Not standalone | Same deployment model as coms-net | 2026-06-18 |
| Per-node config | `~/.pi/agent/a2a/config.json` | Standard pi extension config path | 2026-06-18 |
| Agent Cards | `~/.pi/agent/a2a/agents/{hostname}-agent.json` | Per-node identity | 2026-06-18 |
| Archive fork | Yes | No longer needed; spec fixes go upstream | 2026-06-19 |

## Spec Compliance Gaps (S1–S6b)

| ID | Severity | Issue | Spec Requirement |
|----|----------|-------|-----------------|
| S1 | 🟡 Medium | JSON-RPC errors return HTTP 400 | JSON-RPC over HTTP convention: HTTP 200 |
| S2 | 🔴 High | 401 responses lack `WWW-Authenticate` | RFC 7235 §2.1: MUST include on 401 |
| S3 | 🔴 High | Wrong Agent Card discovery path | A2A v1.0 §8.2: `/.well-known/agent-card.json` |
| S4 | 🔴 High | Missing `/rpc`, `/message:send`, `/message:stream` | A2A v1.0 §9.2/§11.3.1 |
| S5 | 🔴 High | `/sendMessage` uncaught parse error → HTTP 500 | JSON-RPC §5.1 |
| S6 | 🔴 High | Method names slash-separated, not PascalCase | A2A v1.0 §5.3: `SendMessage`, `GetTask` |
| S6b | 🟢 Low | `id: 0` instead of `id: null` in parse errors | JSON-RPC §5.1 |

→ Full report: [A2A-v1-Conformance-Report](./wiki/A2A-v1-Conformance-Report.md)  
→ Audit report: `A2A-v1-CONFORMANCE-AUDIT.md` (in code repo)

## Cross-References

| Project | Status | Vault Location |
|---------|--------|----------------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived — replaced by A2A | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |

---

*Last updated: 2026-06-19*
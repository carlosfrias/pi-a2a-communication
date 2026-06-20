---
name: pi-a2a-communication
summary: "v0.3.0 released. Wiki remediated, fleet hardware audited. 206/206 tests. node-router not integrated with A2A."
status: active
phase: "Post-M10: Deployment + Docs"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-06-20
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**v0.3.0 deployed. All milestones M6–M10 complete. 206/206 tests passing. Wiki remediated per Rule 25/27. Fleet hardware documented accurately.**

## What's Done

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7: 6 upstream issues filed (#3–#8)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features — broadcast, chain, status, a2a_chain tool
- ✅ M10: Server integration — PiTaskBridge, SubprocessPiTaskBridge, session handler
- ✅ M10.5: Fleet deployment (all 7 nodes on v0.3.0)
- ✅ M10.6: PiSessionTaskHandler with fallback
- ✅ Wiki remediation — Rule 25/27 compliant, stale files removed, vault synced
- ✅ Fleet hardware audit — node-pool.json v2.0.0 with actual specs
- ✅ 206/206 tests passing

## Known Gaps

- **node-router is inert** — targets coms-net (deprecated), not A2A; health data 3+ weeks stale; `capacity_score=0` on CPU-only nodes
- **local-model-pilot profiles empty** — all fleet nodes have empty model routing profiles
- **PiSessionTaskHandler blocked** — `ctx.newSession()` not available in pi v0.79.4

## Next Steps

- [ ] Integrate node-router with A2A (replace coms-net dispatch with A2A tools)
- [ ] Fix node-router capacity_score formula for CPU-only nodes
- [ ] Configure local-model-pilot on fleet nodes
- [ ] M7.2: Offer PR to upstream if maintainer responds
- [ ] Wait for pi `newSession()` API

## Spec Compliance Status

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| S1 | 🟡 Medium | JSON-RPC errors return HTTP 400 | ✅ Fixed |
| S2 | 🔴 High | 401 responses lack `WWW-Authenticate` | ✅ Fixed |
| S3 | 🔴 High | Wrong Agent Card discovery path | ✅ Fixed |
| S4 | 🔴 High | Missing `/rpc`, `/message:send`, `/message:stream` | ✅ Fixed |
| S5 | 🔴 High | `/sendMessage` uncaught parse error → HTTP 500 | ✅ Fixed |
| S6 | 🔴 High | Method names slash-separated, not PascalCase | ✅ Fixed |
| S6b | 🟢 Low | `id: 0` instead of `id: null` in parse errors | ✅ Fixed |

→ Full report: [A2A-v1-Conformance-Report](./wiki/pi-a2a-communication/reference/A2A-v1-Conformance-Report.md)
→ Audit report: [A2A-v1-Conformance-Audit](./wiki/pi-a2a-communication/reference/A2A-v1-Conformance-Audit.md)

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |
| node-router | ⚠️ Not integrated | [node-router](../../node-router/) — targets coms-net, not A2A |

---

*Last updated: 2026-06-20*
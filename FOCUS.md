---
name: pi-a2a-communication
summary: "v0.3.0 released. PiTaskBridge + a2a_chain tool + broadcast improvements. 196/196 tests passing."
status: active
phase: "M9+M10: Client Features + Server Integration"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-06-19
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**M6 COMPLETE. All 7 A2A v1.0 spec gaps (S1–S6b) fixed. 19/19 conformance tests passing. Fleet deployed — all 7 nodes on v0.2.0-alpha.1.**

## What's Done

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests passing
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features — taskAgents tracking, broadcast improvements, chain refactor, status cache lookup, a2a_chain tool
- ✅ M10.0–M10.4: PiTaskBridge interface, executePiTask stub replaced, SubprocessPiTaskBridge, integration tests
- ✅ 196/196 tests passing

## Next Steps

- [ ] M10.5: Deploy and update documentation (CA-3 updated, version bump, CHANGELOG)
- [ ] M7: Submit spec issues to upstream

## Key Decisions

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Use upstream v1.0.1 on fleet | Not our fork | Fleet uses npm package directly | 2026-06-18 |
| Reactivate fork for M6 | Yes | Upstream not responding; we need spec-compliant A2A | 2026-06-19 |
| M6 priority order | P0→P1→P2 | Security/crash bugs before spec paths | 2026-06-19 |

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

---

*Last updated: 2026-06-19*
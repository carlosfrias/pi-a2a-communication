---
name: pi-a2a-communication
summary: "M6 COMPLETE. All 7 spec gaps fixed. 19/19 conformance tests passing. Fleet deployed — all 7 nodes on v0.2.0-alpha.1."
status: active
phase: "M6: Spec Compliance Implementation"
progress: 10
tracked: true
created: 2026-06-18
updated: 2026-06-19
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**M6 COMPLETE. All 7 A2A v1.0 spec gaps (S1–S6b) fixed. 19/19 conformance tests passing. Fleet deployed — all 7 nodes on v0.2.0-alpha.1.**

## What's Done

- ✅ M6.1: S2 fixed — `WWW-Authenticate: Bearer` on 401 responses
- ✅ M6.2: S5 fixed — try/catch around `JSON.parse` in `handleSendMessage`
- ✅ M6.3: S3 fixed — `/.well-known/agent-card.json` spec path + legacy compat
- ✅ M6.4: S6 fixed — PascalCase method name mapping in dispatcher
- ✅ M6.5: S1 fixed — JSON-RPC errors return HTTP 200
- ✅ M6.6: S6b fixed — `id: null` instead of `id: 0` in error responses
- ✅ M6.7: S4 fixed — `/rpc`, `/message:send`, `/message:stream` transport routes
- ✅ **19/19 conformance tests passing**

## Next Steps

- [x] M6.9: Version bump to `0.2.0-alpha.1`
- [x] M6.10: Push to GitHub
- [x] M6.11: Reinstall on fleet nodes with updated fork

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

→ Full report: [A2A-v1-Conformance-Report](./wiki/A2A-v1-Conformance-Report.md)
→ Audit report: [A2A-v1-Conformance-Audit](./wiki/A2A-v1-Conformance-Audit.md)

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |

---

*Last updated: 2026-06-19*
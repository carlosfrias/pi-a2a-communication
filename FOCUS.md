---
name: pi-a2a-communication
summary: "M6 P0 complete. S2/S3/S5 fixed, 11/19 conformance tests passing. Next: P1 (S6/S1/S6b)."
status: active
phase: "M6: Spec Compliance Implementation"
progress: 8
tracked: true
created: 2026-06-18
updated: 2026-06-19
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**M6 P0 complete. S2/S3/S5 fixed, 11/19 conformance tests passing. Remaining: S1/S6/S6b (P1), S4 (P2). Wiki cleaned per Rule 27.**

## What's Done

- ✅ M5 complete: Upstream v1.0.1 deployed, fork archived, conformance audit done
- ✅ Conformance audit: 7 gaps (S1–S6b) identified, 19-test suite (6/19 pass)
- ✅ Validated by deepseek-v4-pro:cloud, audited by kimi-k2.7-code:cloud
- ✅ **M6.1: S2 fixed** — `WWW-Authenticate: Bearer` header on all 401 responses
- ✅ **M6.2: S5 fixed** — try/catch around `JSON.parse` in `handleSendMessage`
- ✅ **M6.3: S3 fixed** — `/.well-known/agent-card.json` spec path + legacy compat
- ✅ Wiki cleaned per Rule 27 — all docs moved to `wiki/`, root only has operational files

## Active Work

- [ ] M6.4: Fix S6 (P1) — Add PascalCase method name mapping in dispatcher
- [ ] M6.5: Fix S1 (P1) — Return HTTP 200 for JSON-RPC error responses
- [ ] M6.6: Fix S6b (P1) — Use `id: null` instead of `id: 0` for parse errors

## Next Steps

- [ ] M6.7: Fix S4 (P2) — Add `/rpc`, `/message:send`, `/message:stream` routes
- [ ] M6.8: All 19 conformance tests passing
- [ ] M6.9: Version bump to `0.2.0-alpha.1`
- [ ] M6.10: Push to GitHub
- [ ] M6.11: Reinstall on fleet nodes

## Key Decisions

| Decision | Choice | Rationale | Date |
|----------|--------|-----------|------|
| Use upstream v1.0.1 on fleet | Not our fork | Fork was for gateway testing; fleet uses npm package | 2026-06-18 |
| A2A runs inside pi | Not standalone | Same deployment model as coms-net | 2026-06-18 |
| Per-node config | `~/.pi/agent/a2a/config.json` | Standard pi extension config path | 2026-06-18 |
| Agent Cards | `~/.pi/agent/a2a/agents/{hostname}-agent.json` | Per-node identity | 2026-06-18 |
| Archive fork | Yes → Reactivated | Archived for M5; reactivated for M6 spec fixes | 2026-06-19 |
| Reactivate fork for M6 | Yes | Upstream not responding; we need spec-compliant A2A | 2026-06-19 |
| M6 priority order | P0 first (S2,S5,S3) | Security/crash bugs before spec paths | 2026-06-19 |

## Spec Compliance Gaps (S1–S6b)

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| S1 | 🟡 Medium | JSON-RPC errors return HTTP 400 | ❌ P1 |
| S2 | 🔴 High | 401 responses lack `WWW-Authenticate` | ✅ Fixed |
| S3 | 🔴 High | Wrong Agent Card discovery path | ✅ Fixed |
| S4 | 🔴 High | Missing `/rpc`, `/message:send`, `/message:stream` | ❌ P2 |
| S5 | 🔴 High | `/sendMessage` uncaught parse error → HTTP 500 | ✅ Fixed |
| S6 | 🔴 High | Method names slash-separated, not PascalCase | ❌ P1 |
| S6b | 🟢 Low | `id: 0` instead of `id: null` in parse errors | ❌ P1 |

→ Full report: [A2A-v1-Conformance-Report](./wiki/A2A-v1-Conformance-Report.md)
→ Audit report: [A2A-v1-Conformance-Audit](./wiki/A2A-v1-Conformance-Audit.md)

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived — replaced by A2A | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |
| vault-accessibility | 🔀 Vault-primary drift audit moved here | [FOCUS](../../../../personal-vault/02-Areas/Infrastructure/vault-accessibility/FOCUS.md) |

---

*Last updated: 2026-06-19*
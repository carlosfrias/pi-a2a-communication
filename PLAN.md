---
name: pi-a2a-communication
phase: "M6: Spec Compliance Implementation"
progress: 10
status: active
last_updated: 2026-06-19
---

# PLAN — pi-a2a-communication

## Current: M6 — Spec Compliance Implementation ✅

**All 7 spec gaps fixed. 19/19 conformance tests passing.**

### Release History

| Version | Date | Description |
|---------|------|-------------|
| v1.0.1 (upstream) | 2026-06-18 | Deployed to all 7 fleet nodes |
| v0.1.0-alpha.1 (fork) | 2026-06-18 | Initial fork, 84 tests |
| v0.2.0-alpha.1 (fork) | TBD | A2A v1.0 spec compliance fixes (S1–S6b), 19/19 conformance tests |

---

## M6: Spec Compliance Implementation ✅

### P0 — Security & Crash Bugs (Done ✅)

- [x] M6.1: Fix S2 (P0) — `WWW-Authenticate: Bearer` header on 401 responses
- [x] M6.2: Fix S5 (P0) — try/catch around `JSON.parse` in `handleSendMessage`
- [x] M6.3: Fix S3 (P0) — `/.well-known/agent-card.json` spec path + legacy compat

### P1 — Spec Compliance (Done ✅)

- [x] M6.4: Fix S6 (P1) — PascalCase method name mapping (`SendMessage`, `GetTask`, etc.)
- [x] M6.5: Fix S1 (P1) — JSON-RPC errors return HTTP 200 (not 400)
- [x] M6.6: Fix S6b (P1) — `id: null` instead of `id: 0` in error responses

### P2 — Transport Binding (Done ✅)

- [x] M6.7: Fix S4 (P2) — `/rpc`, `/message:send`, `/message:stream` transport routes

### Remaining

- [ ] M6.8: All 19 conformance tests passing ✅ **DONE**
- [x] M6.9: Version bump `package.json` to `0.2.0-alpha.1`
- [x] M6.10: Push to GitHub, verify repo writable
- [ ] M6.11: Reinstall on fleet nodes with updated fork

## Spec Compliance Gaps (S1–S6b) — All Fixed ✅

| ID | Severity | Issue | Fix | Status |
|----|----------|-------|-----|--------|
| S1 | Medium | JSON-RPC errors return HTTP 400 | `sendJSONRPCError` → HTTP 200 | ✅ |
| S2 | High | 401 responses lack `WWW-Authenticate` | Added `WWW-Authenticate: Bearer` | ✅ |
| S3 | High | Wrong Agent Card path | Added spec path + legacy compat | ✅ |
| S4 | High | Missing transport routes | Added `/rpc`, `/message:send`, `/message:stream` | ✅ |
| S5 | High | Uncaught parse error → HTTP 500 | Added try/catch in `handleSendMessage` | ✅ |
| S6 | High | Slash-separated method names | Added PascalCase method mapping | ✅ |
| S6b | Low | `id: 0` in parse errors | Changed `id ?? 0` → `id ?? null` | ✅ |

---

## Completed Milestones

### M1: Fork & Audit (Done)
- [x] M1.1–M1.5: Fork, audit, test framework, characterization tests, package rename

### M2: Agent Cards (Done)
- [x] M2.2–M2.3: Generate and deploy Agent Cards for 7 fleet nodes

### M3: Fleet Deployment (Done)
- [x] M3.1–M3.3: Deploy config, restart, verify

### M4: Client Polish (Cancelled)
- [-] M4.1–M4.3: Cancelled (using upstream v1.0.1)

### M5: Upstream Integration (Done)
- [x] M5.1–M5.8: Deploy, verify, archive fork, conformance audit
- [>] M5.7: Submit spec issues to upstream — Deferred

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Use upstream v1.0.1 on fleet | Not our fork | Fleet uses npm package directly |
| Reactivate fork for M6 | Yes | Upstream not responding |
| Fix priority | P0→P1→P2 | Security/crash bugs first |
| TDD mandatory | Conformance suite is source of truth | No gap "fixed" until test passes |
| Wiki clean per Rule 27 | All docs in `wiki/` | Root only has operational files |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-19*
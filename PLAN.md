---
name: pi-a2a-communication
phase: "M6: Spec Compliance Implementation"
progress: 8
status: active
last_updated: 2026-06-19
---

# PLAN — pi-a2a-communication

## Current: M6 — Spec Compliance Implementation

Target: Fix all 7 A2A v1.0 spec gaps (S1–S6b). 19/19 conformance tests passing.

### Release History

| Version | Date | Description |
|---------|------|-------------|
| v1.0.1 (upstream) | 2026-06-18 | Deployed to all 7 fleet nodes via `pi install npm:pi-a2a-communication` |
| v0.1.0-alpha.1 (fork) | 2026-06-18 | Fork with A2A v1.0 spec fixes, 84 tests — archived then reactivated |
| v0.2.0-alpha.1 (fork) | TBD | A2A v1.0 spec compliance fixes (S1–S6b), 19/19 conformance tests |

---

## M6: Spec Compliance Implementation (Current)

### P0 — Security & Crash Bugs (Done ✅)

- [x] M6.1: Fix S2 (P0) — Added `WWW-Authenticate: Bearer` header on all 401 responses
  - Files: `a2a-server.ts` (isAuthenticated rejection handler)
  - Test: `a2a-v1-conformance.test.ts` S2 suite ✅
- [x] M6.2: Fix S5 (P0) — Added try/catch for `JSON.parse` in `handleSendMessage`
  - Files: `a2a-server.ts` (handleSendMessage)
  - Test: `a2a-v1-conformance.test.ts` S5 suite ✅ (returns -32700; HTTP 200 is S1)
- [x] M6.3: Fix S3 (P0) — Added `/.well-known/agent-card.json` spec path + legacy compat paths
  - Files: `a2a-server.ts` (route handler), `types.ts` (AGENT_CARD_PATH, LEGACY constants)
  - Test: `a2a-v1-conformance.test.ts` S3 suite ✅

### P1 — Spec Compliance (Next)

- [ ] M6.4: Fix S6 (P1) — Add PascalCase method name mapping in dispatcher
  - Files: `a2a-server.ts` (root dispatcher), `types.ts` (PascalCase method constants)
  - Test: `a2a-v1-conformance.test.ts` S6 suite (2 tests)
- [ ] M6.5: Fix S1 (P1) — Return HTTP 200 with JSON-RPC error body instead of HTTP 400
  - Files: `a2a-server.ts` (sendJSONRPCError)
  - Test: `a2a-v1-conformance.test.ts` S1 suite (3 tests)
- [ ] M6.6: Fix S6b (P1) — Use `id: null` instead of `id: 0` for unknown request IDs
  - Files: `a2a-server.ts` (sendJSONRPCError, sendJSONRPCResponse)
  - Test: `a2a-v1-conformance.test.ts` S1 parse error test

### P2 — Transport Binding (After P1)

- [ ] M6.7: Fix S4 (P2) — Add `/rpc`, `/message:send`, `/message:stream` transport binding routes
  - Files: `a2a-server.ts` (route registration)
  - Test: `a2a-v1-conformance.test.ts` S4 suite (3 tests)
- [ ] M6.8: All 19 conformance tests passing
  - Test: `npx vitest run a2a-v1-conformance`
- [ ] M6.9: Version bump `package.json` to `0.2.0-alpha.1`
- [ ] M6.10: Push to GitHub, verify repo writable
- [ ] M6.11: Reinstall on fleet nodes with updated fork

## Spec Compliance Gaps to Upstream (S1–S6b)

| ID | Severity | Issue | Fix | Priority | Status |
|----|----------|-------|-----|----------|--------|
| S1 | Medium | JSON-RPC errors return HTTP 400 | Return HTTP 200 with JSON-RPC error body | P1 | ❌ |
| S2 | High | 401 responses lack `WWW-Authenticate` | Add `WWW-Authenticate: Bearer` header | P0 | ✅ |
| S3 | High | Wrong Agent Card path | Add spec path + legacy compat | P0 | ✅ |
| S4 | High | Missing `/rpc`, `/message:send`, `/message:stream` | Add A2A v1.0 transport binding routes | P2 | ❌ |
| S5 | High | `/sendMessage` uncaught parse error → HTTP 500 | Add try/catch around `JSON.parse` | P0 | ✅ |
| S6 | High | Method names slash-separated, not PascalCase | Add PascalCase method mapping in dispatcher | P1 | ❌ |
| S6b | Low | `id: 0` instead of `id: null` in parse errors | Use `null` for unknown request IDs | P1 | ❌ |

## Housekeeping

- [x] M6.0a: Wiki cleaned per Rule 27 — docs moved to `wiki/`, root clean
- [x] M6.0b: Vault-primary drift audit moved to vault-accessibility project
- [x] M6.0c: Conformance report confirmed to have ingested all audit findings

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

### M5: Upstream Integration (Done)
- [x] M5.1: Install upstream v1.0.1 on all fleet nodes
- [x] M5.2: Deploy per-node config with `server.enabled: true`
- [x] M5.3: Deploy Agent Cards to all fleet nodes
- [x] M5.4: Verify A2A servers on all 7 nodes (44 integration tests passing)
- [x] M5.5: Archive fork (`carlosfrias/pi-a2a-communication`)
- [x] M5.6: Conformance audit completed (7 gaps: S1–S6b)
- [>] M5.7: Submit spec compliance issues to upstream (`DrOlu/pi-a2a-communication`) — Deferred
- [x] M5.8: Remove fork from pi-a2a-gateway dev dependencies

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Use upstream v1.0.1 on fleet | Not our fork | Fleet uses npm package directly |
| Archive fork | Yes → Reactivated | Archived for M5; reactivated for M6 spec fixes |
| Reactivate fork for M6 | Yes | Upstream not responding; we need spec-compliant A2A |
| Fix priority | P0 first (S2,S5,S3) | Security/crash bugs before spec paths |
| TDD mandatory | Conformance suite is source of truth | No gap is "fixed" until its test passes |
| Wiki clean per Rule 27 | All docs in `wiki/` | Root only has operational files (AGENTS, FOCUS, PLAN, WORKBENCH, README) |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-19*
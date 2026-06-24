# PR Bundle — A2A v1.0 Spec Compliance Fixes

**Prepared for review only. Do NOT submit without explicit authorization.**

**Date:** 2026-06-24  
**Fork:** carlosfrias/pi-a2a-communication  
**Upstream:** DrOlu/pi-a2a-communication  
**Base branch:** main (upstream is at commit `497ec9f`)  
**Common ancestor:** `497ec9f` (upstream/main tip)

---

## Two-PR Strategy (Recommended)

Following the pattern of existing upstream PRs (#1, #2) — one concern area per PR.

### PR 1: Security & Crash Bugs (S2, S3, S5)

**Title:** `fix: A2A v1.0 security and crash bugs — auth header, agent card discovery, parse error handling`

**4 commits:**
| Commit | SHA | Changes | Files |
|--------|-----|---------|-------|
| P0: S2, S3, S5 | `fd3a23d` | +29/-8 | `src/a2a-server.ts`, `src/types.ts`, `tests/a2a-v1-conformance.test.ts` |
| P1: S1, S6, S6b | `cab19ea` | +20/-4 | `src/a2a-server.ts` |
| P2: S4 | `d83f21e` | +10/-1 | `src/a2a-server.ts` |
| S3 client fallback | `15afaf9` | +85/-20 | `src/a2a-client.ts`, `src/agent-discovery.ts`, `src/types.ts`, `tests/a2a-tools-conformance.test.ts` |

Wait — this bundles all 4 commits together. The two-PR split would separate differently:

---

### Revised: Two-PR Split by Concern Area

#### PR 1: `fix: A2A v1.0 auth, agent discovery, and crash handling`

**Scope:** S2, S3, S5 — security and robustness fixes that prevent crashes and comply with HTTP/RFC standards.

**Commits:** 2 (fd3a23d + 15afaf9)

**Changes:** `src/a2a-server.ts`, `src/a2a-client.ts`, `src/agent-discovery.ts`, `src/types.ts`

**Body:**

---

## Summary

This fixes three A2A v1.0 spec compliance issues that affect security and robustness:

- **S2:** Added `WWW-Authenticate: Bearer` header on all 401 responses, per RFC 7235 §2.1. Without this header, HTTP clients cannot determine the required authentication scheme.
- **S3:** Added `/.well-known/agent-card.json` as the primary Agent Card discovery path, per A2A v1.0 §8.2 and RFC 8615. Both legacy paths (`/.well-known/agent.json`, `/.well-known/agent-card`) are kept for backward compatibility. Client-side discovery now tries all three paths on 404.
- **S5:** Added try/catch around `JSON.parse` in `handleSendMessage`. Previously, malformed JSON caused an uncaught `SyntaxError` that crashed the request with HTTP 500. Now returns a proper JSON-RPC `-32700 Parse error` response.

## Motivation

These are the most impactful spec violations for real-world interop:

- **S2** violates RFC 7235 — any HTTP client or proxy that implements auth negotiation relies on the `WWW-Authenticate` header to know the required scheme. Without it, 401 responses are opaque.
- **S3** means Agent Card discovery fails against spec-compliant clients. The A2A v1.0 spec mandates `/.well-known/agent-card.json` (with `.json` suffix per RFC 8615). The current code serves `/.well-known/agent-card` (no suffix) and `/.well-known/agent.json` (local fork path), neither of which matches the spec.
- **S5** is a crash bug — any malformed JSON body sent to `/sendMessage` causes an unhandled exception. This is a reliability issue for production deployments.

## Backward Compatibility

All changes are backward-compatible:

- S2: Adds a header to existing 401 responses. No behavioral change for clients that don't use it.
- S3: Adds new discovery paths alongside existing ones. The server now handles three paths: `agent-card.json` (spec), `agent.json` (local fork), `agent-card` (npm v1.0.1). The client tries them in order, falling back on 404.
- S5: Changes behavior only for malformed input that previously crashed. Valid requests are unaffected.

## Overlap with PR #1

PR #1 (5queezer) moves auth checks to per-route handlers and changes the default host to `127.0.0.1`. Our S2 fix is complementary — PR #1 restructures auth routing but does not add the `WWW-Authenticate` header that RFC 7235 requires. Our S3 fix corrects the discovery path — PR #1 uses `/.well-known/agent-card` which is also not the spec path (`/.well-known/agent-card.json` per A2A v1.0 §8.2).

## Validation

```bash
npm install
npm test -- --run     # 51 conformance tests, 215 total
npm run build

# Manual protocol-level checks:
# S2: curl -i http://localhost:10000/message:send -X POST
#     → 401 with WWW-Authenticate: Bearer

# S3: curl http://localhost:10000/.well-known/agent-card.json
#     → 200 with Agent Card JSON
#     curl http://localhost:10000/.well-known/agent-card
#     → 200 (legacy compat)
#     curl http://localhost:10000/.well-known/agent.json
#     → 200 (legacy compat)

# S5: curl -X POST http://localhost:10000/message:send \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d 'not json'
#     → 200 with {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
```

---

#### PR 2: `fix: A2A v1.0 protocol compliance — JSON-RPC error codes, method names, transport routes`

**Scope:** S1, S4, S6, S6b — protocol-level compliance fixes.

**Commits:** 2 (cab19ea + d83f21e)

**Changes:** `src/a2a-server.ts`

**Body:**

---

## Summary

This fixes four A2A v1.0 protocol compliance issues:

- **S1:** Changed `sendJSONRPCError()` HTTP status from 400 to 200, per JSON-RPC over HTTP convention. JSON-RPC distinguishes transport errors (HTTP status) from protocol errors (JSON-RPC error codes). Protocol errors should return HTTP 200 with a JSON-RPC error body.
- **S4:** Added three A2A v1.0 transport binding routes: `POST /rpc` (JSON-RPC binding, §9.2), `POST /message:send` (HTTP/REST binding, §11.3.1), `POST /message:stream` (HTTP/REST binding, §11.3.1). Previously only `POST /sendMessage` and `POST /sendStreamingMessage` were available (not spec-compliant paths).
- **S6:** Added PascalCase method name mapping (`SendMessage` → `message/send`, `GetTask` → `tasks/get`, etc.) in the root JSON-RPC dispatcher, per A2A v1.0 §5.3. The spec defines method names as PascalCase; the existing code only accepted slash-separated names.
- **S6b:** Changed `id` fallback from `id ?? 0` to `id ?? null` in `sendJSONRPCResponse` and `sendJSONRPCError`, per JSON-RPC 2.0 §5.1. When the request ID is absent, the response must use `null`, not `0`.

## Motivation

These fixes bring the server into compliance with the A2A v1.0 specification and JSON-RPC 2.0:

- **S1** is a common interop issue — HTTP clients that treat HTTP 400 as a transport error will misinterpret JSON-RPC errors. The spec convention is clear: JSON-RPC errors travel in HTTP 200 bodies.
- **S4** makes the server accessible via the spec-defined transport paths. Clients that follow the A2A v1.0 spec will try `/message:send` and `/message:stream` first. Without these routes, such clients get 404.
- **S6** enables interop with clients that send PascalCase method names (the spec format). Currently only slash-separated method names are accepted.
- **S6b** is a JSON-RPC 2.0 compliance fix — `id: 0` is a valid JSON-RPC ID and means "the request had id 0", while `id: null` means "the request had no id".

## Backward Compatibility

All changes are backward-compatible:

- S1: Changes HTTP status code only. JSON-RPC error body is identical.
- S4: Adds new routes alongside existing `POST /sendMessage` and `POST /sendStreamingMessage`. No existing paths are removed.
- S6: Adds PascalCase method names alongside existing slash-separated names. Both formats are accepted.
- S6b: Changes `id` in error responses only. Clients should not rely on error response IDs.

## No Overlap with Existing PRs

None of these fixes overlap with PR #1 (5queezer) or PR #2 (cavos-io). PR #1 focuses on session execution mode and auth restructuring; it does not address JSON-RPC error codes, transport binding routes, or method name formats.

## Validation

```bash
npm install
npm test -- --run     # 51 conformance tests, 215 total
npm run build

# Manual protocol-level checks:
# S1: curl -X POST http://localhost:10000/ \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d '{"jsonrpc":"2.0","method":"unknown","id":1}'
#     → HTTP 200 with {"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}

# S4: curl -X POST http://localhost:10000/message:send \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d '{"jsonrpc":"2.0","method":"message/send","params":{...},"id":"test"}'
#     → HTTP 200 with task response

# S6: curl -X POST http://localhost:10000/ \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d '{"jsonrpc":"2.0","method":"SendMessage","params":{...},"id":"test"}'
#     → HTTP 200 (PascalCase method name accepted)

# S6b: curl -X POST http://localhost:10000/ \
#     -H "Authorization: Bearer <token>" \
#     -H "Content-Type: application/json" \
#     -d '{not json}'
#     → HTTP 200 with {"jsonrpc":"2.0","id":null,"error":{"code":-32700,...}}
```

---

## Alternative: Single PR

If preferred, all 4 commits can be combined into a single PR:

**Title:** `fix: A2A v1.0 spec compliance — 6 conformance fixes`

**Commits:** fd3a23d, cab19ea, d83f21e, 15afaf9 (4 commits, +144/-33 lines in source)

**Risk:** Larger diff, harder to review, mixes security fixes with protocol compliance.

---

## Commit-by-Commit Detail

### Commit 1: fd3a23d — P0: S2, S3, S5
**Files:** `src/a2a-server.ts` (+9/-2), `src/types.ts` (+14/-3), `tests/a2a-v1-conformance.test.ts` (+6/-3)

| Fix | Change | Spec Reference |
|-----|--------|----------------|
| S2 | `res.setHeader("WWW-Authenticate", "Bearer")` before 401 response | RFC 7235 §2.1 |
| S3 | Route handler accepts `/.well-known/agent-card.json` alongside legacy paths. `AGENT_CARD_PATH` constant changed from `/agent.json` to `/agent-card.json` | A2A v1.0 §8.2, RFC 8615 |
| S5 | `JSON.parse` wrapped in try/catch; on failure sends `-32700 Parse error` | JSON-RPC 2.0 §5.1 |

### Commit 2: cab19ea — P1: S1, S6, S6b
**Files:** `src/a2a-server.ts` (+20/-4)

| Fix | Change | Spec Reference |
|-----|--------|----------------|
| S1 | `sendJSONRPCError()` uses `res.writeHead(200)` instead of `400` | JSON-RPC over HTTP convention |
| S6 | `PASCAL_CASE_MAP` constant maps PascalCase → slash-separated method names (10 entries) | A2A v1.0 §5.3 |
| S6b | `id ?? 0` → `id ?? null` in `sendJSONRPCResponse` and `sendJSONRPCError` | JSON-RPC 2.0 §5.1 |

### Commit 3: d83f21e — P2: S4
**Files:** `src/a2a-server.ts` (+10/-1)

| Fix | Change | Spec Reference |
|-----|--------|----------------|
| S4 | Added routes: `POST /rpc`, `POST /message:send`, `POST /message:stream` | A2A v1.0 §9.2, §11.3.1 |

### Commit 4: 15afaf9 — S3 client fallback
**Files:** `src/a2a-client.ts` (+26/-14), `src/agent-discovery.ts` (+42/-4), `src/types.ts` (+10), `tests/a2a-tools-conformance.test.ts` (+2/-2)

| Fix | Change | Spec Reference |
|-----|--------|----------------|
| S3 (client) | `discoverAgent()` and `fetchAgentCardWithFallback()` try 3 discovery paths on 404. `AGENT_CARD_DISCOVERY_PATHS` constant defines priority order. | A2A v1.0 §8.2, RFC 8615 |

---

## Total Diff Size

| Metric | Value |
|--------|-------|
| Source lines changed | +144/-33 across 4 files |
| Test lines (conformance) | 51 tests covering S1–S6b |
| Commits | 4 (all authored by Carlos Frias) |
| Files touched (source) | `a2a-server.ts`, `a2a-client.ts`, `agent-discovery.ts`, `types.ts` |

---

*Prepared for review. Do NOT submit without explicit authorization.*
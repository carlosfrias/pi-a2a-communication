---
name: PR 1 — Auth, Agent Discovery, and Crash Handling
updated: 2026-06-24
status: draft
commits: fd3a23d, 15afaf9
base: main (497ec9f)
---

# PR 1: Auth, Agent Discovery, and Crash Handling

**Title:** `fix: A2A v1.0 auth, agent discovery, and crash handling`

**Scope:** S2, S3, S5 — security and robustness fixes that prevent crashes and comply with HTTP/RFC standards.

**Commits:** 2

| # | SHA | Scope | Lines | Files |
|---|-----|-------|-------|-------|
| 1 | `fd3a23d` | S2: WWW-Authenticate header, S3: agent-card.json path, S5: parse error handling | +29/-8 | `a2a-server.ts`, `types.ts` |
| 2 | `15afaf9` | S3: client-side discovery fallback across 3 paths | +85/-20 | `a2a-client.ts`, `agent-discovery.ts`, `types.ts` |

## Individual Fixes

- [S2 — Missing WWW-Authenticate header](./S2-www-authenticate.md)
- [S3 — Wrong Agent Card discovery path](./S3-agent-card-discovery.md)
- [S5 — Uncaught parse error](./S5-parse-error-crash.md)

## Summary

This fixes three A2A v1.0 spec compliance issues that affect security and robustness:

- **S2:** Added `WWW-Authenticate: Bearer` header on all 401 responses, per RFC 7235 §2.1.
- **S3:** Added `/.well-known/agent-card.json` as the primary Agent Card discovery path, per A2A v1.0 §8.2 and RFC 8615. Both legacy paths kept for backward compatibility. Client-side discovery tries all three paths on 404.
- **S5:** Added try/catch around `JSON.parse` in `handleSendMessage`. Malformed JSON now returns proper `-32700 Parse error` instead of HTTP 500.

## Backward Compatibility

- **S2:** Adds a header to existing 401 responses. No behavioral change for clients that don't use it.
- **S3:** Adds new discovery paths alongside existing ones. The server handles three paths: `agent-card.json` (spec), `agent.json` (local fork), `agent-card` (npm v1.0.1). The client tries them in order, falling back on 404.
- **S5:** Changes behavior only for malformed input that previously crashed. Valid requests are unaffected.

## Overlap with PR #1 (5queezer)

Complementary, not conflicting. PR #1 restructures auth checks to per-route handlers but does not add the `WWW-Authenticate` header that RFC 7235 requires. PR #1 uses `/.well-known/agent-card` (still not the spec path). Our fixes add what PR #1 misses.

## Validation

```bash
npm install
npm test -- --run     # 51 conformance tests, 215 total
npm run build

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

*Last updated: 2026-06-24*
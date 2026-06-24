---
name: PR 2 — Protocol Compliance (JSON-RPC Errors, Method Names, Transport Routes)
updated: 2026-06-24
status: draft
commits: cab19ea, d83f21e
base: main (497ec9f)
---

# PR 2: Protocol Compliance — JSON-RPC Errors, Method Names, Transport Routes

**Title:** `fix: A2A v1.0 protocol compliance — JSON-RPC errors, method names, transport routes`

**Scope:** S1, S4, S6, S6b — protocol-level compliance fixes.

**Commits:** 2

| # | SHA | Scope | Lines | Files |
|---|-----|-------|-------|-------|
| 1 | `cab19ea` | S1: HTTP 200 for JSON-RPC errors, S6: PascalCase method names, S6b: id null | +20/-4 | `a2a-server.ts` |
| 2 | `d83f21e` | S4: transport binding routes (/rpc, /message:send, /message:stream) | +10/-1 | `a2a-server.ts` |

## Individual Fixes

- [S1 — JSON-RPC errors return HTTP 400](./S1-json-rpc-error-status.md)
- [S4 — Missing transport binding paths](./S4-transport-binding-routes.md)
- [S6 — Wrong JSON-RPC method names](./S6-pascalcase-method-names.md)
- [S6b — Wrong id in parse errors](./S6b-null-id-in-errors.md)

## Summary

This fixes four A2A v1.0 protocol compliance issues:

- **S1:** JSON-RPC error responses returned HTTP 400. Per JSON-RPC over HTTP convention, all JSON-RPC responses (including errors) should use HTTP 200, with the error encoded in the JSON-RPC body.
- **S4:** Missing A2A v1.0 transport binding routes. The spec defines `POST /rpc` (§9.2), `POST /message:send` (§11.3.1), and `POST /message:stream` (§11.3.1). Only legacy paths `/sendMessage` and `/sendStreamingMessage` were available.
- **S6:** Method names only accepted slash-separated format (`message/send`). The A2A v1.0 spec §5.3 defines PascalCase method names (`SendMessage`). Added mapping from PascalCase to internal slash-separated names.
- **S6b:** Error responses used `id: 0` when request ID was absent. JSON-RPC 2.0 §5.1 requires `id: null` for requests with no ID.

## Backward Compatibility

- **S1:** Changes HTTP status code only. JSON-RPC error body is identical.
- **S4:** Adds new routes alongside existing `/sendMessage` and `/sendStreamingMessage`. No existing paths are removed.
- **S6:** Adds PascalCase method names alongside existing slash-separated names. Both formats are accepted.
- **S6b:** Changes `id` in error responses only. Clients should not rely on error response IDs.

## No Overlap with Existing PRs

None of these fixes overlap with PR #1 (5queezer) or PR #2 (cavos-io). PR #1 focuses on session execution mode and auth restructuring; it does not address JSON-RPC error codes, transport binding routes, or method name formats.

## Validation

```bash
npm install
npm test -- --run     # 51 conformance tests, 215 total
npm run build

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

*Last updated: 2026-06-24*
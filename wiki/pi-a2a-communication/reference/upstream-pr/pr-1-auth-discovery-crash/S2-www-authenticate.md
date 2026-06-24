---
name: S2 — Missing WWW-Authenticate header on 401 responses
severity: HIGH
spec: RFC 7235 §2.1
fix_commit: fd3a23d
status: draft
---

# S2: Missing WWW-Authenticate Header on 401 Responses

## Problem

When the A2A server returns HTTP 401 Unauthorized, it does not include a `WWW-Authenticate` header. RFC 7235 §2.1 requires this header on 401 responses so clients can determine the required authentication scheme. Without it, clients have no way to know whether to use Bearer auth, Basic auth, or another scheme.

## Spec Reference

**RFC 7235 §2.1:** "A server generating a 401 (Unauthorized) response MUST send a `WWW-Authenticate` header field containing at least one challenge."

**A2A v1.0:** The spec requires Bearer token authentication for protected endpoints.

## Current Behavior

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"error":"Unauthorized"}
```

No `WWW-Authenticate` header. Clients cannot programmatically determine the auth scheme.

## Fix

Added `WWW-Authenticate: Bearer` header before sending 401 responses.

**File:** `src/a2a-server.ts`

```diff
       // Check authentication
       if (!this.isAuthenticated(req)) {
+        res.setHeader("WWW-Authenticate", "Bearer");
         this.sendError(res, 401, "Unauthorized");
         return;
       }
```

## Fixed Behavior

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
Content-Type: application/json

{"error":"Unauthorized"}
```

## Conformance Test

```typescript
// tests/a2a-v1-conformance.test.ts
describe('S2: WWW-Authenticate header on 401 responses', () => {
  it('MUST include WWW-Authenticate header on 401 response (RFC 7235)', async () => {
    const response = await fetch(`${baseUrl}/message:send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'message/send', id: 'test' }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('MUST include WWW-Authenticate header on 401 for JSON-RPC requests', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'message/send', id: 'test' }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });
});
```

## Backward Compatibility

No breaking change. Adds a header to existing 401 responses. Clients that don't use it are unaffected.

## Overlap with PR #1

PR #1 (5queezer) restructures auth checks to per-route handlers but does **not** add the `WWW-Authenticate` header. This fix is complementary.

---

*Last updated: 2026-06-24*
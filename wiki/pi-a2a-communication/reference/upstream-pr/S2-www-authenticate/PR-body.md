## Summary

Fixes the missing `WWW-Authenticate: Bearer` header on 401 Unauthorized responses. Per RFC 7235 §2.1, a 401 response MUST include a `WWW-Authenticate` header so clients can determine the required authentication scheme.

## Motivation

Without this header, HTTP clients and proxies cannot determine the required auth scheme. Any client implementing auth negotiation per RFC 7235 will fail to discover that Bearer auth is required.

## Fix

Added `res.setHeader("WWW-Authenticate", "Bearer")` before sending 401 responses in the auth check.

```diff
       if (!this.isAuthenticated(req)) {
+        res.setHeader("WWW-Authenticate", "Bearer");
         this.sendError(res, 401, "Unauthorized");
         return;
       }
```

## Validation

```bash
curl -i http://localhost:10000/message:send -X POST
# → 401 with WWW-Authenticate: Bearer
```

Conformance test: `describe('S2: WWW-Authenticate header on 401 responses')` — 2 test cases.

## Backward Compatibility

Adds a header to existing 401 responses. No behavioral change for clients that don't use it.

---

*Part of PR 1: `fix: A2A v1.0 auth, agent discovery, and crash handling` (S2, S3, S5)*
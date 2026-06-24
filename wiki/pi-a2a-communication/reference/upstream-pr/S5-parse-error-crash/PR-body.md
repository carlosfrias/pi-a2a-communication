## Summary

Fixes an uncaught `SyntaxError` when malformed JSON is sent to `/sendMessage`. The server now returns a proper JSON-RPC `-32700 Parse error` response instead of HTTP 500.

## Motivation

Any malformed JSON body sent to `/sendMessage` causes an unhandled exception that crashes the request with HTTP 500. This is a reliability issue for production deployments and a spec violation (JSON-RPC 2.0 §5.1 requires a `-32700 Parse error` response).

## Fix

Wrapped `JSON.parse` in try/catch. On parse failure, sends proper JSON-RPC error response:

```diff
     const body = await this.readBody(req);
-    const request: JSONRPCRequest = JSON.parse(body);
+    let request: JSONRPCRequest;
+    try {
+      request = JSON.parse(body);
+    } catch {
+      this.sendJSONRPCError(res, null, -32700, "Parse error");
+      return;
+    }
```

Note: `sendJSONRPCError` also returns HTTP 200 (not 400) per JSON-RPC over HTTP convention — that's fixed separately in S1.

## Validation

```bash
curl -X POST http://localhost:10000/sendMessage \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d 'not json'
# → 200 with {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
```

Conformance test: `describe('S5: Legacy path /sendMessage parse error handling')` — verifies `-32700` parse error returned.

## Backward Compatibility

Changes behavior only for malformed input that previously crashed. Valid requests are completely unaffected.

---

*Part of PR 1: `fix: A2A v1.0 auth, agent discovery, and crash handling` (S2, S3, S5)*
## Summary

Fixes JSON-RPC error responses to return HTTP 200 instead of HTTP 400. Per the JSON-RPC over HTTP convention, protocol-level errors should be carried in the JSON-RPC body with HTTP 200, not as HTTP 4xx status codes.

## Motivation

HTTP clients that treat HTTP 400 as a transport error will not parse the JSON-RPC error body, losing the error code and message. The JSON-RPC specification distinguishes transport errors (HTTP status codes) from protocol errors (JSON-RPC error codes). Protocol errors should use HTTP 200.

## Fix

Changed `sendJSONRPCError()` HTTP status from 400 to 200:

```diff
   private sendJSONRPCError(...): void {
     ...
     res.setHeader("Content-Type", "application/json");
-    res.writeHead(400);
+    res.writeHead(200);
     res.end(JSON.stringify(response));
   }
```

## Validation

```bash
curl -X POST http://localhost:10000/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"unknown","id":1}'
# → HTTP 200 with {"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}
```

Conformance test: `describe('S1: JSON-RPC error HTTP status codes')` — 3 test cases covering invalid params, method not found, and parse errors.

## Backward Compatibility

Changes HTTP status code only. The JSON-RPC error body (code, message) is identical. Clients that correctly use the JSON-RPC protocol will now work as intended. Clients that handled 400 responses will still work because they typically check the body.

---

*Part of PR 2: `fix: A2A v1.0 protocol compliance — JSON-RPC errors, method names, transport routes` (S1, S4, S6, S6b)*
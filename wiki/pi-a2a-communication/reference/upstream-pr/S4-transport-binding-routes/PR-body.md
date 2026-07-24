## Summary

Adds three A2A v1.0 transport binding routes: `POST /rpc` (§9.2), `POST /message:send` (§11.3.1), and `POST /message:stream` (§11.3.1). Previously only legacy paths `/sendMessage` and `/sendStreamingMessage` were available.

## Motivation

The A2A v1.0 specification defines specific HTTP endpoints that servers must accept. Clients that follow the spec will try `/message:send` and `/message:stream` first. Without these routes, such clients get 404 and cannot communicate with the server.

## Fix

Added three route handlers that delegate to the existing JSON-RPC dispatcher:

```diff
       } else if (path === "/" || path === "") {
-        // A2A v1.0 spec: single endpoint with JSON-RPC method dispatch
+        // A2A v1.0 spec: root endpoint with JSON-RPC method dispatch
         await this.handleJsonRPCRequest(req, res);
+      } else if (path === "/rpc") {
+        // A2A v1.0 §9.2: JSON-RPC binding endpoint
+        await this.handleJsonRPCRequest(req, res);
+      } else if (path === "/message:send") {
+        // A2A v1.0 §11.3.1: HTTP/REST binding for sending messages
+        await this.handleJsonRPCRequest(req, res);
+      } else if (path === "/message:stream") {
+        // A2A v1.0 §11.3.1: HTTP/REST binding for streaming messages
         await this.handleJsonRPCRequest(req, res);
       } else if (path === "/sendMessage" || path === "/sendStreamingMessage") {
         // Legacy path-based routes (kept for backward compat)
```

All three new routes delegate to the same `handleJsonRPCRequest` method — the A2A protocol uses JSON-RPC method names in the request body regardless of the HTTP path.

## Validation

```bash
# JSON-RPC binding
curl -X POST http://localhost:10000/rpc \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tasks/get","params":{"id":"nonexistent"},"id":"test"}'
# → HTTP 200

# HTTP/REST binding
curl -X POST http://localhost:10000/message:send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":"test"}]}},"id":"test"}'
# → HTTP 200 with task response
```

Conformance test: `describe('S4: A2A v1.0 HTTP/REST endpoint paths')` — 3 test cases.

## Backward Compatibility

Fully backward-compatible. Adds new routes alongside existing `/sendMessage` and `/sendStreamingMessage`. No existing paths are removed or changed.

---

*Part of PR 2: `fix: A2A v1.0 protocol compliance — JSON-RPC errors, method names, transport routes` (S1, S4, S6, S6b)*
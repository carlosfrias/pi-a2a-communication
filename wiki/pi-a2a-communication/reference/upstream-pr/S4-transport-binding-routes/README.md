---
name: S4 — Missing A2A v1.0 transport binding paths
severity: HIGH
spec: A2A v1.0 §9.2, §11.3.1
upstream_issue: "#8"
fix_commit: d83f21e
pr_group: 2 (protocol compliance)
status: draft
---

# S4: Missing A2A v1.0 Transport Binding Paths

## Problem

The A2A v1.0 specification defines three transport binding paths that the server must accept:

1. `POST /rpc` — JSON-RPC binding (§9.2)
2. `POST /message:send` — HTTP/REST binding for sending messages (§11.3.1)
3. `POST /message:stream` — HTTP/REST binding for streaming messages (§11.3.1)

The current code only supports `POST /sendMessage` and `POST /sendStreamingMessage`, which are not the spec-defined paths. Clients that follow the A2A v1.0 spec will try the spec paths first and get 404.

## Spec Reference

**A2A v1.0 §9.2:** "The JSON-RPC binding MUST be available at the `/rpc` endpoint."

**A2A v1.0 §11.3.1:** "The HTTP/REST binding MUST support `POST /message:send` and `POST /message:stream`."

## Current Behavior

```http
POST /rpc              → 404 Not Found
POST /message:send     → 404 Not Found
POST /message:stream   → 404 Not Found
POST /sendMessage       → 200 (legacy, not spec)
POST /sendStreamingMessage → 200 (legacy, not spec)
```

## Fix

Added three route handlers that delegate to the existing JSON-RPC dispatcher.

**File:** `src/a2a-server.ts`

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

## Fixed Behavior

```http
POST /rpc              → 200 (spec ✅)
POST /message:send     → 200 (spec ✅)
POST /message:stream   → 200 (spec ✅)
POST /sendMessage       → 200 (legacy compat)
POST /sendStreamingMessage → 200 (legacy compat)
```

## Conformance Test

```typescript
describe('S4: A2A v1.0 HTTP/REST endpoint paths', () => {
  it('MUST accept POST /message:send (A2A v1.0 HTTP/REST binding)', async () => {
    const response = await fetch(`${baseUrl}/message:send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEST_TOKEN}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'message/send', params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } }, id: 'test' }),
    });
    expect(response.status).toBe(200);
  });

  it('MUST accept POST /message:stream (A2A v1.0 HTTP/REST binding)', async () => {
    const response = await fetch(`${baseUrl}/message:stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEST_TOKEN}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'message/stream', params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } }, id: 'test' }),
    });
    expect([200, 201]).toContain(response.status);
  });

  it('MUST support JSON-RPC dispatch at POST /rpc (A2A v1.0 JSON-RPC binding)', async () => {
    const response = await fetch(`${baseUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEST_TOKEN}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tasks/get', params: { id: 'nonexistent' }, id: 'test' }),
    });
    expect(response.status).toBe(200);
  });
});
```

## Backward Compatibility

Fully backward-compatible. Adds new routes alongside existing `/sendMessage` and `/sendStreamingMessage`. No existing paths are removed or changed.
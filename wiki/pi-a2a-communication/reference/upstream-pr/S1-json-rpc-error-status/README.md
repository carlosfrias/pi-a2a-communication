---
name: S1 — JSON-RPC errors return HTTP 400 instead of HTTP 200
severity: MEDIUM
spec: JSON-RPC over HTTP convention
upstream_issue: "#5"
fix_commit: cab19ea
pr_group: 2 (protocol compliance)
status: draft
---

# S1: JSON-RPC Errors Return HTTP 400 Instead of HTTP 200

## Problem

The A2A server returns HTTP 400 for JSON-RPC error responses. Per the JSON-RPC over HTTP convention, all JSON-RPC responses should use HTTP 200, with errors encoded in the JSON-RPC body. HTTP status codes (400, 500) indicate transport-level failures, not protocol-level errors.

This causes interop issues: HTTP clients that treat 400 as a transport error will not parse the JSON-RPC error body, losing the error code and message.

## Spec Reference

**JSON-RPC over HTTP convention:** JSON-RPC distinguishes transport errors (HTTP status codes) from protocol errors (JSON-RPC error codes). A JSON-RPC response with an `error` field is a valid response — it should use HTTP 200. HTTP 4xx/5xx should be reserved for transport-level failures (e.g., 404 for missing endpoints, 401 for auth).

## Current Behavior

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}
```

Clients that check `response.ok` (which is false for 400) will not parse the error body.

## Fix

Changed `sendJSONRPCError()` to return HTTP 200 instead of 400.

**File:** `src/a2a-server.ts`

```diff
   private sendJSONRPCError(...): void {
     ...
     res.setHeader("Content-Type", "application/json");
-    res.writeHead(400);
+    res.writeHead(200);
     res.end(JSON.stringify(response));
   }
```

## Fixed Behavior

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}
```

Clients can now parse the response body to get the JSON-RPC error code and message.

## Conformance Test

```typescript
describe('S1: JSON-RPC error HTTP status codes', () => {
  it('SHOULD return HTTP 200 for JSON-RPC invalid params errors', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'message/send', params: {}, id: 'test' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('SHOULD return HTTP 200 for JSON-RPC method-not-found errors', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'nonexistent', id: 'test' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.error.code).toBe(-32601);
  });
});
```

## Backward Compatibility

Changes HTTP status code only. The JSON-RPC error body (code, message) is identical. Clients that already handle 400 responses will still work because they typically check the body. Clients that correctly use the JSON-RPC protocol will now work as the spec intends.
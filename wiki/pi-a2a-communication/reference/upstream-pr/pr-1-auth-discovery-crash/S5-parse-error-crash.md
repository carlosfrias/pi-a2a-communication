---
name: S5 — Uncaught parse error in /sendMessage returns HTTP 500
severity: HIGH
spec: JSON-RPC 2.0 §5.1
fix_commit: fd3a23d
status: draft
---

# S5: Uncaught Parse Error in /sendMessage Returns HTTP 500

## Problem

When a client sends malformed JSON to `/sendMessage`, the server calls `JSON.parse(body)` without a try/catch. This throws an uncaught `SyntaxError` that crashes the request with HTTP 500 Internal Server Error. The JSON-RPC 2.0 spec §5.1 requires a `-32700 Parse error` response for invalid JSON.

## Spec Reference

**JSON-RPC 2.0 §5.1:** "When a JSON-RPC request is received with invalid JSON, the server MUST respond with a Parse error (code -32700)."

## Current Behavior

```http
POST /sendMessage
Content-Type: application/json

{not valid json}
```

→ HTTP 500 Internal Server Error (uncaught SyntaxError)

## Fix

Wrapped `JSON.parse` in try/catch. On parse failure, sends proper JSON-RPC error response.

**File:** `src/a2a-server.ts`

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

Note: `sendJSONRPCError` is also fixed by S1 (commit `cab19ea`) to return HTTP 200 instead of 400, per JSON-RPC over HTTP convention.

## Fixed Behavior

```http
POST /sendMessage
Content-Type: application/json

{not valid json}
```

→ HTTP 200 with `{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}`

## Conformance Test

```typescript
describe('S5: Legacy path /sendMessage parse error handling', () => {
  it('MUST handle malformed JSON gracefully on /sendMessage', async () => {
    const response = await fetch(`${baseUrl}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
      },
      body: 'not valid json',
    });
    expect(response.status).toBe(200);  // HTTP 200 per JSON-RPC convention (S1)
    const data = await response.json();
    expect(data.error.code).toBe(-32700);
    expect(data.error.message).toBe('Parse error');
  });
});
```

## Backward Compatibility

Changes behavior only for malformed input that previously crashed. Valid requests are completely unaffected. This is a crash bug fix — no legitimate client should be sending invalid JSON.

---

*Last updated: 2026-06-24*
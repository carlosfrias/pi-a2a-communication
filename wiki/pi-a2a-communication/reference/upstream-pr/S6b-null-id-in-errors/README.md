---
name: S6b — Wrong id in parse errors (id: 0 instead of id: null)
severity: LOW
spec: JSON-RPC 2.0 §5.1
upstream_issue: "#7"
fix_commit: cab19ea
pr_group: 2 (protocol compliance)
status: draft
---

# S6b: Wrong `id` in Parse Errors (`id: 0` Instead of `id: null`)

## Problem

When the server sends a JSON-RPC error response for a request that has no `id` field, it uses `id: 0` instead of `id: null`. Per JSON-RPC 2.0 §5.1, when the request ID is absent or cannot be determined, the response must use `id: null`.

`id: 0` is semantically different — it means "the request had id 0", not "the request had no id".

## Spec Reference

**JSON-RPC 2.0 §5.1:** "The `id` member MUST be included in the Response object. If there was an error in detecting the id in the Request object (e.g. Parse error/Invalid Request), it MUST be Null."

## Current Behavior

```json
{"jsonrpc":"2.0","id":0,"error":{"code":-32700,"message":"Parse error"}}
```

`id: 0` implies the request had `id: 0`, which is a valid JSON-RPC ID value.

## Fix

Changed `id` fallback from `id ?? 0` to `id ?? null` in both `sendJSONRPCResponse` and `sendJSONRPCError`.

**File:** `src/a2a-server.ts`

```diff
   private sendJSONRPCResponse(res: http.ServerResponse, id: string | number | null, result: unknown): void {
     const response: JSONRPCResponse = {
       jsonrpc: "2.0",
-      id: id ?? 0,
+      id: id ?? null,
       result,
     };

   private sendJSONRPCError(...): void {
     const response: JSONRPCResponse = {
       jsonrpc: "2.0",
-      id: id ?? 0,
+      id: id ?? null,
       error: { code, message, data },
     };
```

## Fixed Behavior

```json
{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
```

`id: null` correctly indicates the request ID could not be determined.

## Conformance Test

Implicitly tested by S5 (parse error) and S1 (HTTP 200 for errors) conformance tests. When malformed JSON is sent:

```typescript
const response = await fetch(..., { body: 'not json' });
const data = await response.json();
expect(data.id).toBeNull();  // Not 0
expect(data.error.code).toBe(-32700);
```

## Backward Compatibility

Minimal impact. Changes `id` in error responses only. Clients that rely on `id: 0` in error responses are misusing the JSON-RPC protocol — `0` is a valid request ID, not a placeholder for "unknown."
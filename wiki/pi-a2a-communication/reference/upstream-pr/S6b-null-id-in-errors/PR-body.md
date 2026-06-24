## Summary

Fixes `id: 0` → `id: null` in JSON-RPC error and success responses when the request ID is absent. Per JSON-RPC 2.0 §5.1, when the request ID cannot be determined, the response must use `null`, not `0`. The value `0` is a valid JSON-RPC ID meaning "the request had id 0", while `null` means "the request had no id".

## Motivation

Using `id: 0` in error responses is ambiguous — a client cannot distinguish between "the request had id 0" and "the request had no id". JSON-RPC 2.0 §5.1 explicitly requires `null` when the ID cannot be determined (e.g., parse errors).

## Fix

Changed `id ?? 0` to `id ?? null` in both `sendJSONRPCResponse` and `sendJSONRPCError`:

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

## Validation

```bash
curl -X POST http://localhost:10000/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{not json}'
# → {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
#    "id": null, not "id": 0
```

Implicitly tested by S5 (parse error) conformance tests — verifies `data.id` is `null`.

## Backward Compatibility

Minimal impact. Changes `id` in error responses only. `0` is a valid JSON-RPC ID value, so `id: 0` was technically incorrect. Clients that rely on `id: 0` in error responses are misusing the protocol.

---

*Part of PR 2: `fix: A2A v1.0 protocol compliance — JSON-RPC errors, method names, transport routes` (S1, S4, S6, S6b)*
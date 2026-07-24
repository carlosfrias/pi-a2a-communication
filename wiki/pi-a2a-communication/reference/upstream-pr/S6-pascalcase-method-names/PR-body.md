## Summary

Adds PascalCase method name mapping (`SendMessage` → `message/send`, `GetTask` → `tasks/get`, etc.) in the root JSON-RPC dispatcher, per A2A v1.0 §5.3. The spec defines method names as PascalCase; the current code only accepts slash-separated names.

## Motivation

The A2A v1.0 spec §5.3 defines method names in PascalCase. Clients that send spec-compliant requests like `{"method": "SendMessage"}` receive a `-32601 Method not found` error because the dispatcher only recognizes slash-separated names like `message/send`.

## Fix

Added `PASCAL_CASE_MAP` constant that maps 10 PascalCase method names to internal slash-separated names:

```typescript
const PASCAL_CASE_MAP: Record<string, string> = {
  'SendMessage': A2A_METHODS.MESSAGE_SEND,
  'SendStreamingMessage': A2A_METHODS.MESSAGE_STREAM,
  'GetTask': A2A_METHODS.TASKS_GET,
  'CancelTask': A2A_METHODS.TASKS_CANCEL,
  'SubscribeToTask': A2A_METHODS.TASKS_SUBSCRIBE,
  'ResubscribeToTask': A2A_METHODS.TASKS_RESUBSCRIBE,
  'SetPushNotificationConfig': A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_SET,
  'GetPushNotificationConfig': A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_GET,
  'DeletePushNotificationConfig': A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_DELETE,
  'GetAuthenticatedExtendedCard': A2A_METHODS.AGENT_AUTHENTICATED_EXTENDED_CARD,
};
const method = PASCAL_CASE_MAP[rawMethod] ?? rawMethod;
```

The `?? rawMethod` fallback ensures slash-separated names still work.

## Validation

```bash
# PascalCase method name
curl -X POST http://localhost:10000/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"SendMessage","params":{"message":{"role":"user","parts":[{"type":"text","text":"test"}]}},"id":"test"}'
# → HTTP 200 (PascalCase accepted)

# Slash-separated still works (backward compat)
curl -X POST http://localhost:10000/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":"test"}]}},"id":"test"}'
# → HTTP 200
```

Conformance test: `describe('S6: JSON-RPC method names must be PascalCase')` — 2 test cases.

## Backward Compatibility

Fully backward-compatible. Slash-separated method names continue to work via the `?? rawMethod` fallback. PascalCase is added as a new accepted format.

---

*Part of PR 2: `fix: A2A v1.0 protocol compliance — JSON-RPC errors, method names, transport routes` (S1, S4, S6, S6b)*
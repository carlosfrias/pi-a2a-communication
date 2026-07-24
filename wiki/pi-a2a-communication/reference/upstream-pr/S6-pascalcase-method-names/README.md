---
name: S6 — Wrong JSON-RPC method names (slash-separated instead of PascalCase)
severity: HIGH
spec: A2A v1.0 §5.3
upstream_issue: "#7"
fix_commit: cab19ea
pr_group: 2 (protocol compliance)
status: draft
---

# S6: Wrong JSON-RPC Method Names (Slash-Separated Instead of PascalCase)

## Problem

The A2A v1.0 specification §5.3 defines method names in PascalCase: `SendMessage`, `GetTask`, `CancelTask`, etc. The current code only accepts slash-separated names (`message/send`, `tasks/get`) in the root JSON-RPC dispatcher.

Clients that send spec-compliant PascalCase method names receive a `-32601 Method not found` error.

## Spec Reference

**A2A v1.0 §5.3:** Method names follow PascalCase convention: `SendMessage`, `SendStreamingMessage`, `GetTask`, `CancelTask`, `SubscribeToTask`, `ResubscribeToTask`, `SetPushNotificationConfig`, `GetPushNotificationConfig`, `DeletePushNotificationConfig`, `GetAuthenticatedExtendedCard`.

## Current Behavior

```json
{"jsonrpc":"2.0","method":"SendMessage","id":"test"}
```

→ `{"jsonrpc":"2.0","id":"test","error":{"code":-32601,"message":"Method not found"}}`

Only `message/send` works, not `SendMessage`.

## Fix

Added `PASCAL_CASE_MAP` constant that maps PascalCase method names to internal slash-separated names. The dispatcher checks this map before falling back to the raw method name.

**File:** `src/a2a-server.ts`

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

## Fixed Behavior

Both formats now work:

```json
{"jsonrpc":"2.0","method":"SendMessage","id":"test"}      → 200 ✅
{"jsonrpc":"2.0","method":"message/send","id":"test"}       → 200 ✅ (backward compat)
```

## Conformance Test

```typescript
describe('S6: JSON-RPC method names must be PascalCase (A2A v1.0)', () => {
  it('MUST accept "SendMessage" method (A2A v1.0 PascalCase)', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEST_TOKEN}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'SendMessage', params: { message: { role: 'user', parts: [{ type: 'text', text: 'test' }] } }, id: 'test' }),
    });
    expect(response.status).toBe(200);
  });

  it('MUST accept "GetTask" method (A2A v1.0 PascalCase)', async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEST_TOKEN}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'GetTask', params: { id: 'nonexistent' }, id: 'test' }),
    });
    expect(response.status).toBe(200);
  });
});
```

## Backward Compatibility

Fully backward-compatible. Slash-separated method names (`message/send`, `tasks/get`) continue to work via the `?? rawMethod` fallback. PascalCase is added as a new accepted format alongside the existing format.
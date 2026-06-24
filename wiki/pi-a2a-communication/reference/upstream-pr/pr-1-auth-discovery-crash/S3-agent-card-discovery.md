---
name: S3 — Wrong Agent Card discovery path
severity: HIGH
spec: A2A v1.0 §8.2, RFC 8615
fix_commits: fd3a23d, 15afaf9
status: draft
---

# S3: Wrong Agent Card Discovery Path

## Problem

The A2A v1.0 specification §8.2 requires the Agent Card to be served at `/.well-known/agent-card.json` (with `.json` suffix per RFC 8615). The current code serves:

1. `/.well-known/agent-card` — npm v1.0.1 path (no `.json` suffix, not RFC 8615 compliant)
2. `/.well-known/agent.json` — local fork path (not the A2A v1.0 spec path)

Neither path matches the spec. Clients that follow the A2A v1.0 spec will try `/.well-known/agent-card.json` and get 404.

Additionally, the client-side `discoverAgent()` only tries the primary path, failing immediately on 404 without attempting fallback paths.

## Spec Reference

**A2A v1.0 §8.2:** "The Agent Card MUST be discoverable via the well-known URI `/.well-known/agent-card.json`."

**RFC 8615:** Well-known URIs for JSON resources should use the `.json` suffix.

## Current Behavior

**Server:**

```http
GET /.well-known/agent-card.json  → 404 Not Found
GET /.well-known/agent-card       → 200 (npm v1.0.1, not spec)
GET /.well-known/agent.json       → 200 (local fork, not spec)
```

**Client:** Tries only `AGENT_CARD_PATH` (`/agent.json`). Fails on 404.

## Fix

Two commits fix server and client separately:

### Commit fd3a23d — Server-side route handler

**File:** `src/a2a-server.ts`

```diff
-      if (path === "/.well-known/agent.json") {
+      if (path === "/.well-known/agent-card.json" || path === "/.well-known/agent.json" || path === "/.well-known/agent-card") {
         await this.handleAgentCard(req, res);
```

**File:** `src/types.ts`

```diff
-export const AGENT_CARD_PATH = '/.well-known/agent.json';
+export const AGENT_CARD_PATH = '/.well-known/agent-card.json';

-export const LEGACY_AGENT_CARD_PATH = '/.well-known/agent-card';
+export const LEGACY_AGENT_CARD_PATH_LOCAL = '/.well-known/agent.json';
+export const LEGACY_AGENT_CARD_PATH_NPM = '/.well-known/agent-card';
```

### Commit 15afaf9 — Client-side fallback discovery

**File:** `src/types.ts` — Added `AGENT_CARD_DISCOVERY_PATHS` constant:

```typescript
export const AGENT_CARD_DISCOVERY_PATHS = [
  AGENT_CARD_PATH,                    // /.well-known/agent-card.json (spec)
  LEGACY_AGENT_CARD_PATH_LOCAL,       // /.well-known/agent.json (local fork)
  LEGACY_AGENT_CARD_PATH_NPM,         // /.well-known/agent-card (npm v1.0.1)
] as const;
```

**File:** `src/a2a-client.ts` — `discoverAgent()` now tries all three paths on 404:

```typescript
for (const cardPath of discoveryPaths) {
  const fullUrl = `${agentUrl.origin}${cardPath}`;
  const response = await this.httpGet(fullUrl);
  if (response.ok) {
    const card = await response.json();
    return { ...card, url };
  }
  if (response.status === 404) {
    lastError = new Error(`Agent Card not found at ${cardPath} (404)`);
    continue;  // Try next path
  }
  throw new Error(`Failed to discover agent: ${response.status} ${response.statusText}`);
}
```

**File:** `src/agent-discovery.ts` — Added `fetchAgentCardWithFallback()` with same pattern.

## Fixed Behavior

**Server:**

```http
GET /.well-known/agent-card.json  → 200 (spec path ✅)
GET /.well-known/agent-card       → 200 (legacy compat)
GET /.well-known/agent.json       → 200 (legacy compat)
```

**Client:** Tries paths in order: `agent-card.json` → `agent.json` → `agent-card`. Returns first 200, stops on non-404 error.

## Conformance Test

```typescript
describe('S3: Agent Card discovery paths', () => {
  it('MUST serve Agent Card at /.well-known/agent-card.json (A2A v1.0 spec path)', async () => {
    const response = await fetch(`${baseUrl}/.well-known/agent-card.json`);
    expect(response.status).toBe(200);
  });

  it('SHOULD serve Agent Card at /.well-known/agent.json for backward compat', async () => {
    const response = await fetch(`${baseUrl}/.well-known/agent.json`);
    expect(response.status).toBe(200);
  });

  it('SHOULD serve Agent Card at /.well-known/agent-card for legacy compat', async () => {
    const response = await fetch(`${baseUrl}/.well-known/agent-card`);
    expect(response.status).toBe(200);
  });
});
```

## Backward Compatibility

Fully backward-compatible. New spec path added alongside existing paths. Both legacy paths continue to work. Client-side fallback ensures compatibility with servers that only serve legacy paths.

## Overlap with PR #1

PR #1 (5queezer) uses `/.well-known/agent-card` — still not the spec path. Our fix corrects this to `/.well-known/agent-card.json` while keeping legacy paths working.

---

*Last updated: 2026-06-24*
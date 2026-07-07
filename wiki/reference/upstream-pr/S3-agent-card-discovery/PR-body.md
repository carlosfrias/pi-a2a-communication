## Summary

Fixes Agent Card discovery to serve the spec-compliant path `/.well-known/agent-card.json` (A2A v1.0 §8.2, RFC 8615) alongside legacy paths. Adds client-side fallback discovery that tries all three paths on 404.

## Motivation

The A2A v1.0 spec mandates `/.well-known/agent-card.json` (with `.json` suffix per RFC 8615). The current code serves `/.well-known/agent-card` (no suffix) and `/.well-known/agent.json` (local fork path), neither of which matches the spec. Clients that follow the A2A v1.0 spec get 404 on discovery.

## Fix

**Server-side** (commit `fd3a23d`): Route handler now accepts all three paths:

```diff
-      if (path === "/.well-known/agent.json") {
+      if (path === "/.well-known/agent-card.json" || path === "/.well-known/agent.json" || path === "/.well-known/agent-card") {
         await this.handleAgentCard(req, res);
```

`AGENT_CARD_PATH` constant changed from `/agent.json` to `/agent-card.json`. Legacy paths split into `LEGACY_AGENT_CARD_PATH_LOCAL` and `LEGACY_AGENT_CARD_PATH_NPM`.

**Client-side** (commit `15afaf9`): `discoverAgent()` and `fetchAgentCardWithFallback()` try all three paths on 404:

```typescript
export const AGENT_CARD_DISCOVERY_PATHS = [
  '/.well-known/agent-card.json',  // A2A v1.0 spec path
  '/.well-known/agent.json',       // local fork path
  '/.well-known/agent-card',       // npm v1.0.1 legacy path
] as const;
```

## Validation

```bash
curl http://localhost:10000/.well-known/agent-card.json
# → 200 with Agent Card JSON (spec path)

curl http://localhost:10000/.well-known/agent-card
# → 200 (legacy compat)

curl http://localhost:10000/.well-known/agent.json
# → 200 (legacy compat)
```

Conformance test: `describe('S3: Agent Card discovery paths')` — 3 test cases.

## Backward Compatibility

Fully backward-compatible. New spec path added alongside existing paths. Both legacy paths continue to work. Client-side fallback ensures compatibility with servers that only serve legacy paths.

---

*Part of PR 1: `fix: A2A v1.0 auth, agent discovery, and crash handling` (S2, S3, S5)*
---
name: A2A v1.0 Spec Compliance
status: audited
updated: 2026-06-19
---

# A2A v1.0 Spec Compliance — pi-a2a-communication

Conformance audit of `pi-a2a-communication@1.0.1` against the [A2A Protocol v1.0 specification](https://a2a-protocol.org).

## Audit Results

| ID | Severity | Issue | Spec Requirement | Status |
|----|----------|-------|-------------------|--------|
| S1 | 🟡 Medium | JSON-RPC errors return HTTP 400 | JSON-RPC over HTTP convention: HTTP 200 | ❌ Fail |
| S2 | 🔴 High | 401 responses lack `WWW-Authenticate` | RFC 7235 §2.1 requires the header | ❌ Fail |
| S3 | 🔴 High | `/.well-known/agent-card.json` returns 404 | A2A v1.0 §8.2 / RFC 8615 | ❌ Fail |
| S4 | 🔴 High | `/message:send`, `/message:stream`, `/rpc` return 404 | A2A v1.0 §9.2/§11.3.1 | ❌ Fail |
| S5 | 🔴 High | `/sendMessage` uncaught parse error → HTTP 500 | JSON-RPC §5.1 | ❌ Fail |
| S6 | 🔴 High | Method names slash-separated, not PascalCase | A2A v1.0 §5.3/§9.4 | ❌ Fail |
| S6b | 🟢 Low | `id: 0` instead of `id: null` in parse errors | JSON-RPC §5.1 | ❌ Fail |

**7 spec gaps, 5 high severity.** Validated by deepseek-v4-pro:cloud, audited by kimi-k2.7-code:cloud. The local fork (v0.1.0-alpha.1) has partial A2A v1.0 compliance — root dispatcher and `/.well-known/agent.json` work, but neither path matches the spec.

## Full Report

→ [[pi-a2a-communication/A2A-v1-Conformance-Report]] — Executive report with Mermaid diagrams, evidence, root cause, and fix recommendations.

## Reproduction

A self-contained Vitest test suite is available in the code repo:

**`workshop/02-Areas/Infrastructure/pi-a2a-communication/tests/a2a-v1-conformance.test.ts`**

Run against any instance:

```bash
cd workshop/02-Areas/Infrastructure/pi-a2a-communication
npm install pi-a2a-communication vitest
npx vitest run a2a-v1-conformance
```

## What Works

| Feature | Path | Status |
|---------|------|--------|
| Agent Card (local fork path) | `/.well-known/agent.json` | ✅ (not spec path) |
| Bearer token auth | `Authorization: Bearer <token>` | ✅ |
| Message send (legacy) | `/sendMessage` | ✅ |
| Streaming (legacy) | `/sendStreamingMessage` | ✅ |
| Root JSON-RPC dispatcher | `/` (slash-separated methods only) | ✅ |

> **Note:** `/.well-known/agent.json` works on the local fork but is NOT the A2A v1.0 spec path. The spec requires `/.well-known/agent-card.json`. The npm v1.0.1 serves `/.well-known/agent-card` (also not spec-compliant).

## Upstream Status

Issues to be filed against [DrOlu/pi-a2a-communication](https://github.com/DrOlu/pi-a2a-communication). Currently deferred per project decision.

---

*Last updated: 2026-06-19*
# A2A v1.0 Protocol Conformance Audit

**Project:** `pi-a2a-communication` (local fork v0.1.0-alpha.1)  
**Audited files:**
- `tests/a2a-v1-conformance.test.ts`
- `a2a-server.ts`
- `types.ts`
- `FOCUS.md`

**Audit date:** 2026-06-19  
**Validators:** deepseek-v4-pro:cloud (validation), kimi-k2.7-code:cloud (audit)  
**Test run result:** 19 tests | 6 passed | 13 failed (all failures are genuine spec gaps S1–S6b)

---

## Executive Summary

The conformance test suite identifies **7 spec gaps** (S1–S6b) in the local fork of `pi-a2a-communication`. Two independent model audits confirmed the gaps and discovered a **critical path error**: the Agent Card discovery path `/.well-known/agent.json` used by the local fork is NOT the A2A v1.0 spec path (`/.well-known/agent-card.json`). Additionally, a **6th gap (S6)** was discovered: JSON-RPC method names use slash-separated lowercase (`message/send`) instead of PascalCase (`SendMessage`) per A2A v1.0 §5.3.

**Severity upgrade:** S3 upgraded from MEDIUM to HIGH (wrong spec path). S1 downgraded from HIGH to MEDIUM (JSON-RPC 2.0 core spec is transport-agnostic; HTTP 200 is convention, not hard MUST). Two new gaps added: S6 (HIGH) and S6b (LOW).

**Key findings from audits:**
1. **CRITICAL:** `/.well-known/agent-card.json` is the spec path — both the local fork (`/.well-known/agent.json`) and npm v1.0.1 (`/.well-known/agent-card`) are wrong
2. **HIGH:** S4 tests wrong URL paths (`/message/send` vs spec `/message:send` or `/rpc`)
3. **HIGH:** S6 (undocumented gap): method names should be PascalCase, not slash-separated
4. **MEDIUM:** S1 spec basis overstated — HTTP 200 is convention, not JSON-RPC 2.0 hard requirement
5. **LOW:** `id ?? 0` bug in parse error responses (should be `id: null`)

---

## Test Results Summary

| Category | Tests | Pass | Fail |
|----------|-------|------|------|
| S3: Agent Card paths | 3 | 1 | 2 |
| S1: JSON-RPC HTTP status | 3 | 0 | 3 |
| S5: Parse error handling | 1 | 0 | 1 |
| S2: WWW-Authenticate | 2 | 0 | 2 |
| S4: Transport bindings | 3 | 0 | 3 |
| S6: PascalCase methods | 2 | 0 | 2 |
| Passing features | 5 | 5 | 0 |
| **Total** | **19** | **6** | **13** |

---

## 1. Test Completeness — Missing A2A v1.0 / JSON-RPC 2.0 Requirements

The following spec requirements are implemented in `a2a-server.ts` but have **no test coverage**.

| # | Requirement | Where implemented | Test gap |
|---|-------------|-------------------|----------|
| 1 | **JSON-RPC batch requests** (array of requests) | Not implemented; server assumes single object | No negative/positive test |
| 2 | **JSON-RPC `id` types** (string/number/null/omitted) | Server preserves id or substitutes `id ?? 0` | No test for numeric id, omitted id, or null handling |
| 3 | **Invalid Request (`-32600`)** when `jsonrpc !== "2.0"` or method missing | `handleJsonRPCRequest` line ~270 | Not tested |
| 4 | **`tasks/get` JSON-RPC method** | `handleJsonRPCTasksGet` | Not tested |
| 5 | **`tasks/cancel` JSON-RPC method** | `handleJsonRPCTasksCancel` | Not tested |
| 6 | **`tasks/subscribe` JSON-RPC method (SSE)** | `handleJsonRPCTasksSubscribe` | Not tested |
| 7 | **`tasks/resubscribe` JSON-RPC method** | `handleJsonRPCTasksResubscribe` | Not tested |
| 8 | **`tasks/pushNotificationConfig/set/get/delete`** | `handleJsonRPCPushNotificationConfig*` | Not tested |
| 9 | **`agent/authenticatedExtendedCard`** | `handleJsonRPCAuthenticatedExtendedCard` | Not tested |
| 10 | **Streaming SSE event format** (`task`, `status_update`, `artifact_update`, `[DONE]`) | `processTaskStreaming` | No streaming contract test |
| 11 | **Task state lifecycle** (`submitted → working → completed/failed`) | `processTask` / `processTaskStreaming` | No state-transition assertions |
| 12 | **Agent Card full schema validation** | `createAgentCard` | Test only checks `name` and `version` defined |
| 13 | **Agent Card `Content-Type: application/json`** | `handleAgentCard` | Not checked |
| 14 | **OPTIONS / CORS preflight** | `handleRequest` returns 204 | Not tested |
| 15 | **HTTP method mismatch** (e.g. POST `/.well-known/agent.json`) | `handleAgentCard` returns 405 | Not tested |
| 16 | **`ServerConfig.basePath` support** (`"/a2a"` in config) | **Ignored** — server uses absolute paths | Not tested |
| 17 | **Task history length trimming** (`historyLength` parameter) | `handleJsonRPCTasksGet`, `handleTaskRequest` | Not tested |
| 18 | **`/tasks` list endpoint** with filters | `handleListTasks` | Not tested |

**Recommendation:** Add a second test file (`a2a-v1-conformance-detailed.test.ts`) covering implemented spec paths. Keep S1–S6b as `a2a-v1-gaps.test.ts` so the suite's purpose is unambiguous.

---

## 2. Test Correctness — Validated by Two Independent Models

### 2.1 S1–S6b gap tests — expectations are correct

All thirteen failing tests fail for the reasons documented in their comments:

- **S1:** JSON-RPC error responses return HTTP 400 (convention: 200)
- **S2:** 401 responses omit `WWW-Authenticate`
- **S3:** `/.well-known/agent-card.json` returns 404 (correct spec path)
- **S4:** `/message:send`, `/message:stream`, `/rpc` return 404 (A2A v1.0 transport bindings)
- **S5:** `/sendMessage` with malformed JSON returns HTTP 500 (uncaught SyntaxError)
- **S6:** `SendMessage` method returns -32601 (should be accepted per spec)
- **S6b:** Parse error `id` is `0` instead of `null`

### 2.2 "Passing" tests — quality concerns

| Test | What it asserts | Concern |
|------|-----------------|---------|
| `/.well-known/agent.json` | Status 200, `name`, `version` | **Wrong path** — spec requires `/.well-known/agent-card.json` |
| Auth rejection (no token) | Status 401 | Correct but weak — doesn't check `WWW-Authenticate` |
| Auth rejection (wrong token) | Status 401 | Same |
| Auth acceptance (correct token) | Status 200, `name` | Correct |
| `POST /sendMessage` (legacy) | Status 200, `result` | Correct for legacy path |
| `POST /` root dispatcher | Status 200, `result` | **Misleading** — only works with slash-separated methods, not spec PascalCase |

### 2.3 Test descriptions that overstate assertions

- **S2** test says "with realm" but only asserts `toBeDefined()` — should assert `toMatch(/Bearer/)` or remove "with realm"
- **S5** says "crashes the handler" but the exception is caught at top level — should say "throws unhandled exception"
- **S6b** not yet tested — `expect(res.body.id).toBeNull()` should be added to S1 parse error test

---

## 3. Critical Findings from Model Validation (deepseek-v4-pro:cloud)

### 3.1 Agent Card Discovery Path Is Wrong (CRITICAL)

The A2A v1.0 spec (§8.2, §14.3) defines the Well-Known URI as `/.well-known/agent-card.json` (with `.json` suffix per RFC 8615).

| Path | Local Fork | npm v1.0.1 | A2A v1.0 Spec |
|------|-----------|------------|---------------|
| `/.well-known/agent-card.json` | ❌ 404 | ❌ 404 | ✅ Required |
| `/.well-known/agent.json` | ✅ 200 | ❌ 404 | ❌ Not in spec |
| `/.well-known/agent-card` | ❌ 404 | ✅ 200 | ❌ Not in spec |

Both the local fork and the published npm package serve the Agent Card at **wrong paths**. A spec-compliant client will get 404.

### 3.2 S4 Tests Wrong URL Paths (HIGH)

A2A v1.0 defines TWO transport bindings:
- **JSON-RPC binding (§9.2):** Single endpoint `POST /rpc` with method dispatch
- **HTTP/REST binding (§11.3.1):** `POST /message:send`, `POST /message:stream` (colon-separated)

The original test used `/message/send` (slash-separated) which matches neither binding. Updated test now tests `/message:send`, `/message:stream`, and `/rpc`.

### 3.3 Undocumented Gap S6: PascalCase Method Names (HIGH)

A2A v1.0 §5.3 and §9.4 define JSON-RPC method names as PascalCase: `SendMessage`, `GetTask`, `CancelTask`, etc. The local fork uses slash-separated lowercase: `message/send`, `tasks/get`. The root dispatcher only accepts slash-separated methods. A spec-compliant client sending `SendMessage` gets `-32601 Method not found`.

---

## 4. S1 Spec Basis Clarification (deepseek-v4-pro:cloud)

**Previous claim:** "JSON-RPC 2.0 spec requires HTTP 200 for error responses"

**Corrected understanding:** The JSON-RPC 2.0 core specification is **transport-agnostic**. It defines message format only and says nothing about HTTP status codes. The JSON-RPC over HTTP proposal recommends HTTP 200 for all responses, but it is not part of the JSON-RPC 2.0 core spec.

**Assessment:** Returning HTTP 400 for JSON-RPC errors is a **convention violation**, not a hard spec violation. S1 severity downgraded from HIGH to MEDIUM.

---

## 5. Security Gaps

| Area | Current state | Risk |
|------|---------------|------|
| `WWW-Authenticate` on 401 | Missing on generic 401 | Clients cannot discover auth scheme per RFC 7235 |
| Token validation | Exact string match `=== "Bearer ${token}"` | Fragile — whitespace, case, multiple schemes |
| Rate limiting | Not implemented | DoS exposure |
| Request size limit | Not implemented | Memory exhaustion |
| CORS + credentials | `Access-Control-Allow-Origin: *` with auth header | Security misconfiguration if cookies are ever used |
| Predictable task IDs | `Date.now()` + random | Information leakage / collision under concurrency |
| Input validation | Only checks `message` exists | Malformed payloads accepted |
| Extended agent card auth | Double-check (dead code under normal routing) | Inner `WWW-Authenticate` unreachable |

---

## 6. Recommendations

### P0 — Before treating suite as authoritative

1. ✅ **S3 path fixed** in conformance test: `/.well-known/agent-card.json` (spec), `/agent.json` (local), `/agent-card` (legacy)
2. ✅ **S4 paths fixed** in conformance test: `/message:send`, `/message:stream`, `/rpc` (spec bindings)
3. ✅ **S6 added** to conformance test: PascalCase method names
4. Add `expect(res.body.id).toBeNull()` to S1 parse error test
5. Fix S2 test description (remove "with realm" or assert realm)

### P1 — Short term

6. Add tests for all implemented JSON-RPC methods
7. Add streaming SSE contract test
8. Add response-shape assertions to "PASSING" tests
9. Add OPTIONS/CORS test
10. Add negative tests for task-not-found, wrong HTTP methods

### P2 — Medium term

11. Implement security hardening (WWW-Authenticate, request-size limit, rate limiting, crypto.randomUUID())
12. Fix `basePath` (implement or remove from ServerConfig)
13. Document non-conformant behaviors in README

---

## Appendix: Confirmed Code Locations

| Issue | File | Line(s) |
|-------|------|---------|
| JSON-RPC error HTTP 400 | `a2a-server.ts` | 1033+ (`sendJSONRPCError`, `res.writeHead(400)` at ~1050) |
| Missing `WWW-Authenticate` | `a2a-server.ts` | 162 (`sendError` 401 path) |
| Wrong agent card path | `a2a-server.ts` | 167 (only `agent.json`), `types.ts` L45 (`AGENT_CARD_PATH`) |
| No `/message:send`, `/message:stream`, `/rpc` | `a2a-server.ts` | 165-172 (only legacy paths) |
| `/sendMessage` unhandled parse | `a2a-server.ts` | ~601 (`JSON.parse(body)` without try/catch) |
| Method names slash-separated | `a2a-server.ts` | ~254-270 (root dispatcher method dispatch) |
| `id ?? 0` in error responses | `a2a-server.ts` | 1018 (`sendJSONRPCResponse`), 1033+ (`sendJSONRPCError`) |
| Double auth check (dead path) | `a2a-server.ts` | 555+ (`handleJsonRPCAuthenticatedExtendedCard`) |
| `basePath` ignored | `a2a-server.ts` | 150-172 (absolute path routing) |

---

*Audit produced by kimi-k2.7-code:cloud, validated by deepseek-v4-pro:cloud. Test suite run: `npx vitest run a2a-v1-conformance`.*
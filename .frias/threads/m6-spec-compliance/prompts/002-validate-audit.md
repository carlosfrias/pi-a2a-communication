---
date: 2026-06-19
prompt: "Validate with deepseek-v4-pro:cloud and audit with kimi-k2.7-code:cloud"
outcome: "Both models validated the conformance test suite. deepseek found 4 critical issues (S3 wrong spec path, S4 wrong test URLs, S6 undocumented PascalCase gap, S1 severity downgrade). kimi found test completeness gaps, security gaps, and the id:0 vs id:null bug. Test suite rewritten with corrections: 19 tests, 6 passing, 13 failing. All failures are genuine spec gaps."
thread: m6-spec-compliance
---

# 001: Validate and Audit Conformance Suite

## User Request (verbatim)
> Validate with deepseek-v4-pro:cloud and audit with kimi-k2.7-code:cloud

## Context
The conformance test suite had been written with 14 tests (9 failing, 5 passing) but had critical issues: wrong spec paths (S3 used `/.well-known/agent-card` instead of `/.well-known/agent-card.json`), wrong test URLs (S4 used `/message/send` instead of `/message:send`), and an undocumented gap (S6: PascalCase method names).

## Decisions Made
1. S3 path corrected to `/.well-known/agent-card.json` (A2A v1.0 §8.2, §14.3)
2. S4 paths corrected to `/message:send`, `/message:stream` (colon-separated per HTTP/REST binding) and `/rpc` (JSON-RPC binding)
3. S1 severity downgraded from HIGH to MEDIUM (JSON-RPC 2.0 core spec is transport-agnostic)
4. S6 added as new HIGH gap (PascalCase method names vs slash-separated)
5. S6b added as new LOW gap (id:0 vs id:null in parse errors)
6. S4b (root JSON-RPC dispatcher) removed — it works in the local fork

## Thread Impact
- Conformance report and audit report updated with all corrections
- All vault docs synced with corrected paths and gap counts
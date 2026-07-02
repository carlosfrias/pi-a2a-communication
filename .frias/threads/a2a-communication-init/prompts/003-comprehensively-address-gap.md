---
prompt: 003
date: 2026-07-02
verbatim: |
  We need to comprehensively address this gap.
---

# 003 — Comprehensively address this gap

## Context
The v0.4.1 re-enable worked for the fleet but the 3× kimi audit flagged a HIGH non-fleet regression (v0.4.1 hardcoded `ollama/qwen3.5:4b/bash/noExtensions` into `config.ts` + constructor defaults → breaks non-fleet users) plus MED hardening debt (no concurrency cap, no maxBuffer, timeout race, EACCES, `a2a_call` 60s+streaming, `/a2a-server start` ignoring fields). User directed a comprehensive fix.

## Outcome
- v0.5.0: made ALL execution-shaping flags OPT-IN (constructor/config safe defaults; fleet sets them via per-node `config.json`) → non-fleet users get the original `pi --print --no-session <msg>`. Added hardening: `maxConcurrent` queue/semaphore, `maxBufferBytes` kill, single timeout timer (cleared on close/error), EACCES message, `a2a_call` streaming=false/300s, `/a2a-server start` passes all bridge fields, `BridgeConfig` + maxConcurrent/maxBufferBytes.
- 3× deepseek (PASS/CONDITIONAL/PASS) + 3× kimi (regression FIXED, no new bugs). The deepseek CONDITIONAL (other A2A paths still 60s) → v0.5.1 (all timeouts 300s).

## Decisions
- Opt-in flags as the canonical pattern for fleet-specific config in a published extension (safe defaults; per-node opt-in).
- RULE 23 dual-model audit applied.

## Thread impact
Closed the HIGH regression + MED hardening debt. Led to v0.5.1/v0.5.2/v0.5.3/v0.5.4/v0.5.5 follow-ups.
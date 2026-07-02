---
prompt: 004
date: 2026-07-02
verbatim: |
  b then a
---

# 004 — "b then a" (install pi-intercom, then polish v0.5.2 LOW edge cases)

## Context
After v0.5.1, I offered options: (a) polish the v0.5.2 LOW edge cases, (b) install pi-intercom. User chose "b then a" — install pi-intercom first, then polish.

## Outcome
- (b) `pi install npm:pi-intercom` — installed. (Created a transient duplicate tool-name conflict with the existing `git:carlosfrias/pi-intercom` fork; the concurrent session resolved it via `pi uninstall npm:pi-intercom` with user approval. Lesson recorded: `pi install` does NOT auto-dedupe a same-tool install.)
- (a) v0.5.2 polish — closed the kimi v0.5.0 LOW edge cases: `StringDecoder` for multi-byte stdout/stderr, byte-accurate `maxBuffer` (Buffer.length, not string chars), `maxConcurrent≤0` = unlimited guard, `AbortSignal` forwarded through the non-streaming HTTP path, `a2a_call` `isError` on failed/canceled.

## Decisions
- pi-intercom duplicate: keep the git fork (workspace canonical); the npm install was redundant.
- v0.5.2 fixes are all opt-in/safe (no non-fleet behavior change).

## Thread impact
Closed the v0.5.0 kimi LOW edge cases. Led to v0.5.3 (kimi v0.5.2 residuals: retry-on-abort, isError "rejected", decoder flush).
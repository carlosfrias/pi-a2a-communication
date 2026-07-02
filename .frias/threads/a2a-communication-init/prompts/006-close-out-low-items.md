---
prompt: 006
date: 2026-07-02
verbatim: |
  Let's close out the remaining low items and run a validation and audit to ensure stability.
---

# 006 — Close out the remaining LOW items + validate/audit for stability

## Context
After v0.5.3 (retry-on-abort, isError "rejected", decoder flush), I reported the outstanding issues: HIGH/MED resolved; a handful of LOW items remained (concurrency burst race, late-SIGTERM-on-reused-PID, `/a2a-server start` host, subprocess bridge no external cancellation) + one LOW fix committed-but-not-deployed. User directed: close them out + run a validation/audit to ensure stability.

## Outcome
- v0.5.4: bridge accepts `AbortSignal` (`PiTaskBridge.executeTask(message, signal?)`); `SubprocessPiTaskBridge.runSubprocess` wires the signal to kill the child on abort; `a2a-server` threads the signal (`executePiTask`/`processTask`), and BOTH synchronous wait paths create an `AbortController` aborted on `req` 'close' (client disconnect) with `req.off` cleanup in `finally`; `procExited` flag guards every `proc.kill` (no late kill on a dead/reused PID). Item 3 (`/a2a-server start` host) verified already correct (spread preserves host). Atomicity documented (Node single-threaded).
- v0.5.5: closed the v0.5.4 audit residuals (deepseek LOW listener-cleanup-order; kimi LOW overflow guard; kimi MED queued-cancellation race).
- Deployed v0.5.4 + v0.5.5 to all 7 nodes (0 failures); verified executing.
- 1× deepseek validation (PASS) + 1× kimi audit (no HIGH/MED) — **converged**.

## Decisions
- Fire-and-forget/`returnImmediately` paths intentionally do NOT wire a signal (a client disconnecting after a queued ack must not cancel the background task).
- Stopped the fix-audit loop at convergence (deepseek PASS + kimi no HIGH/MED); further rounds = diminishing returns on theoretical LOWs.

## Thread impact
Closed all outstanding LOW items. v0.5.5 stable. Dual-model review converged.
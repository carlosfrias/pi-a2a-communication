---
prompt: 002
date: 2026-07-02
verbatim: |
  keep debugging the pi --print issue to finish the re-enable. validate with deepseek-v4-pro:cloud and audit with kimi-k2.7-code:cloud

  (plus, earlier in the arc: "Repeat the validation and audit 3 times after you think you are done." and "remember to bump the release.")
---

# 002 — Keep debugging `pi --print` to finish the re-enable

## Context
Fleet A2A nodes were "updated" (a2a extension rebuilt) but dispatched tasks echoed back the input instead of executing. Prior diagnosis pointed at the bridge/model-router. User directed: keep debugging the `pi --print` issue to finish the re-enable, and validate/audit with deepseek + kimi (repeat 3×; bump the release).

## Outcome
- Root-caused the echo to 4 layered issues: (1) `bridge.type: "noop"` (placeholder, never executes); (2) `pi --print` produced 0-byte stdout because loaded extensions interfered with non-interactive output; (3) the node `model-router` routed tasks to a `cloud-via-a2a` placeholder → cross-node dispatch / loop; (4) the 120s bridge timeout was too short for CPU-only qwen3.5:4b inference.
- Fixed in v0.4.1 (`SubprocessPiTaskBridge` executes locally with `--no-extensions --provider ollama --model qwen3.5:4b --tools bash`, 300s, `PI_A2A_SKIP_SERVER`) → all 7 nodes execute (verified real per-node output).
- Bumped the release (0.4.0 → 0.4.1).
- Ran 3× deepseek validation + 3× kimi audit (the "repeat 3×" directive) — surfaced the non-fleet regression + hardening debt → v0.5.0.

## Decisions
- `--no-extensions` to avoid extension stdout interference (keeps built-in bash + the router, which is built-in).
- Explicit `--provider ollama --model qwen3.5:4b` to bypass the router's cross-node loop.
- 300s timeout for CPU inference.
- Dual-model audit (RULE 23) for the fix.

## Thread impact
Opened the re-enable + hardening arc (v0.4.1 → v0.5.5). See journal `2026-07-02-0708.md`.
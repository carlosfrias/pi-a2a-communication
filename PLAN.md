---
name: pi-a2a-communication
phase: "Phase AUTO-ROUTE: Tier Hints for Fleet Routing — COMPLETE"
progress: 100
status: active
last_updated: 2026-07-05
---

# PLAN — pi-a2a-communication

## Phase AUTO-ROUTE: Tier Hints for Fleet Routing ✅ COMPLETE

**Eliminates ~15K tokens of "check fleet resources" reads per fleet request.** The model passes `agent_url="auto"` or a tier hint; the tool resolves it internally via fleet-resource-manager CLI → agents.json registry → fnet3 fallback.

### Implementation

- [x] AUTO.1 Identified token waste problem (~15K tokens per fleet request from re-reading skill files)
- [x] AUTO.2 Designed auto-routing solution (tier hints in `agent_url` parameter)
- [x] AUTO.3 Implemented `src/auto-route.ts` (312 lines)
  - [x] Tier classification from agent descriptions (RAM + GPU heuristics)
  - [x] Tier hints: `auto`, `any`, `executor`, `strong`, `medium`, `weak`, `light`
  - [x] Resolution order: fleet-resource-manager CLI → ConfigManager registry → fnet3 fallback
  - [x] Node name resolution (e.g. `fnet3` → `http://fnet3:10000`)
  - [x] Explicit URL pass-through (backward compatible)
- [x] AUTO.4 Updated `a2a_call` tool handler + parameter description
- [x] AUTO.5 Updated `a2a_parallel` tool handler + parameter description
- [x] AUTO.6 Updated `a2a_chain` tool handler + parameter description
- [x] AUTO.7 TDD — 18 unit tests (all passing, 197 total)
- [x] AUTO.8 Added RULE 34 to universal-rules (v1.13.0)
- [x] AUTO.9 Seeded semantic memory for future session recall
- [x] AUTO.10 Fleet-wide deployment (all 6 nodes via A2A `shell-exec`)
  - [x] `pi update` on each node (pulled commit `20fe997`, rebuilt clean)
  - [x] Delayed background `kill -9 MainPID` → systemd `Restart=on-failure`
  - [x] Verified all nodes back online with `auto-route.js` present
- [x] AUTO.11 Operator restarted pi on operator machine (RULE 29)
- [x] AUTO.12 FOCUS/PLAN/WORKBENCH refreshed on both sides (vault + workshop)

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where to inject routing | Inside the `a2a_call` tool handler | Zero context cost — model never needs fleet topology |
| Fallback node | fnet3 | Avoids fnet1 which runs Nextcloud |
| Tier classification | RAM + GPU heuristics from agent descriptions | No new config needed — uses existing agents.json |
| Hint format | Short strings (`auto`, `executor`, `weak`) | ~10 characters vs ~15K tokens of skill file reads |
| Explicit URLs | Pass through unchanged | Backward compatible |

---

## Phase EXEC: Executor-Tier Gap Remediation ✅ COMPLETE

**All four tiers deployed + verified fleet-wide.** See FOCUS.md for summary. The executor-tier gap is **CLOSED** — including hard agentic tasks.

### Root Cause (one paragraph)

`SubprocessPiTaskBridge` built `pi --print` commands with **no `--system-prompt`** (fleet ran qwen3.5:4b under a generic prompt → narration instead of execution). Both deterministic bypasses were dead. All four tiers (A/C/B/D) are now deployed + verified.

### Resolution Tiers

| Tier | Description | Priority |
|------|-------------|----------|
| **A** | Executor-role system prompt — add `systemPrompt`/`appendSystemPrompt` to `SubprocessBridgeOptions`; push `--system-prompt`/`--append-system-prompt`; ship default fleet-executor prompt; wire via per-node `config.json`. | 🔴 DO FIRST (fixes the observed symptom) |
| **C** | Deterministic `shell-exec` short-circuit — register a `shell-exec` task handler (`registerTaskHandler`) that runs commands via `child_process` for tasks tagged `metadata.exec=shell`; wire `AbortSignal` (closes the accepted limitation). | 🟡 next |
| **B** | Narration-detection guard — post-run heuristic re-steers if output has "I would run"/fenced commands with no real tool output. | 🟢 belt-and-suspenders |
| **D** | Model-escalation tier — escalate the *decision* to a stronger/cloud model while keeping execution local (reverses the "no cloud/hard-task escalation" limitation). | ⏸ gated (only if hard tasks misbehave after A–C) |

## Phase EXEC: Executor-Tier Gap Remediation 🟡

### Tier A — Executor-Role System Prompt (DO FIRST)

- [x] EXEC.A.0 Finding documented + dual-cause assessed (transport OK; executor-role tier unbuilt)
- [x] EXEC.A.1 Operator approved converting finding → PLAN/FOCUS (2026-07-03)
- [x] EXEC.A.2 PLAN/FOCUS written in vault (this phase)
- [x] EXEC.A.3 **TDD — write failing tests first** (RULE 2/CA-5):
  - [x] EXEC.A.3.1 Test — `SubprocessBridgeOptions` accepts `systemPrompt?: string` and `appendSystemPrompt?: string`
  - [x] EXEC.A.3.2 Test — when `systemPrompt` set, `runSubprocess` pushes `--system-prompt <value>` onto args
  - [x] EXEC.A.3.3 Test — when `appendSystemPrompt` set, `runSubprocess` pushes `--append-system-prompt <value>` onto args
  - [x] EXEC.A.3.4 Test — neither set → args unchanged (no regression; non-fleet safe)
  - [x] EXEC.A.3.4b Test — empty-string systemPrompt/appendSystemPrompt do NOT push the flag (truthiness guard) [kimi Low]
  - [x] EXEC.A.3.5 Test — `BridgeConfig` in `types.ts` carries optional `systemPrompt`/`appendSystemPrompt`; `config.ts` DEFAULTS leave them unset (opt-in)
  - [x] EXEC.A.3.6 Test — `buildBridgeOptions(config)` maps `bridge.systemPrompt`/`appendSystemPrompt` → `SubprocessBridgeOptions` + end-to-end spawned `--system-prompt`
- [x] EXEC.A.4 **Implement** (`src/pi-task-bridge.ts`, `src/types.ts`, `src/bridge-options.ts` NEW, `src/index.ts`). Commit `5fa9f14`.
- [x] EXEC.A.5 Ship default fleet-executor system prompt in `ansible/deploy-a2a.yml` (`bridge_systemPrompt`); also fixed stale template to v0.5.5 fleet reality + `bridge_tools: bash,read,edit` (align with prompt).
- [x] EXEC.A.6 **RULE 23 dual-model review** — deepseek VALIDATE (CONDITIONAL) + kimi AUDIT (CONDITIONAL); converged → all findings applied in commit `e68bded` (`/a2a-server start` handler refactored; ansible `to_json` JSON-safety; tools/prompt alignment; negative test; trailing newlines). Non-fleet safety confirmed by both.
- [x] EXEC.A.7 Build `dist/` (`npm run build` clean); **RULE 29** restart pending deploy (A.8). Suite **296/296 green**.
- [x] EXEC.A.8 Deploy to fnet3 via `deploy-a2a.yml` (RULE 28 playbook); verify fnet3 actually invokes `bash` and returns real stdout for an open-ended task (regression test for the gap). Then deploy to all 7 nodes.
  - [x] EXEC.A.8.1 **fnet3 canary deployed + VERIFIED (2026-07-03)** — repo tip `e68bded`, `dist/bridge-options.js` built on-node, `config.json` has `bridge.systemPrompt` (fleet-executor prompt) + `tools=bash,read,edit`. Service restarted (`ActiveEnterTimestamp` 16:54 UTC, port 10000 LISTEN). **Gap regression test PASSED:** `hostname`→`fnet3` and `echo $((17*23))`→`391` (real stdout, not narration).
  - [x] EXEC.A.8.2 **All-7 deploy + verified (2026-07-03)** — `deploy-a2a.yml -e ansible_become=false --skip-tags restart` shipped code+build+config to fnet1–7 (failed=0); `systemctl restart --no-block pi-agent@<node>` on all 7; all active + port 10000 LISTEN (~17:10 UTC). **Full-fleet regression test PASSED:** `echo $((17*23))`→`391` on all 7 (fnet2/fnet3/fnet5/fnet7 clean; fnet1/fnet4/fnet6 prose-wrapped but all executed real commands). **Executor-tier gap CLOSED fleet-wide.**
  - **Playbook become gotcha (follow-up):** `deploy-a2a.yml` + inventory `ansible_become=true` makes tasks run as root → `ansible_env.HOME=/root` → wrong repo path + no nvm (`npm: command not found`). Workaround: `-e ansible_become=false` (code/build/config as friasc; restart task's `become: yes` still escalates). systemd module restart timed out → `systemctl restart --no-block`. **Harden playbook**: become-independent `a2a_repo` (`/home/{{ ansible_user }}/.pi/...`), `become: false` on code/build/config, `--no-block`/raised timeout for restart.
  - **Prompt-quality follow-up (non-blocking):** some nodes (fnet1/fnet4/fnet6) wrap real stdout in prose/code-fences. The core gap (narrate-without-executing) is closed; chattiness could be tightened by adding "Paste ONLY the raw stdout — no prose, no code fences" to the default `bridge_systemPrompt`.
- [x] EXEC.A.9 Update CHANGELOG (0.6.0 entry) + version bump (`package.json` + `pi-package.json` 0.5.5/0.4.0 → 0.6.0); vault FOCUS/PLAN/WORKBENCH synced. Repo-side FOCUS/PLAN/WORKBENCH full Phase EXEC sync = follow-up (vault is doc-authoritative per RULE 26). Build clean, 296/296 green.

### Tier C — Deterministic `shell-exec` Short-Circuit ✅

- [x] EXEC.C.1 TDD — handler runs `metadata.command` via `child_process` and returns stdout as artifact (no model). Commit `4ef8c76`.
- [x] EXEC.C.2 TDD — handler honors `AbortSignal` (forwards to `exec`; rejects `Aborted` on abort).
- [x] EXEC.C.3 TDD — `processTask` routes tagged `shell-exec` tasks to the handler BEFORE the bridge; untagged tasks unaffected (still → model). Review fix: explicit `metadata.skills` checked BEFORE the catch-all `a2a-task-execution` session handler (reorder).
- [x] EXEC.C.4 Implement `shell-exec` handler (`src/shell-exec-handler.ts`) + register it (`index.ts` both start paths); thread `signal` to custom handlers in `processTask`/`processTaskStreaming` (`processTaskStreaming` wires an `AbortController` from `res 'close'`). `a2a_call` tool gains a `metadata` param forwarded end-to-end.
- [x] EXEC.C.5 RULE 23 dual-model review (deepseek VALIDATE + kimi AUDIT, both CONDITIONAL → findings applied: reorder `skillIds`, streaming `AbortSignal`, negative tests; commit `770f0da`); build clean; **deployed + verified on all 7 nodes** — `metadata.exec=shell, command=echo $((17*23))` → `391` (deterministic, 78ms) on every node; untagged control still → model (`391`, 73s). 308/308 green.

### Tier B — Narration-Detection Guard (belt-and-suspenders) ✅

- [x] EXEC.B.1 TDD — `isNarration` detector. **RULE 23 audit-driven change:** the standalone fenced-command-block heuristic was dropped as false-positive-prone on legitimate "result + show the command" outputs; the detector is now conservative + phrase-based (first-person "I would run / I'd execute / I should run / I need to run / let me run / I'm going to run / the command …" ). Pure-fence narration is an accepted false negative (Tier A prompt + phrases cover the common cases). Tests: 5 detector + 2 false-positive regression.
- [x] EXEC.B.2 Implement `runWithNarrationGuard` in `SubprocessPiTaskBridge.executeTask` — re-runs ONCE with a forced "output ONLY the raw result, no prose/fences" follow-up that feeds back the (truncated to 500 chars) prior narration. Opt-in (`narrationGuardEnabled`, default false), capped at `narrationMaxRetries` (default 1) — no infinite loop. Signal threaded through `executeTaskWithProgress` (streaming guard retry is abortable on client disconnect). Commit `e219c3e`.
- [x] EXEC.B.3 RULE 23 dual-model review (deepseek VALIDATE PASS + kimi AUDIT CONDITIONAL → findings applied: drop fence heuristic, strengthen follow-up + truncate, thread signal, ansible `to_json`, false-positive + abort tests; commit `a589e69`); build clean; **deployed + verified on all 7 nodes** — config.json `narrationGuardEnabled=true` + `narrationMaxRetries=1`, dist has `isNarration`; regression: normal model-path task → real `391` (guard does not break real output / no wasteful re-run); fnet1 recovered real `391` (guard re-ran after a narration). 323/323 green.

### Tier D — Model-Escalation (agent-exec strong-model escalation) ✅ — deployed + verified on 32GB

- [x] EXEC.D.1 Gated decision — the operator confirmed the condition is met: *they currently avoid dispatching hard agentic tasks to the fleet because of the no-escalation limit.* So Tier D was built (not closed).
- [x] EXEC.D.2 TDD + RULE 23 dual-model review (deepseek PASS + kimi CONDITIONAL → findings applied: dedicated `agentExecSystemPrompt`, narration guard OFF for the strong model, 16GB explicit-fail, opt-in `maxQueue`) + build. Commits `b40bf53` + `9e72315`.
- [x] EXEC.D.3 Initial verification: minimal task PASSED (fnet4, 35B ran bash + real output); multi-step task CRASHED fnet4 — root cause was **reload churn** (fleet `OLLAMA_KEEP_ALIVE=0` reloaded the 23GB 35B every turn → OOM on a multi-step loop), NOT steady-state RAM (~24GB resident / ~7GB free is survivable).
- [x] EXEC.D.4 **Unblock fix (commit `34d3277`):** gave the agent-exec subprocess its OWN `OLLAMA_KEEP_ALIVE` (default 10m) via a new bridge `env` option → the 35B loads ONCE and stays resident across the multi-step loop (no per-turn reload spike). Keeps the 36B capability; no new model needed. `BridgeConfig.agentExecKeepAlive`; ansible `bridge_agentExecKeepAlive=10m`.
- [x] EXEC.D.5 **Re-enabled on 32GB + deployed + verified fleet-wide.** 32GB nodes (fnet3-6): `agentExecEnabled=true` + `agentExecKeepAlive=10m`; 16GB nodes (fnet1/2/7): `agentExecEnabled=false` → agent-exec tasks explicitly fail (clear message, no silent 4B downgrade). Verification: multi-step hard task (read `/etc/os-release` + `bash uptime -p` + synthesize) → `state=completed`, real answer on fnet4 (135s) AND fnet3 (143s, reproducibility), nodes stayed up; 16GB explicit-fail re-confirmed on fnet1. 339/339 green.
- [x] EXEC.D.6 **UNLOCKS hard agentic tasks on the fleet** (the operator previously avoided them). The agent-exec path uses the strong local model for the decision loop with execution staying on the node (code/data never leave). Caveat: ~7GB free during a 35B agent loop on 32GB — fine for one task at a time (maxConcurrent=1 + maxQueue=2); don't pile many concurrent hard tasks on one node. For even more headroom a lighter capable model (e.g. qwen3.5:14b) could be pulled later.

### Phase EXIT Criteria

- [x] Fleet nodes (all 7) return **real stdout** (not plan-narration) for open-ended execution tasks, verified end-to-end via A2A dispatch.
- [x] Tier A deployed + verified; Tier C deployed + verified (trivial commands bypass the model); Tier B in place.
- [x] RULE 23 dual-model review converged (deepseek PASS / kimi no HIGH/MED) for A and C.
- [x] FOCUS/PLAN/WORKBENCH synced vault ↔ repo; CHANGELOG + version bumped; journal entry + cost tracking at session close.

---

## Prior: M8 — Stable Release (v0.2.0) — ✅ (vault stale at v0.4.0; see repo for v0.5.5 arc)

**v0.2.0 released.** All 7 spec gaps fixed, 19/19 conformance tests passing, alpha suffix dropped.

### Release History

| Version | Date | Description |
|---------|------|-------------|
| v1.0.1 (upstream) | 2026-06-18 | Deployed to all 7 fleet nodes |
| v0.1.0-alpha.1 (fork) | 2026-06-18 | Initial fork, 84 tests |
| v0.2.0-alpha.1 (fork) | 2026-06-19 | A2A v1.0 spec compliance fixes (S1–S6b), 19/19 conformance tests |
| **v0.2.0 (fork)** | **2026-06-19** | **Stable release — alpha dropped, CHANGELOG.md created** |

---

## Follow-ups (2026-07-04) ✅

Post-Phase-EXEC hardening — all deployed to all 7 via the hardened playbook (no `-e ansible_become=false` workaround):

- [x] **#1 — deploy-a2a.yml hardened** (commit `5497b7a`): play var `ansible_become: false` overrides the inventory `ansible_become=true` (code/build/config run as friasc — correct HOME/nvm/ownership); `/home/{{ ansible_user }}` paths (become-independent); restart task uses `systemctl restart --no-block` (shell) + escalates via a TASK VAR `ansible_become: true` (the play var is a magic var that overrides a task `become: yes` keyword); `a2a_version` 0.5.5→0.6.0. A plain `ansible-playbook -i inventory.ini deploy-a2a.yml` now works.
- [x] **#2 — Tier A fleet-executor prompt tightened** (commit `9e93bf6`): "Paste ONLY the raw result — no prose, no code fences, no re-statement of the command, no commentary such as 'The answer is'". Verified fnet4 + fnet1 (previously chatty) now return clean raw `391`. (Tier D `agentExecSystemPrompt` unchanged.)
- [x] **#3 — per-task `metadata.model` override for agent-exec** (commit `6780b6f`): agent-exec honors `task.metadata.model` (string) to override the configured strong model; per-model `SubprocessPiTaskBridge` cache (each model its own `maxConcurrent` semaphore). Empty/non-string falls back to the configured model (backward compatible).
- [x] **#4 — assert `ansible_memtotal_mb`** (commit `6780b6f`): `deploy-a2a.yml` asserts the fact is defined/>0 as the first task — a missing/zero fact (gather_facts failure) fails the deploy loudly instead of silently disabling agent-exec 32GB gating on every node.
- [x] **#5 — orchestrator pi session restart** (2026-07-04): exposed the `a2a_call` `metadata` param; Tier C/D now dispatchable from the orchestrator (verified: shell-exec via `a2a_call` returned `HELLO_FROM_FNET4_VIA_METADATA`).

Remaining non-blocking: **#6 — full v0.6.0 vault↔repo FOCUS/PLAN/WORKBENCH sync** ✅ DONE (2026-07-05).

## M6: Spec Compliance Implementation ✅

### P0 — Security & Crash Bugs (Done ✅)

- [x] M6.1: Fix S2 (P0) — `WWW-Authenticate: Bearer` header on 401 responses
- [x] M6.2: Fix S5 (P0) — try/catch around `JSON.parse` in `handleSendMessage`
- [x] M6.3: Fix S3 (P0) — `/.well-known/agent-card.json` spec path + legacy compat

### P1 — Spec Compliance (Done ✅)

- [x] M6.4: Fix S6 (P1) — PascalCase method name mapping (`SendMessage`, `GetTask`, etc.)
- [x] M6.5: Fix S1 (P1) — JSON-RPC errors return HTTP 200 (not 400)
- [x] M6.6: Fix S6b (P1) — `id: null` instead of `id: 0` in error responses

### P2 — Transport Binding (Done ✅)

- [x] M6.7: Fix S4 (P2) — `/rpc`, `/message:send`, `/message:stream` transport routes

### Remaining

- [x] M6.8: All 19 conformance tests passing ✅ **DONE**
- [x] M6.9: Version bump `package.json` to `0.2.0-alpha.1`
- [x] M6.10: Push to GitHub, verify repo writable
- [x] M6.11: Reinstall on fleet nodes with updated fork

## Spec Compliance Gaps (S1–S6b) — All Fixed ✅

| ID | Severity | Issue | Fix | Status |
|----|----------|-------|-----|--------|
| S1 | Medium | JSON-RPC errors return HTTP 400 | `sendJSONRPCError` → HTTP 200 | ✅ |
| S2 | High | 401 responses lack `WWW-Authenticate` | Added `WWW-Authenticate: Bearer` | ✅ |
| S3 | High | Wrong Agent Card path | Added spec path + legacy compat | ✅ |
| S4 | High | Missing transport routes | Added `/rpc`, `/message:send`, `/message:stream` | ✅ |
| S5 | High | Uncaught parse error → HTTP 500 | Added try/catch in `handleSendMessage` | ✅ |
| S6 | High | Slash-separated method names | Added PascalCase method mapping | ✅ |
| S6b | Low | `id: 0` in parse errors | Changed `id ?? 0` → `id ?? null` | ✅ |

### M8: Stable Release ✅

- [x] M8.1: Version bump to `0.2.0` (drop alpha suffix)
- [x] M8.2: Create CHANGELOG.md
- [x] M8.3: FPB/FDP/Universal Rules compliance audit
- [x] M8.4: Clean wiki structure (Rule 25/27), remove stray files
- [x] M8.5: Sync vault documentation

## M7: Upstream Issues (Deferred)

- [x] M7.1: File spec issues against DrOlu/pi-a2a-communication (S1–S6b)
- [x] M7.2: Upstream PRs submitted (PR #9 + PR #10). Issues #3-#8 reopened. Awaiting DrOlu response.

**Upstream PR landscape:**

| PR | Author | Scope | Overlap with S1–S6b |
|----|--------|-------|----------------------|
| #1 | 5queezer (Christian Pojoni) | Session execution mode, auth restructuring, streaming fix, Bearer undefined fix | S2 partial (moves auth to per-route but no WWW-Authenticate header), S3 partial (uses `/.well-known/agent-card` not spec `/.well-known/agent-card.json`), adds session execution (we solved differently via PiTaskBridge) |
| #2 | cavos-io (Ramdhan Hidayat) | Custom A2A config directory (`PI_A2A_CONFIG_DIR`) | None — purely additive feature |

**Our unique fixes (no overlap):** S1 (JSON-RPC errors → HTTP 200), S4 (transport binding routes), S5 (parse error handling), S6+S6b (PascalCase methods, `id: null`). These 4 fixes have zero coverage from existing PRs.

**Recommendation remains: narrow PR with S1–S6b spec fixes only.** Session execution approach differs from PR #1 — ours uses PiTaskBridge/SubprocessPiTaskBridge, theirs uses executionMode + SessionReplyBridge. Both approaches are valid; ours is fleet-specific.

## Known Gaps

### GAP-1: node-router Archived — Migrated to fleet-resource-manager ✅

node-router has been archived. Its coms-net components (`fleet_agent.py`, `orchestrator_client.py`) spoke a deprecated protocol. The scoring/routing/benchmarking capabilities have been migrated to fleet-resource-manager, which uses A2A protocol natively.

- [x] GAP-1.0: Archive node-router project to `04-Archive/Infrastructure/node-router/`
- [x] GAP-1.1: Migrate benchmark capability to fleet-resource-manager `benchmark` subcommand
- [x] GAP-1.2: Update routing tables (AGENTS.md, project-map.md) to route node-router keywords to fleet-resource-manager
- [x] GAP-1.3: Replace remaining coms-net dispatch references with A2A tools ✅ (no active coms-net dispatch code remains — only conformance tests verifying absence)

### GAP-2: PiSessionTaskHandler — Cleaned Up ✅

Dead `ctx.newSession` code path removed (2026-07-05). The handler was always NON-FUNCTIONAL on the fleet (`ctx.newSession` unavailable on `ExtensionContext`). Refactored to `createMemoryDispatchHandler` — memory-dispatch logic preserved for agent-memory short-circuit; `PI_SESSION_UNAVAILABLE` fallthrough maintained for non-memory tasks. `PiSessionTaskHandler` class and `SessionHandlerOptions` removed.

- [x] GAP-2.1: Implement PiSessionTaskHandler using `ctx.newSession()` in pi v0.79.10
- [x] GAP-2.2: Verify PiSessionTaskHandler auto-activates on fleet nodes ✅ (v0.4.0 deployed to all 7 nodes)
- [x] GAP-2.3: Dead code cleaned up (2026-07-05); `createMemoryDispatchHandler` is the replacement as interim solution (current fallback — can be replaced by GAP-2.1)

### GAP-3: local-model-pilot Profiles — Created ✅

Created fleet node model profiles and Ansible deployment playbook.

- [x] GAP-3.1: Create `linux-31gi` profile (6 models, local-first routing) and `linux-15gi` profile (1 model, cloud-first routing)
- [x] GAP-3.2: Create `deploy-model-profiles.yml` Ansible playbook with RAM detection and security validation
- [x] GAP-3.3: Deploy profiles to fleet nodes ✅ (linux-31gi on fnet3-6, linux-15gi on fnet1,2,7)
- [x] GAP-3.4: Verify model routing produces correct `model_match_score` values ✅ (all 7 nodes verified)

### GAP-4: capacity_score Zero for CPU-Only Nodes — Fixed ✅

`score_nodes.py` was using `min(vram_ratio, ram_ratio, 1.0)` where `vram_gb=0` forced `capacity_score=0`. **Now fixed** in fleet-resource-manager v0.1.0: when `vram_gb == 0 and ram_gb > 0`, uses `capacity_score = min(ram_ratio * 0.25, 1.0)`. 37 tests passing.

**Closed 2026-06-23.** Fixed in fleet-resource-manager v0.1.0. CPU-only capacity_score now uses `ram_ratio * 0.25` floor.

- [x] GAP-4.1: Fix formula — when `vram_gb == 0 and ram_gb > 0`, use `capacity_score = min(ram_ratio, 1.0)` ✅
- [x] GAP-4.2: Add CPU-only node test fixtures ✅
- [x] GAP-4.3: Verify 32GB nodes score higher than 16GB nodes ✅

### GAP-5: Stale Playbook-Executor References — Cleaned ✅

Replaced coms-net playbooks with A2A-aware equivalents:

- [x] GAP-5.1: Created `start-agents-a2a.yml` and `shutdown-fleet-a2a.yml`
- [x] GAP-5.2: Updated `playbook-index.json` with A2A triggers (kept coms-net synonyms for backward compat)
- [x] GAP-5.3: Removed obsolete `deploy-hub-to-fnet2.yml`, `deploy-fleet.yml`, `inventory/coms-net.yml`
- [x] GAP-5.4: Backed up and removed `start-agents.yml` and `shutdown-fleet.yml` (old coms-net versions)

### GAP-3.5: Fleet Model Upgrade — qwen3.5:35b-a3b ✅

Replaced `openbmb/minicpm-o2.6:8b` with `qwen3.5:35b-a3b` as flagship model on 32GB nodes. MoE architecture (36B total, 3B active per token) provides 10.4 tok/s on CPU — faster than expected and faster than the 4B dense model.

- [x] GAP-3.5.1: Benchmark qwen3.5:35b-a3b on fnet3 (10.4 tok/s eval, 28s cold load, 9.1GB RAM) ✅
- [x] GAP-3.5.2: Pull qwen3.5:35b-a3b on all 4 × 32GB nodes ✅
- [x] GAP-3.5.3: Update linux-31gi models.json and model-router.json with 35b-a3b as flagship ✅
- [x] GAP-3.5.4: Deploy updated profiles to all 7 fleet nodes ✅
- [x] GAP-3.5.5: Remove pi-model-router from fleet nodes (was overwriting Ansible-deployed config) ✅
- [x] GAP-3.5.6: Verify routing persists across pi-agent restarts ✅
- [~] minicpm-o2.6:8b: Kept as fallback on 32GB node disks (5.5GB each, superseded by 35b-a3b)

**Routing impact:** 8 routes moved from cloud-via-A2A or minicpm to 35b-a3b: `auto/medium`, `reasoning/medium`, `reasoning/low`, `coding/medium`, `local/high`, `local/medium`, `vision/medium`, `vision/low`. Total 32GB routing: 23 local + 10 cloud-via-A2A.

| Scenario | Playbook | Command |
|----------|----------|--------|
| First-time node setup | pi-carlos-env-bootstrap | `scripts/bootstrap-pi.sh --profile linux-31gi` |
| A2A extension update | deploy-a2a.yml | `ansible-playbook -i ansible/inventory.ini ansible/deploy-a2a.yml` |
| Model config changes | deploy-model-profiles.yml | `ansible-playbook -i ansible/inventory.ini ansible/deploy-model-profiles.yml` |
| Health monitor update | deploy-fleet.yml | `ansible-playbook -i ansible/inventory.ini ansible/deploy-fleet.yml` |
| Full fleet refresh | Both playbooks | Deploy A2A, then deploy model profiles |

---

## M9: Client Features ✅

### M9.0: taskAgents tracking ✅

- [x] M9.0.1: Test — `sendTask()` records agent URL in `taskAgents` Map
- [x] M9.0.2: Test — `sendParallelTasks()` records each task's agent URL
- [x] M9.0.3: Test — `sendChainedTasks()` records each step's agent URL
- [x] M9.0.4: Impl — Add `this.taskAgents.set()` calls in task-manager.ts

### M9.1: `/a2a-broadcast` improvements ✅

- [x] M9.1.1: Test (char) — broadcast with no args shows usage
- [x] M9.1.2: Test (spec) — null taskManager/agentDiscovery shows error
- [x] M9.1.3: Test — partial discovery failure returns partial results
- [x] M9.1.4: Test — progress callback formats agent name + state
- [x] M9.1.5: Impl — Wrap discovery in `Promise.allSettled()`, add null guards

### M9.2: `/a2a-chain` refactor ✅

- [x] M9.2.1: Test (char) — chain with no args shows usage
- [x] M9.2.2: Test — chain parses pipe-delimited steps into `TaskChainConfig`
- [x] M9.2.3: Test — chain delegates to `taskManager.sendChainedTasks()`
- [x] M9.2.4: Test — chain reports step progress as `Step X/N: AgentName...`
- [x] M9.2.5: Impl — Refactor `/a2a-chain` handler to use `sendChainedTasks()`

### M9.3: `/a2a-status` agent URL resolution ✅

- [x] M9.3.1: Test (char) — status with no task ID shows usage
- [x] M9.3.2: Test — status resolves agent from taskAgents cache
- [x] M9.3.3: Test — status with unknown task suggests providing agent URL
- [x] M9.3.4: Test — status formats output with task ID, state, artifacts
- [x] M9.3.5: Impl — Update `/a2a-status` with cache lookup, fallback discovery

### M9.4: `a2a_chain` tool registration ✅

- [x] M9.4.1: Test — extension registers `a2a_chain` tool (3 tools total)
- [x] M9.4.2: Test — `a2a_chain` requires `steps` parameter
- [x] M9.4.3: Test — `a2a_chain` calls `sendChainedTasks()` and returns final output
- [x] M9.4.4: Test — `a2a_chain` with `continueOnError: true` passes it through
- [x] M9.4.5: Impl — Add `a2a_chain` tool in `index.ts`, update `pi-package.json`

### M9.5: Streaming improvements ✅

- [x] M9.5.1: Test — `a2a_call` with `streaming: true` sends progress via `onUpdate`
- [x] M9.5.2: Test — `/a2a-send` with streaming shows state transitions
- [x] M9.5.3: Impl — Review and improve streaming progress formatting

## M10: Server Integration ✅

### M10.0: PiTaskBridge interface ✅

- [x] M10.0.1: Test — `PiTaskBridge` interface defines `executeTask(message): Promise<string>`
- [x] M10.0.2: Test — `PiTaskBridge` interface defines `executeTaskWithProgress(message, onProgress)`
- [x] M10.0.3: Impl — Create `src/pi-task-bridge.ts` with interface + `NoOpPiTaskBridge`

### M10.1: Replace executePiTask() stub ✅

- [x] M10.1.1: Test (char) — Current stub returns `[A2A Task Result]` placeholder
- [x] M10.1.2: Test (char) — Current `executePiTaskWithProgress` calls progress callbacks
- [x] M10.1.3: Test — A2AServer accepts optional `PiTaskBridge` in constructor
- [x] M10.1.4: Test — `processTask()` delegates to bridge
- [x] M10.1.5: Test — `processTaskStreaming()` delegates to bridge with progress
- [x] M10.1.6: Test — No bridge provided → uses `NoOpPiTaskBridge` (backward compat)
- [x] M10.1.7: Test — Bridge error → task state `failed` with `isError: true`
- [x] M10.1.8: Impl — Replace stub, add constructor param, update exports

### M10.2: Register task handler ✅

- [x] M10.2.1: Test — `registerTaskHandler('skill', handler)` stores and calls handler
- [x] M10.2.2: Test — `processTask()` checks handlers before bridge fallback
- [x] M10.2.3: Test — No handler match → falls back to `piTaskBridge`
- [x] M10.2.4: Impl — Hook `session_start` to register skill handlers via `registerTaskHandler()`

### M10.3: SubprocessPiTaskBridge ✅

- [x] M10.3.1: Test — Spawns `pi` CLI with task message as input
- [x] M10.3.2: Test — Returns stdout as task result
- [x] M10.3.3: Test — Handles ENOENT (pi not found) gracefully
- [x] M10.3.4: Test — Handles timeout with meaningful error
- [x] M10.3.5: Impl — Create `SubprocessPiTaskBridge` in `pi-task-bridge.ts`

### M10.4: Integration tests ✅

- [x] M10.4.1: Test — Full lifecycle: start server, send message, get status, cancel, stop
- [x] M10.4.2: Test — Streaming lifecycle: start, send streaming message, receive SSE events
- [x] M10.4.3: Test — Task handler routing: registered handler takes priority over bridge
- [x] M10.4.4: Test — Error lifecycle: bridge throws → task state `failed`

### M10.5: Deploy and update documentation ✅

- [x] M10.5.1: Update agent card skill descriptions
- [x] M10.5.2: Update AGENTS.md (remove CA-3, add PiTaskBridge rule)
- [x] M10.5.3: Version bump to `0.3.0`
- [x] M10.5.4: Update CHANGELOG.md
- [x] M10.5.5: Deploy to fleet nodes, verify with conformance tests

---

### M1: Fork & Audit (Done)
- [x] M1.1–M1.5: Fork, audit, test framework, characterization tests, package rename

### M2: Agent Cards (Done)
- [x] M2.2–M2.3: Generate and deploy Agent Cards for 7 fleet nodes

### M3: Fleet Deployment (Done)
- [x] M3.1–M3.3: Deploy config, restart, verify

### M4: Client Polish (Cancelled)
- [-] M4.1–M4.3: Cancelled (using upstream v1.0.1)

### M5: Upstream Integration (Done)
- [x] M5.1–M5.8: Deploy, verify, archive fork, conformance audit
- [>] M5.7: Submit spec issues to upstream — Deferred

---

## Post-v0.4.0: A2A-to-fnet execution (2026-07-01) ✅

The v0.4.0 "all gaps resolved" claim was overstated — dispatched A2A tasks returned a NoOp placeholder, never executing. This workstream closed that gap (later superseded by the v0.4.1→v0.5.5 transport-hardening arc + Phase EXEC).

- [x] Extension builds in the pi install location — `prepare` script (9a7fcf0) + ambient `node:sqlite`/`better-sqlite3` decls (6a39222). Without this, `a2a_call`/`a2a_parallel` never loaded.
- [x] `a2a_call` authenticates against auth-protected fleet agent cards — bearer header in `fetchAgentCard` + 2 conformance tests (e2c7e6b).
- [x] fnet3 pi upgrade 0.79.4→0.80.3 — `upgrade-pi.yml` playbook, RULE 28, `become_user: friasc` for nvm (00277a7, f0db9fe). Good housekeeping; NOT the execution fix.
- [x] fnet3 executes real A2A tasks — `PI_A2A_SKIP_SERVER` env gate in `index.ts` + `SubprocessPiTaskBridge` env-on-spawn + `stdio:['ignore','pipe','pipe']` + SIGTERM→SIGKILL (2c4db15). TDD (5 new tests; 111/111 unit + 39/39 conformance). Dual-model audit (deepseek-v4-pro validate + kimi-k2.7 audit). fnet3 returned `391` for `17×23` (qwen3.5:35b-a3b).
- [~] GAP-2 (`PiSessionTaskHandler`) reclassified NON-FUNCTIONAL — design flaw: `ctx.newSession` is only on `ExtensionCommandContext`, not the `session_start` event's `ExtensionContext`. Always threw `PI_SESSION_UNAVAILABLE` → always fell back to the bridge. (Phase EXEC Tier C now routes explicit `metadata.skills` before this dead handler.)

### Follow-ups filed (status as of 2026-07-04)
- [x] a2a_call tool output-extraction quirk — RESOLVED 2026-07-02 (v0.5.0+: `streaming=false` + 300s timeout so the synchronous wait returns the completed task; extraction prefers `artifacts[0]`).
- [x] Dead `PiSessionTaskHandler` cleanup — SUPERSEDED 2026-07-02: `SubprocessPiTaskBridge` owns real execution (opt-in flags + AbortSignal); a2a-server threads the signal. Harmless fallback; optional future removal.
- [>] Option B: command-context task execution to reuse the running tmux pi's loaded model (avoid ~89s per-task cold start from `OLLAMA_KEEP_ALIVE=0`). Long-term. (Phase EXEC Tier D's `OLLAMA_KEEP_ALIVE=10m` mitigates the reload churn for agent-exec; Option B remains a broader optimization.)
- [x] Document/file upstream: pi `/reload` does not re-evaluate extension ESM modules — a rebuilt `dist/` requires a full process restart (RULE 29).
- [x] M7.2: Upstream PRs submitted (PR #9 + PR #10). See FOCUS.md.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Use upstream v1.0.1 on fleet | Not our fork | Fleet uses npm package directly |
| Reactivate fork for M6 | Yes | Upstream not responding |
| Fix priority | P0→P1→P2 | Security/crash bugs first |
| TDD mandatory | Conformance suite is source of truth | No gap "fixed" until test passes |
| Wiki clean per Rule 27 | All docs in `wiki/` | Root only has operational files |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-07-05*
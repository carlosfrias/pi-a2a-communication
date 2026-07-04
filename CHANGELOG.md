# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-07-03

### Added

- **Executor-role system prompt (Phase EXEC Tier A)** — `SubprocessPiTaskBridge` now steers the spawned `pi --print` with an opt-in `--system-prompt` / `--append-system-prompt` so the fleet's qwen3.5:4b actually invokes tools + pastes real stdout instead of narrating command plans. Closes the executor-tier gap (fleet nodes echoed command plans rather than executing). See `wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md`.
  - `systemPrompt` / `appendSystemPrompt` on `SubprocessBridgeOptions` + `BridgeConfig` (opt-in; non-fleet safe — flags omitted when unset).
  - `buildBridgeOptions()` pure helper (`src/bridge-options.ts`) extracted from `index.ts`; both start paths (`session_start` + `/a2a-server start`) now use it.
  - Default fleet-executor prompt shipped in `ansible/deploy-a2a.yml` (`bridge_systemPrompt`).
  - 10 TDD tests (`tests/unit/executor-tier-system-prompt.test.ts`); RULE 23 dual-model review (deepseek VALIDATE + kimi AUDIT) converged; 296/296 green.
  - Deployed + verified on all 7 fleet nodes — regression test `echo $((17*23))` → `391` (real stdout) on every node.

- **Deterministic `shell-exec` short-circuit (Phase EXEC Tier C)** — a task tagged `metadata.exec="shell"` + `metadata.command` + `metadata.skills=["shell-exec"]` runs the command via `child_process` and returns stdout as the artifact — NO model in the loop (78ms vs ~70s for the model path). Honors `AbortSignal` (closes the accepted limitation "custom task handlers don't receive the signal").
  - `createShellExecHandler()` (`src/shell-exec-handler.ts`); registered as `"shell-exec"` on both start paths.
  - `processTask`/`processTaskStreaming`: explicit `metadata.skills` are now checked BEFORE the catch-all `a2a-task-execution` session handler (so a tagged deterministic handler takes priority and the session handler's `parseMemoryRequest` can't hijack it); `PI_SESSION_UNAVAILABLE` `continue`s to the next handler; `processTaskStreaming` wires an `AbortController` from `res 'close'`.
  - `a2a_call` tool gains a `metadata` param (forwarded end-to-end: tool → `sendTask` → client → server → `task.metadata.skills`).
  - 12 TDD tests (`tests/unit/shell-exec-handler.test.ts`); RULE 23 dual-model review (deepseek + kimi) converged; 308/308 green.
  - Deployed + verified on all 7 fleet nodes — `metadata.exec=shell, command=echo $((17*23))` → `391` (deterministic, sub-second) on every node; untagged tasks still route to the model (Tier A) unchanged.

- **Narration-detection guard (Phase EXEC Tier B)** — belt-and-suspenders on Tier A: after `pi --print` returns, if the output looks like plan-narration (first-person "I would run…" phrases), re-run ONCE with a forced "output ONLY the raw result, no prose/fences" follow-up that feeds back the (truncated) prior narration. Opt-in (`narrationGuardEnabled`, default false), capped at `narrationMaxRetries` (default 1) — no infinite loop. Conservative phrase-based detector (the standalone fenced-block heuristic was dropped as false-positive-prone per RULE 23 audit).
  - `SubprocessPiTaskBridge.executeTask` wraps `runSubprocess` in `runWithNarrationGuard`; exported `isNarration` detector (`src/pi-task-bridge.ts`).
  - `AbortSignal` threaded through `executeTaskWithProgress` so the streaming guard retry is abortable on client disconnect.
  - `BridgeConfig` + `buildBridgeOptions` + ansible carry the fields; `bridge_narrationGuardEnabled=true` + `bridge_narrationMaxRetries=1` (fleet default on).
  - 15 TDD tests (`tests/unit/narration-guard.test.ts`); RULE 23 dual-model review (deepseek PASS + kimi CONDITIONAL → findings applied); 323/323 green.
  - Deployed + verified on all 7 fleet nodes — config.json `narrationGuardEnabled=true`; regression: normal model-path task → real `391` (guard does not break real output); fnet1 recovered real `391` after a narration.

- **agent-exec strong-model escalation (Phase EXEC Tier D) — deployed + verified on 32GB nodes.** A task tagged `metadata.exec="agent"` + `metadata.skills=["agent-exec"]` spawns `pi --print` with the strong local model (`qwen3.5:35b-a3b`) + full tools + a dedicated capable-agent prompt, so a capable model runs the agentic decision loop locally (`src/agent-exec-handler.ts`; `BridgeConfig` gains `agentExec*`; opt-in `maxQueue` on the bridge; per-subprocess `env`). 16 TDD tests, 339/339 green; RULE 23 deepseek PASS + kimi CONDITIONAL (findings applied). **Verification initially found `qwen3.5:35b-a3b` crashed 32GB nodes on multi-step tasks** (the fleet's `OLLAMA_KEEP_ALIVE=0` reloaded the 23 GB model every turn -> OOM). **Fixed by giving the agent-exec subprocess its own `OLLAMA_KEEP_ALIVE` (default 10m)** via the bridge `env` option -> the 35B loads once and stays resident across the loop (no reload churn). Verified: multi-step hard task (read `/etc/os-release` + `bash uptime -p` + synthesize) completed with a real answer on fnet4 + fnet3 (~135-143s, nodes stayed up); 16GB nodes (fnet1/2/7) explicitly fail agent-exec tasks (clear message, no silent 4B downgrade). This **unlocks hard agentic tasks on the fleet** (the operator previously avoided them due to the no-escalation limit).

### Changed

- `ansible/deploy-a2a.yml`: fixed stale template (`bridge_type` noop→subprocess, `bridge_timeout` 120000→300000, `a2a_version` 0.4.0→0.5.5) and added the opt-in fleet bridge flags (`provider=ollama`, `model=qwen3.5:4b`, `tools=bash,read,edit`, `noExtensions=true`, `maxConcurrent=2`, `maxBufferBytes=10485760`); JSON values now use `| to_json`.

## [0.4.0] - 2026-06-23

### Added

- **PiSessionTaskHandler** (`src/pi-session-handler.ts`): Task handler using `ctx.newSession({withSession})` for isolated session-based task execution (GAP-2)
  - Adaptive polling response reader (500ms interval, 120s max) replaces fixed 2-second sleep
  - `PI_SESSION_UNAVAILABLE` signal for fallthrough to SubprocessPiTaskBridge when `ctx.newSession` is unavailable
  - `SessionHandlerOptions` for configurable `pollIntervalMs` and `maxPollMs` (test-friendly)
- **Streaming handler support**: `processTaskStreaming()` now checks registered task handlers before falling through to PiTaskBridge (was bypassing handlers entirely)
- **`ReplacedSessionContext`** type with `sendMessage()` and `sendUserMessage()` methods, including `deliverAs: "nextTurn"`
- **Fleet model profiles**: `linux-31gi` (6 local models, local-first routing) and `linux-15gi` (1 model, cloud-first routing) with `deploy-model-profiles.yml` Ansible playbook (GAP-3)
- **A2A-aware fleet playbooks**: `start-agents-a2a.yml` and `shutdown-fleet-a2a.yml` replacing coms-net playbooks (GAP-5)
- **Benchmark CLI**: `fleet-resource-manager benchmark` subcommand migrated from node-router, with `--model`, `--json`, `--all`, `--output`, `--prompt`, `--num-predict` options (22 new tests)

### Changed

- **`processTaskStreaming()`** now checks registered task handlers before falling through to `PiTaskBridge`, matching `processTask()` behavior
- **`deliverAs`** type union in `ReplacedSessionContext.sendUserMessage` expanded from `"steer" | "followUp"` to `"steer" | "followUp" | "nextTurn"`
- **playbook-executor** index updated: coms-net trigger keywords now route to A2A playbooks with backward-compatible aliases

### Removed

- **node-router archived**: `orchestrator_client.py` and `fleet_agent.py` (coms-net dispatch) archived to `04-Archive/Infrastructure/node-router/`. Scoring, routing, and benchmarking migrated to fleet-resource-manager.
- **Obsolete playbooks deleted**: `deploy-hub-to-fnet2.yml`, `deploy-fleet.yml`, `inventory/coms-net.yml`. Old `start-agents.yml` and `shutdown-fleet.yml` backed up and replaced.

### Fixed

- **GAP-1**: node-router coms-net components archived — superseded by fleet-resource-manager + A2A
- **GAP-2**: PiSessionTaskHandler implemented with adaptive polling (was blocked on `ctx.newSession` API, now available in pi v0.79.10)
- **GAP-3**: Fleet model profiles created for 32GB and 16GB nodes
- **GAP-4**: capacity_score formula for CPU-only nodes confirmed fixed in fleet-resource-manager v0.1.0
- **GAP-5**: Stale coms-net playbook references cleaned up and replaced with A2A-aware playbooks
- **Audit fix**: Polling race condition in PiSessionTaskHandler (replaced fixed 2s sleep with adaptive 500ms polling loop)
- **Audit fix**: Streaming bypass in `processTaskStreaming` (added handler check before bridge fallthrough)
- **Audit fix**: `deliverAs` type missing `"nextTurn"` in `ReplacedSessionContext`
- **Audit fix**: `405b` model suffix inconsistency in benchmark `is_large_model()` (changed from `"405b"` to `":405b"`)

### Tests

- 215 tests passing (was 206)
- 9 new PiSessionTaskHandler tests
- 22 new benchmark tests (in fleet-resource-manager)
- fleet-resource-manager: 59 tests passing (was 37)

## [0.3.0] - 2026-06-19

### Added

- **PiTaskBridge interface** (`src/pi-task-bridge.ts`): Injectable task execution backend for A2A server
- **NoOpPiTaskBridge**: Default placeholder bridge (backward compatible with original stub)
- **SubprocessPiTaskBridge**: Production bridge that invokes pi CLI via `child_process.spawn`
- **A2AServer constructor** now accepts optional 4th parameter `PiTaskBridge` for dependency injection
- **`a2a_chain` tool**: Programmatic chain execution across multiple A2A agents (registered alongside `a2a_call` and `a2a_parallel`)
- **taskAgents tracking**: `sendTask()`, `sendParallelTasks()`, and `sendChainedTasks()` now record agent URLs for `/a2a-status` lookups

### Changed

- **`/a2a-broadcast`**: Replaced `Promise.all` with `Promise.allSettled` for partial discovery failure tolerance; added null guards for `taskManager` and `agentDiscovery`; improved progress formatting with agent names
- **`/a2a-chain`**: Refactored to delegate to `taskManager.sendChainedTasks()` instead of manual for-loop; added null guard for `agentDiscovery`; progress now reports `Step X/N: AgentName — state`
- **`/a2a-status`**: Added cache lookup via `taskManager.getTaskAgent()` with fallback discovery; helpful error message when task not in cache
- **`/a2a-cancel`**: Added null guards and cache lookup for agent resolution
- **`/a2a-send`**: Added null guard for `agentDiscovery`
- **CA-3 rule updated**: `executePiTask()` is no longer a stub — it delegates to `PiTaskBridge`

### Tests

- 196 tests passing (52 new)
- New test files: `tests/unit/task-manager-tracking.test.ts`, `tests/unit/a2a-broadcast-command.test.ts`, `tests/unit/a2a-chain-command.test.ts`, `tests/unit/a2a-status-command.test.ts`, `tests/unit/a2a-chain-tool.test.ts`, `tests/unit/a2a-streaming.test.ts`, `tests/unit/pi-task-bridge.test.ts`, `tests/unit/a2a-server-bridge.test.ts`, `tests/unit/a2a-server-task-handler.test.ts`, `tests/unit/subprocess-bridge.test.ts`, `tests/integration/a2a-server-lifecycle.test.ts`
- Spec-compliance test updated: agent-card path test now checks `/.well-known/agent-card.json`
- Tools conformance test updated: expects 3 tools (added `a2a_chain`)

## [0.2.0] - 2026-06-19

### Fixed

- **S1**: JSON-RPC errors now return HTTP 200 (not 400) per JSON-RPC 2.0 convention
- **S2**: 401 responses include `WWW-Authenticate: Bearer` header per RFC 7235 §2.1
- **S3**: Added `/.well-known/agent-card.json` spec discovery path (with legacy `/.well-known/agent.json` compat)
- **S4**: Added transport binding routes `/rpc`, `/message:send`, `/message:stream` per A2A v1.0 §9.2/§11.3.1
- **S5**: Added try/catch around `JSON.parse` in `handleSendMessage` — no more HTTP 500 on malformed JSON
- **S6**: Added PascalCase method name mapping (`SendMessage`, `GetTask`, `CancelTask`) per A2A v1.0 §5.3/§9.4
- **S6b**: JSON-RPC parse errors return `id: null` (not `id: 0`) per JSON-RPC 2.0 §5.1
- Agent card URL handling: now preserves node-specific URLs from filesystem cards instead of overwriting with server bind address

### Changed

- Improved agent card discovery: filesystem-sourced cards preserve their configured URL; only `0.0.0.0` or missing URLs get overridden with hostname
- Wiki restructured per Rule 25 (recursive wiki/ convention): reference docs moved to `wiki/pi-a2a-communication/reference/`
- README.md trimmed to pointer per Rule 27 (project root clean)
- FPB/FDP compliance: added Two Locations declaration, updated refined agents, cleaned empty directories

### Removed

- Deleted duplicate `Activity Log.md` files (kept kebab-case `Activity-Log.md` only) per Rule 22
- Removed `_meta/` redirect stubs from wiki (vault is source of truth for those docs) per Rule 26
- Removed vitest build artifacts from project root (added to `.gitignore`)
- Removed empty directories: `journal/`, `costs/`, `config/`, `threads/`

### Test Suite

- 19/19 A2A v1.0 conformance tests passing
- 4 characterization test files
- 1 spec-compliance test file

## [0.2.0-alpha.1] - 2026-06-18

### Added

- A2A v1.0 conformance test suite (19 tests covering S1–S6b)
- Fork reactivated from DrOlu/pi-a2a-communication v1.0.1
- Spec compliance audit (7 gaps identified: S1–S6b)

## [0.1.0-alpha.1] - 2026-06-18

### Added

- Initial fork from DrOlu/pi-a2a-communication v1.0.1
- Project scaffold (AGENTS.md, FOCUS.md, PLAN.md, WORKBENCH.md, .frias/)
- Wiki structure with Home, guides, protocol, implementation domains
- Characterization test suite (4 files, 84 tests)
- Agent card generation script

[0.2.0]: https://github.com/carlosfrias/pi-a2a-communication/compare/v0.1.0-alpha.1...v0.2.0
[0.2.0-alpha.1]: https://github.com/carlosfrias/pi-a2a-communication/compare/v0.1.0-alpha.1...v0.2.0-alpha.1
[0.1.0-alpha.1]: https://github.com/carlosfrias/pi-a2a-communication/releases/tag/v0.1.0-alpha.1
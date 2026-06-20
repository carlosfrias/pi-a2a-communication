# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
---
name: pi-a2a-communication
phase: "Post-M10: Gap Remediation + Integration"
progress: 100
status: active
last_updated: 2026-06-20
---

# PLAN — pi-a2a-communication

## Current: M8 — Stable Release ✅

**v0.2.0 released.** All 7 spec gaps fixed, 19/19 conformance tests passing, alpha suffix dropped.

### Release History

| Version | Date | Description |
|---------|------|-------------|
| v1.0.1 (upstream) | 2026-06-18 | Deployed to all 7 fleet nodes |
| v0.1.0-alpha.1 (fork) | 2026-06-18 | Initial fork, 84 tests |
| v0.2.0-alpha.1 (fork) | 2026-06-19 | A2A v1.0 spec compliance fixes (S1–S6b), 19/19 conformance tests |
| **v0.2.0 (fork)** | **2026-06-19** | **Stable release — alpha dropped, CHANGELOG.md created** |

---

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
- [x] M7.2: Offer PR with fixes if maintainer responds

## Known Gaps

### GAP-1: node-router Targets Deprecated coms-net 🔴

`fleet_agent.py` and `orchestrator_client.py` speak coms-net HTTP/SSE protocol, removed from all nodes. Health data 3+ weeks stale. `capacity_score=0` on all CPU-only nodes.

- [ ] GAP-1.1: Replace coms-net dispatch with A2A tools (`a2a_call`, `a2a_parallel`, `a2a_chain`)
- [ ] GAP-1.2: Update `task_dispatcher.py` to use A2A protocol instead of Gist `task.dispatch` events
- [ ] GAP-1.3: Verify node-router health reporters are producing fresh data

### GAP-2: PiSessionTaskHandler Blocked 🟡

`ctx.newSession()` not available in pi v0.79.4. A2A server falls through to `NoOpPiTaskBridge`, returning placeholder responses.

- [ ] GAP-2.1: Wait for pi `newSession()` API (blocked on upstream)
- [ ] GAP-2.2: Once available, verify PiSessionTaskHandler auto-activates on fleet nodes
- [ ] GAP-2.3: Configure `SubprocessPiTaskBridge` as interim solution if needed

### GAP-3: local-model-pilot Profiles Empty 🟡

All fleet nodes have empty model routing profiles. `model_match_score` resolves to 1.0 or 0.0 instead of optimized assignment.

- [ ] GAP-3.1: Configure `local-model-pilot` on 32GB nodes (fnet3–fnet6) with `linux-31gi` profile
- [ ] GAP-3.2: Configure `local-model-pilot` on 16GB nodes (fnet1, fnet2, fnet7) with `linux-15gi` profile
- [ ] GAP-3.3: Verify model routing produces correct `model_match_score` values

### GAP-4: capacity_score Zero for CPU-Only Nodes 🟡

`score_nodes.py` uses `min(vram_ratio, ram_ratio, 1.0)` where `vram_gb=0` forces `capacity_score=0`. 32GB nodes score identically to 16GB nodes on capacity.

- [ ] GAP-4.1: Fix formula — when `vram_gb == 0 and ram_gb > 0`, use `capacity_score = min(ram_ratio, 1.0)`
- [ ] GAP-4.2: Add CPU-only node test fixtures
- [ ] GAP-4.3: Verify 32GB nodes score higher than 16GB nodes

### GAP-5: Stale Playbook-Executor References 🟢

Playbook-executor skill triggers ("standup fleet", etc.) point to archived coms-net playbooks.

- [ ] GAP-5.1: Update playbook-executor index to point to current A2A deployment playbook
- [ ] GAP-5.2: Add node-router deploy-fleet.yml to playbook index

### Fleet Availability Bottom Line

Fleet nodes **auto-start via systemd** on reboot. No single "stand up fleet" command exists anymore. The old coms-net `standup-fleet.yml` is archived.

| Scenario | Playbook | Command |
|----------|----------|--------|
| First-time node setup | pi-carlos-env-bootstrap | `scripts/bootstrap-pi.sh --profile linux-31gi` |
| A2A extension update | deploy-a2a.yml | `ansible-playbook -i ansible/inventory.ini ansible/deploy-a2a.yml` |
| Health monitor update | deploy-fleet.yml | `ansible-playbook -i ansible/inventory.ini ansible/deploy-fleet.yml` |
| Model config changes | bootstrap-pi.sh (re-run) | `scripts/bootstrap-pi.sh --profile linux-31gi` |
| Full fleet refresh | Both playbooks | Deploy A2A, then deploy node-router |

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

*Last updated: 2026-06-19*
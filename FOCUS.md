---
name: pi-a2a-communication
summary: "ACTIVE: Auto-Route feature implemented + deployed fleet-wide. v0.6.0+ with tier hints (RULE 34) eliminates ~15K tokens of topology discovery reads. EXEC-TIER gap CLOSED. Upstream PRs submitted."
status: active
phase: "Phase AUTO-ROUTE: Tier Hints for Fleet Routing — COMPLETE"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-07-05
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**Auto-Route Feature LIVE (2026-07-05).** The model no longer needs to read skill files to discover fleet topology. New `src/auto-route.ts` resolves tier hints (`auto`, `executor`, `strong`, `medium`, `weak`) to concrete fleet node URLs inside the tool itself. Resolution: fleet-resource-manager CLI → agents.json registry → fnet3 fallback (avoids fnet1 which runs Nextcloud). All 3 A2A tools (`a2a_call`, `a2a_parallel`, `a2a_chain`) updated. 18 unit tests, 197 total passing. Deployed to all 6 fleet nodes via A2A `shell-exec` from the operator machine. RULE 34 added to universal-rules.

**Phase EXEC COMPLETE (2026-07-03/04).** The executor-tier gap is CLOSED — all four tiers (A/B/C/D) deployed + verified fleet-wide. Fleet nodes execute real commands, not narration.

## Completed Work

### Phase AUTO-ROUTE + Option B — Tier Hints + OLLAMA_KEEP_ALIVE ✅

**Auto-Route:** Eliminates ~15K tokens of "check fleet resources" reads per fleet request. The model passes `agent_url="auto"` or a tier hint; the tool resolves it internally.

**Option B:** `OLLAMA_KEEP_ALIVE=10m` for the regular subprocess bridge (not just agent-exec). Eliminates ~89s per-task cold start. Added `ollamaKeepAlive` to `BridgeConfig`, mapped to `env.OLLAMA_KEEP_ALIVE` in `buildBridgeOptions`.

> **Note:** The auto-route commit (`20fe997`) was reverted by a prior session (`45b475c`). This session re-applied it on top of Option B (commit `a647557`). All 7 nodes deployed + verified.

| Step | Status |
|------|--------|
| Auto-route: `src/auto-route.ts` (312 lines, tier classification + resolution) | ✅ Commit `a647557` |
| Auto-route: Updated `a2a_call`, `a2a_parallel`, `a2a_chain` tool handlers | ✅ Commit `a647557` |
| Auto-route: 18 unit tests (all passing) | ✅ |
| Auto-route: RULE 34 added to universal-rules (v1.13.0) | ✅ |
| Option B: `ollamaKeepAlive` added to `BridgeConfig` (`types.ts`) | ✅ Commit `08bb6a7` |
| Option B: `buildBridgeOptions` maps to `env.OLLAMA_KEEP_ALIVE` | ✅ |
| Option B: 4 unit tests (TDD: RED → GREEN) | ✅ |
| Option B: All 7 nodes configured with `ollamaKeepAlive: "10m"` | ✅ |
| Fleet-wide deployment (all 7 nodes via A2A shell-exec) | ✅ Commit `a647557` |
| Verified all 7 nodes: active + auto-route.js + keepalive 10m | ✅ 2026-07-05 |
| Universal-rules mirrors synced (vault + workshop) | ✅ |

### Phase EXEC — Executor-Tier Gap Remediation ✅

All four tiers deployed + verified on all 7 fleet nodes. The executor-tier gap is **CLOSED**, including hard agentic tasks.

| Tier | Description | Status |
|------|-------------|--------|
| A | Executor-role system prompt | ✅ Deployed all 7 |
| C | Deterministic `shell-exec` short-circuit (78ms, no model) | ✅ Deployed all 7 |
| B | Narration-detection guard | ✅ Deployed all 7 |
| D | Agent-exec strong-model escalation (35b-a3b) | ✅ Deployed on 32GB; 16GB explicit-fail |

### M6–M10 — Spec Compliance, Client, Server ✅

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7.1: 6 upstream issues filed
- ✅ M7.2: Upstream PRs submitted (PR #9 + PR #10, issues #3–#8 reopened)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features (broadcast, chain, status, a2a_chain tool)
- ✅ M10: Server integration (PiTaskBridge, SubprocessPiTaskBridge, handler routing)

### Follow-ups #1–#6 ✅

- ✅ #1: deploy-a2a.yml hardened (no `-e ansible_become=false` workaround)
- ✅ #2: Tier A prompt tightened (clean raw output)
- ✅ #3: per-task `metadata.model` override for agent-exec
- ✅ #4: `ansible_memtotal_mb` assert
- ✅ #5: orchestrator restart (exposed `a2a_call` `metadata` param)
- ✅ #6: full v0.6.0 vault↔repo FOCUS/PLAN/WORKBENCH sync

### Session 2026-07-05 ✅

- ✅ **Auto-Route + Option B (2026-07-05)** — `src/auto-route.ts` (tier hints) + `ollamaKeepAlive` for regular bridge. 22 tests. Commit `a647557`. Deployed to all 7 fleet nodes. RULE 34 added.
- ✅ **Fleet-wide A2A deployment (2026-07-05)** — All 7 nodes (fnet1-7) updated + restarted via A2A from operator machine. All verified with auto-route.js + keepalive 10m.
- ✅ Git rebase conflict resolution (gemma4 crash cleanup)
- ✅ M7.2 upstream PRs (PR #9 + PR #10 submitted, issues #3–#8 reopened)
- ✅ Document `/reload` ESM limitation (RULE 29)
- ✅ Vault↔repo doc sync
- ✅ PiSessionTaskHandler dead code cleanup (GAP-2 — `createMemoryDispatchHandler` replaces `createPiSessionHandler`; dead `ctx.newSession` path removed)
- ✅ Unsolicited auto-route + docs-split commits reverted (prior session — this session re-implemented auto-route properly with operator approval)

## Fleet Status

> A2A server v0.6.0+ with auto-route + Option B on all 7 nodes. 32GB nodes also serve `agent-exec` (Tier D, qwen3.5:35b-a3b); 16GB nodes explicitly fail agent-exec. Fleet at commit `a647557`. All nodes configured with `ollamaKeepAlive: "10m"` (Option B).

| Node | RAM | Profile | Flagship Model | Routes | A2A |
|------|-----|---------|---------------|--------|-----|
| fnet1 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.6.0 ✅ |
| fnet2 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.6.0 ✅ |
| fnet3 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet4 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet5 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet6 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet7 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.6.0 ✅ |

| Scenario | Playbook |
|----------|----------|
| First-time setup | `bootstrap-pi.sh --profile linux-31gi` |
| A2A update | `deploy-a2a.yml` |
| Model config changes | `deploy-model-profiles.yml` |

## Known Gaps (all closed or accepted)

| ID | Severity | Gap | Status |
|----|----------|-----|--------|
| EXEC-TIER | 🔴 High | Executor-role tier — fleet nodes echo command plans | ✅ **CLOSED** (Phase EXEC) |
| AUTO-ROUTE | 🟡 Medium | Model reads ~15K tokens of skill files to discover fleet topology per request | ✅ **CLOSED** (Phase AUTO-ROUTE, RULE 34) |
| OPTION-B | 🟡 Medium | ~89s per-task cold start from `OLLAMA_KEEP_ALIVE=0` on regular bridge | ✅ **CLOSED** (Option B, `ollamaKeepAlive: "10m"`) |
| GAP-1 | 🔴 High | node-router archived | ✅ |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler NON-FUNCTIONAL | ✅ Cleaned up (dead `ctx.newSession` path removed; memory-dispatch handler preserved) |
| GAP-3 | 🟡 Medium | Fleet model profiles | ✅ |
| GAP-3.5 | 🟡 Medium | 35b-a3b flagship upgrade | ✅ |
| GAP-4 | 🟡 Medium | capacity_score fix | ✅ |
| GAP-5 | 🟢 Low | Stale playbook references | ✅ |
| GAP-6 | 🟢 Low | pi `/reload` ESM limitation | ✅ Accepted (RULE 29) |

## Low-Priority Follow-ups (not blocking)

- Option B: command-context task execution — `OLLAMA_KEEP_ALIVE=10m` already mitigates cold start for agent-exec; broader optimization remains for later
- Upstream PR merge — waiting on DrOlu to review/merge PR #9 + PR #10

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../Efforts/Sleeping/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../Efforts/Sleeping/pi-cross-node-comms/FOCUS.md) |
| node-router | ✅ Archived | `04-Archive/Infrastructure/node-router/` |
| health-monitor | ⚠️ Stale | [health-monitor](../../health-monitor/) |
| fleet-resource-manager | ✅ Active | [fleet-resource-manager](../../fleet-resource-manager/) |

---

*Last updated: 2026-07-05 (auto-route + fleet deployment)*
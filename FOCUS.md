---
name: pi-a2a-communication
summary: "COMPLETE: A2A v1.0 spec compliance + fleet executor-tier remediation. v0.6.0 stable on all 7 nodes. Upstream PRs submitted."
status: complete
phase: "Phase EXEC: Executor-Tier Gap Remediation — COMPLETE"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-07-05
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**PROJECT COMPLETE.** All milestones delivered, all gaps closed, fleet deployed + verified, upstream PRs submitted. Remaining items are low-priority optimizations or depend on upstream maintainer response.

## Completed Work

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

- ✅ Git rebase conflict resolution (gemma4 crash cleanup)
- ✅ M7.2 upstream PRs (PR #9 + PR #10 submitted, issues #3–#8 reopened)
- ✅ Document `/reload` ESM limitation (RULE 29)
- ✅ Vault↔repo doc sync
- ✅ PiSessionTaskHandler dead code cleanup (GAP-2 — `createMemoryDispatchHandler` replaces `createPiSessionHandler`; dead `ctx.newSession` path removed)
- ✅ Unsolicited auto-route + docs-split commits reverted

## Fleet Status

> A2A server v0.6.0 on all nodes (Phase EXEC). 32GB nodes also serve `agent-exec` (Tier D, qwen3.5:35b-a3b); 16GB nodes explicitly fail agent-exec.

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
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |
| node-router | ✅ Archived | `04-Archive/Infrastructure/node-router/` |
| health-monitor | ⚠️ Stale | [health-monitor](../../health-monitor/) |
| fleet-resource-manager | ✅ Active | [fleet-resource-manager](../../fleet-resource-manager/) |

---

*Last updated: 2026-07-05*
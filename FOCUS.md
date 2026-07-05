---
name: pi-a2a-communication
summary: "ACTIVE: Executor-Tier Gap remediation (fleet nodes echo command plans instead of executing). v0.5.5 transport stable; executor-role tier unbuilt. TDD + RULE 23 dual-model. Vault was stale at v0.4.0 — syncing for this item."
status: active
phase: "Phase EXEC: Executor-Tier Gap Remediation"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-07-05
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**ACTIVE — Executor-Tier Gap Remediation (HIGH PRIORITY, 2026-07-03, short on time).** The v0.4.1→v0.5.5 fleet A2A re-enable + hardening arc (repo tip `2619da0`, STABLE) built + hardened ONLY the TRANSPORT tier. An **unbuilt EXECUTOR-ROLE tier** causes fleet nodes to *echo command plans instead of executing*: `SubprocessPiTaskBridge` spawns `pi --print` with **no `--system-prompt`** and no executor steering, so qwen3.5:4b under pi's default generic assistant prompt *narrates* commands instead of invoking `bash`; the `--print` agent loop ends on a no-tool-call turn and returns narration verbatim. Both deterministic bypasses are dead on the fleet (`PiSessionTaskHandler` throws `PI_SESSION_UNAVAILABLE`; no `shell-exec` handler registered). **Finding:** [wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md](./wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md). **APPROACH:** TDD (RULE 2 / CA-5) + RULE 23 dual-model (deepseek VALIDATE + kimi AUDIT). **Resolution tiers:** A executor-role system prompt (do first) → C deterministic `shell-exec` short-circuit (next) → B narration-detection guard → D model-escalation (only if hard tasks still misbehave after A–C).

> ⚠ **Vault was stale at v0.4.0 (2026-06-24) while the repo reached v0.5.5 (2026-07-02).** This FOCUS/PLAN update syncs **only the executor-tier-gap item** per operator directive. A full v0.5.5 vault sync (the v0.4.1→v0.5.5 transport-hardening arc, GAP-2 PiSessionTaskHandler NON-FUNCTIONAL re-note, accepted limitations) is a **follow-up** — see Handoff Notes. Repo-side FOCUS/PLAN/WORKBENCH are ahead; vault is doc-authoritative per RULE 26 but currently behind.

## Active Work — Executor-Tier Gap Remediation

**Phase:** `Phase EXEC: Executor-Tier Gap Remediation` (matches PLAN.md). **Progress:** 100% — ALL FOUR TIERS (A + B + C + D) deployed + verified fleet-wide. Tier D (hard agentic escalation) UNBLOCKED: the agent-exec subprocess sets `OLLAMA_KEEP_ALIVE=10m` so the 35B loads once + stays resident across a multi-step loop (fixes the reload-churn OOM that crashed fnet4 at KEEP_ALIVE=0). Multi-step hard task verified on fnet4 + fnet3 (real answers, nodes stayed up); 16GB explicit-fail. **The executor-tier gap is CLOSED — including hard agentic tasks.**

| Step | Status |
|------|--------|
| Finding documented + dual-cause assessed (unbuilt executor tier, not a regression) | ✅ 2026-07-03 |
| Operator approved converting finding → PLAN/FOCUS for implementation | ✅ 2026-07-03 |
| PLAN/FOCUS written in vault (this update) | ✅ 2026-07-03 |
| Tier A — executor-role system prompt (TDD + dual-model) | ✅ DEPLOYED all 7 + verified (real stdout 391 on every node) |
| Tier C — deterministic `shell-exec` short-circuit handler | ✅ DEPLOYED all 7 + verified (391, 78ms, no model) |
| Tier B — narration-detection guard | ✅ DEPLOYED all 7 + verified (config on; regression passes; recovers narration) |
| Tier D — agent-exec strong-model escalation | ✅ DEPLOYED + verified on 32GB (OLLAMA_KEEP_ALIVE mitigation); 16GB explicit-fail |
| Deploy + verify on fnet3, then all 7 nodes (RULE 28 playbook + RULE 29 restart) | ✅ all 7 verified (~17:10 UTC) |
| CHANGELOG + version bump + vault/repo doc sync | [ ] in progress |

**Source of truth for steps:** [PLAN.md § Phase EXEC](./PLAN.md).

## Historical context (pre-Phase-EXEC)

> **Session 2026-07-02 closed.** Journal: `.frias/journal/2026-07-02-0708.md`. That session also handled non-a2a items (Chroma Explorer, agenticos consolidation, Trading retirement, carlos-trading-desk alignment, whisper-cpp cleanup, `td frame persist-*` CLI) — noted in the journal; they belong to other project contexts. Coordinated with the concurrent `subagent-chat-019f1eed` session (separate git repos; serialized fleet ansible).

**Workshop submodule structure cleaned up (2026-07-01, phase 2):** pi-a2a-communication was an ORPHAN gitlink (mode 160000, no `.gitmodules`) — the recurring gitlink-bump was cosmetic busywork (no functional consumer; `git submodule status` aborted). Now a PROPER submodule. 6 orphans → proper submodules, 3 stale `.gitmodules` removed; open-notebook consolidated into one repo + relocated 03-Resources→01-Projects (vault alignment, RULE 20); node-router vault docs archived (RULE 26). `git submodule status` works (28 submodules). RULE 29 merged to universal-rules. **v0.5.0 release tag was DEFERRED** until 6614045 (agent-memory dispatch) deployed+verified on fnet3.

**v0.4.1→v0.5.5 transport-hardening arc (2026-07-02):** re-enabled fleet A2A execution (subprocess bridge) + hardened the transport tier (opt-in flags fixing the non-fleet regression, concurrency cap, byte-accurate maxBuffer, StringDecoder, single timeout timer + `procExited` guard, external `AbortSignal` cancellation, `a2a_call` streaming=false/300s, fail-fast retry-on-abort). Root cause of the original 'echo back': noop bridge + extension stdout interference + model-router cloud-via-a2a cross-node loop + 120s timeout. Dual-model review (RULE 23, 4 rounds) converged. Tip `2619da0`. This arc made transport reliable; **Phase EXEC (2026-07-03/04) then built the missing executor-role tier on top of it.**

## What's Done

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7.1: 6 upstream issues filed (#3–#8)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features — broadcast, chain, status, a2a_chain tool
- ✅ M10: Server integration — PiTaskBridge, SubprocessPiTaskBridge, session handler
- ✅ GAP-1: node-router archived, migrated to fleet-resource-manager
- ⚠️ GAP-2: PiSessionTaskHandler — **re-note (vault was stale):** implemented but NON-FUNCTIONAL on the fleet. `ctx.newSession` is only on `ExtensionCommandContext`, not the a2a-server `ExtensionContext`, so the handler always throws `PI_SESSION_UNAVAILABLE` → always falls back to `SubprocessPiTaskBridge`. Harmless (falls back) but is one of the two dead deterministic bypasses the executor-tier gap depends on. Cleanup candidate.
- ✅ GAP-3: Fleet model profiles created and deployed
- ✅ GAP-3.5: qwen3.5:35b-a3b deployed as flagship on 32GB nodes
- ✅ GAP-4: capacity_score fix confirmed in fleet-resource-manager v0.1.0
- ✅ GAP-5: A2A playbooks, coms-net references cleaned
- ✅ Fleet routing verified: 23 local + 10 cloud-via-A2A on 32GB, 6 + 18 on 16GB
- ✅ pi-model-router removed from fleet (was overwriting Ansible config)
- ✅ **v0.5.5 STABLE (2026-07-02, repo tip `2619da0`)** — fleet A2A re-enable + transport hardening arc complete (all 7 nodes execute dispatched tasks locally via subprocess bridge, opt-in flags, qwen3.5:4b, 300s, AbortSignal). Dual-model review converged (deepseek PASS, kimi no HIGH/MED). *Vault not yet synced for this arc — follow-up.*
- ✅ **Executor-Tier Gap finding → remediation plan (2026-07-03)** — promoted to Phase EXEC; [executor-tier-gap-remediation.md](./wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md); semantic memory doc `8a39490e32615912`.

## Awaiting User Decision

- [x] **M7.2: Upstream PR** — Option C (submit + maintain fork). PR 1 (S2+S3+S5) + PR 2 (S1+S4+S6+S6b) submitted to DrOlu/pi-a2a-communication via GitHub comparison URLs. Repo is not a fork of upstream so cross-fork API PR creation not available. Issues #3–#8 closed.
- [~] minicpm-o2.6:8b: Kept as fallback on 32GB nodes (5.5GB each, superseded by 35b-a3b)

### Handoff Notes

- **Executor-Tier Gap (ACTIVE, high priority):** Next agent implements **Tier A** (executor-role system prompt) per [PLAN.md § Phase EXEC](./PLAN.md) using TDD + RULE 23 dual-model (deepseek VALIDATE + kimi AUDIT). Add `systemPrompt`/`appendSystemPrompt` to `SubprocessBridgeOptions` (`src/pi-task-bridge.ts`), push `--system-prompt`/`--append-system-prompt` in `runSubprocess`, ship a default fleet-executor prompt, wire via per-node `config.json` (`BridgeConfig` in `src/types.ts`). Then Tier C (`shell-exec` deterministic handler + AbortSignal), then B, then D only if needed. Deploy via `deploy-a2a.yml` (RULE 28); verify on fnet3 first, then all 7. **RULE 29:** restart pi on each node after rebuilding `dist/`.
- **Vault sync follow-up (RULE 26 divergence):** Vault FOCUS/PLAN were stale at v0.4.0; this update synced **only the executor-tier-gap item**. The v0.4.1→v0.5.5 transport-hardening arc, GAP-2 NON-FUNCTIONAL re-note, accepted limitations, and Fleet Status table (still shows v0.4.0) need a full sync from the repo-side docs. Repo (`~/.pi/agent/git/github.com/carlosfrias/pi-a2a-communication/{FOCUS,PLAN,WORKBENCH}.md`) is ahead and code-authoritative; vault is doc-authoritative — resolve substance conflicts in favor of vault once synced.
- PR bundle in `wiki/reference/upstream-pr/` with 7 folders (S1-S6b). Each has README.md (technical analysis) and PR-body.md (copy-paste for GitHub). Index at `upstream-pr/README.md`.
- Two-PR strategy recommended: PR 1 (S2,S3,S5) + PR 2 (S1,S4,S6,S6b). Zero overlap with existing PRs on S1,S4,S5,S6,S6b.
- Issues #3-#8 closed. Do NOT re-open unless PR is submitted.
- Wiki cleaned: 5 stale files archived, Home.md and architecture report updated to v0.4.0.
- Never file issues or PRs against external repos without explicit authorization. Never include internal identifiers in public-facing content.

## Fleet Status

> A2A server v0.6.0 on all nodes (Phase EXEC). 32GB nodes (fnet3-6) also serve `agent-exec` (Tier D, qwen3.5:35b-a3b) for hard agentic tasks; 16GB nodes explicitly fail agent-exec.

| Node | RAM | Profile | Flagship Model | Routes | A2A |
|------|-----|---------|---------------|--------|-----|
| fnet1 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.6.0 ✅ |
| fnet2 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.6.0 ✅ |
| fnet3 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet4 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet5 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet6 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.6.0 ✅ |
| fnet7 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.6.0 ✅ |

**Routing managed by Ansible** — pi-model-router removed from fleet. `deploy-model-profiles.yml` handles deployment.

| Scenario | Playbook |
|----------|----------|
| First-time setup | `bootstrap-pi.sh --profile linux-31gi` |
| A2A update | `deploy-a2a.yml` |
| Model config changes | `deploy-model-profiles.yml` |

## Known Gaps

| ID | Severity | Gap | Status |
|----|----------|-----|--------|
| **EXEC-TIER** | 🔴 **High** | **Executor-role tier unbuilt — fleet nodes echo command plans instead of executing** (qwen3.5:4b narrates under generic prompt; no `--system-prompt`; both deterministic bypasses dead). Finding: [executor-tier-gap-remediation.md](./wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md) | 🟡 **ACTIVE — Phase EXEC** |
| GAP-1 | 🔴 High | node-router archived | ✅ |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler NON-FUNCTIONAL on fleet (throws `PI_SESSION_UNAVAILABLE` → bridge fallback) | ⚠ re-noted (cleanup candidate) |
| GAP-3 | 🟡 Medium | Fleet model profiles | ✅ |
| GAP-3.5 | 🟡 Medium | 35b-a3b flagship upgrade | ✅ |
| GAP-4 | 🟡 Medium | capacity_score fix | ✅ |
| GAP-5 | 🟢 Low | Stale playbook references | ✅ |

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
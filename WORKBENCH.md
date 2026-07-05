---
workbench: true
updated: 2026-07-05
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here. **Ready for new input.**

## ✅ Recently done (promoted to PLAN/FOCUS)

- **Phase EXEC complete (v0.6.0, 2026-07-03/04)** — the executor-tier gap is closed. Tiers A (executor-role system prompt) + B (narration guard) + C (deterministic `shell-exec` short-circuit, 78ms no-model) + D (agent-exec strong-model escalation, `OLLAMA_KEEP_ALIVE=10m` unblock) all deployed + verified on all 7 fleet nodes. See [PLAN.md § Phase EXEC](./PLAN.md) + [FOCUS.md](./FOCUS.md). Repo tip `6780b6f`.
- **Follow-ups #1–#5 done (2026-07-04)** — deploy-playbook hardened (no `-e ansible_become=false` workaround), Tier A prompt tightened (clean raw output), per-task `metadata.model` override, `ansible_memtotal_mb` assert, orchestrator restart (exposed the `a2a_call` `metadata` param). See [PLAN.md § Follow-ups](./PLAN.md).
- **Earlier** (M6–M10, GAP-1–5, A2A-to-fnet execution, v0.5.5 hardening arc): see [PLAN.md](./PLAN.md) history + the git log.

## ✅ Recently done (this session)

- **M7.2: Upstream PRs submitted (2026-07-05)** — Option C (submit + maintain fork). Two PRs created on branches off `upstream/main` with clean patches applied to the upstream's flat file structure:
  - **PR 1** (`fix/spec-auth-discovery-crash`): S2 (WWW-Authenticate header) + S3 (agent-card.json discovery path) + S5 (parse error crash fix). Closes #3, #4, #6.
  - **PR 2** (`fix/spec-protocol-compliance`): S1 (JSON-RPC error HTTP 200) + S4 (transport binding routes) + S6 (PascalCase method mapping) + S6b (null id in errors). Builds on PR 1. Closes #5, #7, #8.
  - PRs submitted via GitHub comparison URLs (repo not a fork of upstream, so cross-fork API PR creation doesn't work). Browser opened for manual submission.
- **#6 vault↔repo sync** — completed in prior session (commits `418c734` + `31286df`).
- **Git rebase conflict resolution** — completed the gemma4:12b-mlx crashed session's remaining work (conflict in `.frias/costs/AI-MODEL-COSTS.md` during FDP relocation rebase). Pushed as `5dda549`.

## 📋 Emergent

- *(none — workbench is clean)*

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-07-05*
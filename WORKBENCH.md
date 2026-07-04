---
workbench: true
updated: 2026-07-04
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here. **Ready for new input.**

## ✅ Recently done (promoted to PLAN/FOCUS)

- **Phase EXEC complete (v0.6.0, 2026-07-03/04)** — the executor-tier gap is closed. Tiers A (executor-role system prompt) + B (narration guard) + C (deterministic `shell-exec` short-circuit, 78ms no-model) + D (agent-exec strong-model escalation, `OLLAMA_KEEP_ALIVE=10m` unblock) all deployed + verified on all 7 fleet nodes. See [PLAN.md § Phase EXEC](./PLAN.md) + [FOCUS.md](./FOCUS.md). Repo tip `6780b6f`.
- **Follow-ups #1–#5 done (2026-07-04)** — deploy-playbook hardened (no `-e ansible_become=false` workaround), Tier A prompt tightened (clean raw output), per-task `metadata.model` override, `ansible_memtotal_mb` assert, orchestrator restart (exposed the `a2a_call` `metadata` param). See [PLAN.md § Follow-ups](./PLAN.md).
- **Earlier** (M6–M10, GAP-1–5, A2A-to-fnet execution, v0.5.5 hardening arc): see [PLAN.md](./PLAN.md) history + the git log.

## 📋 Emergent

- ⏳ **M7.2: Upstream PR decision** — assessment at `wiki/pi-a2a-communication/reference/M7.2-upstream-pr-assessment.md`; unauthorized issues #3–#8 closed. Upstream has 2 existing PRs (see PLAN for overlap). **Decision needed.**
- ⏳ **#6 — full v0.6.0 vault↔repo FOCUS/PLAN sync** — vault is doc-authoritative + current for Phase EXEC + follow-ups; the repo-side FOCUS/PLAN still reflect v0.5.5 and need Phase EXEC + the follow-ups merged in (the repo retains some historical sections the vault lacks, so it's a merge, not a copy).

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-07-04*
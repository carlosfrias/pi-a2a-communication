---
workbench: true
updated: 2026-06-26
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-26: **Ansible deploy playbook fix** — `git stash` chdir crash on first deploy fixed (wrapped in conditional block, skips when repo missing). Agent card version update now uses `ansible.builtin.find` + loop (no glob fail on empty dir). `wait_for` host fixed from `0.0.0.0` to `127.0.0.1`. Agents directory creation added before sed. Syntax check + dry-run pass.
- 📅 2026-06-24: **Wiki cleanup** — archived 5 stale guides/references (expertise curriculum, nodejs SDK, learning guide, decomissioned skills migration, spec compliance summary). Updated Home.md and architecture report to v0.4.0.
- 📅 2026-06-24: **Unauthorized issues closed** — 6 issues (#3–#8) filed without authorization against DrOlu/pi-a2a-communication have been closed
- 📅 2026-06-23: **GAP-3.5 COMPLETE** — qwen3.5:35b-a3b deployed as flagship on 32GB nodes
- 📅 2026-06-23: **pi-model-router removed from fleet nodes** — routing now managed exclusively via Ansible
- 📅 2026-06-23: **v0.4.0 deployed to all 7 nodes** — A2A responding on all nodes

## 📋 Emergent

- ⏳ **M7.2: Upstream PR decision** — Assessment at `wiki/pi-a2a-communication/reference/M7.2-upstream-pr-assessment.md`. Upstream has 2 existing PRs (see PLAN for overlap analysis). Unauthorized issues closed. **Decision needed.**

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-26*
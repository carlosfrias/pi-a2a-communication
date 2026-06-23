---
workbench: true
updated: 2026-06-23
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-23: **v0.4.0 deployed to all 7 fleet nodes** — git pull + build + restart, A2A responding on all nodes
- 📅 2026-06-23: **Model profiles deployed to all 7 nodes** — linux-31gi (fnet3-6), linux-15gi (fnet1,2,7), all 6 models pulled on 32GB nodes
- 📅 2026-06-23: **deploy-a2a.yml playbook updated** — uses `pi update` + proper nvm sourcing, version 0.4.0, build via bash shell
- 📅 2026-06-23: **v0.4.0 released** — All 5 gaps resolved, version bumped, CHANGELOG written
- 📅 2026-06-23: **GAP-1 archived** — node-router archived, scoring/routing/benchmarking migrated to fleet-resource-manager
- 📅 2026-06-23: **GAP-2 implemented** — PiSessionTaskHandler with ctx.newSession, adaptive polling, streaming handler support
- 📅 2026-06-23: **GAP-3 created & deployed** — linux-31gi + linux-15gi profiles + Ansible playbook, all nodes configured
- 📅 2026-06-23: **GAP-4 closed** — capacity_score fix confirmed in fleet-resource-manager v0.1.0
- 📅 2026-06-23: **GAP-5 cleaned** — A2A playbooks, old coms-net files removed

## 📋 Remaining items (require user decision)

- ⏳ **GAP-3.5**: Consider adding `qwen3:8b` (~5GB, ~8-12 tok/s on CPU) to linux-31gi profile for local reasoning/low and coding/medium capability — reduces A2A bridge latency for those tiers
- ⏳ **M7.2**: Offer PR to upstream (DrOlu/pi-a2a-communication) — strategic decision, upstream not responding to issues

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-23*
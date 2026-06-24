---
workbench: true
updated: 2026-06-23
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-23: **GAP-3.5 COMPLETE** — qwen3.5:35b-a3b deployed as flagship on 32GB nodes, routing updated (8 routes now use 35b-a3b including reasoning/medium+low, coding/medium, local/high+medium, vision/medium+low)
- 📅 2026-06-23: **pi-model-router removed from fleet nodes** — was overwriting Ansible-deployed model-router.json; routing now managed exclusively via Ansible
- 📅 2026-06-23: **Profile deployment verified** — 32GB: 23 local + 10 cloud-via-A2A routes; 16GB: 6 local + 18 cloud-via-A2A routes; persists across pi-agent restarts
- 📅 2026-06-23: **Benchmark: qwen3.5:35b-a3b** — 10.4 tok/s eval on CPU, 28s cold load, 9.1GB RAM, supersedes minicpm-o2.6:8b
- 📅 2026-06-23: **v0.4.0 deployed to all 7 nodes** — A2A responding on all nodes
- 📅 2026-06-23: **deploy-model-profiles.yml updated** — removes pi-model-router, updates settings.json enabledModels per tier

## 📋 Remaining (require user decision)

- ⏳ **minicpm-o2.6:8b**: Still on 32GB node disks (5.5GB each). Superseded by 35b-a3b. Keep for fallback or remove to reclaim disk?
- ⏳ **M7.2**: Offer PR to upstream (DrOlu/pi-a2a-communication) — upstream inactive 3+ months. Recommendation: narrow PR with S1-S6b spec fixes only.

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-23*
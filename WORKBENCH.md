---
workbench: true
updated: 2026-06-23
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-23: **qwen3.5:35b-a3b pulled on all 4 × 32GB nodes** — MoE flagship (10.4 tok/s CPU, tools+thinking+vision), replaces minicpm-o2.6:8b
- 📅 2026-06-23: **GAP-3.5 model profile update in progress** — linux-31gi models.json and model-router.json updated with 35b-a3b as flagship, not yet deployed to nodes
- 📅 2026-06-23: **v0.4.0 deployed to all 7 fleet nodes** — git pull + build + restart, A2A responding on all nodes
- 📅 2026-06-23: **Model profiles deployed (v1) to all 7 nodes** — linux-31gi (fnet3-6), linux-15gi (fnet1,2,7)
- 📅 2026-06-23: **v0.4.0 released** — All 5 gaps resolved, version bumped, CHANGELOG written
- 📅 2026-06-23: **Benchmark: qwen3.5:35b-a3b on fnet3** — 10.4 tok/s eval, 28s load, 9.1GB RAM, supersedes minicpm-o2.6:8b
- 📅 2026-06-23: **All 6 models pulled on 32GB nodes** — qwen3.5:4b, gemma3:4b, nomic-embed-text, whisper, orpheus, minicpm-o2.6:8b

## 📋 In progress

- 🔄 **GAP-3.5: Deploy updated linux-31gi profiles** — models.json and model-router.json updated locally with qwen3.5:35b-a3b, need to run `ansible-playbook deploy-model-profiles.yml` and restart pi-agent on fnet3-6
- 🔄 **GAP-3.5: Remove minicpm-o2.6:8b from 32GB nodes** — superseded by 35b-a3b, but still on disk. Decision: keep for fallback or remove?

## 📋 Remaining (require user decision)

- ⏳ **M7.2**: Offer PR to upstream (DrOlu/pi-a2a-communication) — upstream inactive 3+ months, 6 issues unanswered. Recommendation: narrow PR with just S1-S6b spec fixes.

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-23*
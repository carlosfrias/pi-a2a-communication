---
workbench: true
updated: 2026-06-20
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-20: **Wiki remediation** — removed stale Activity Logs, gallery docs, empty dirs; synced workshop↔vault; Rule 25/27 compliant
- 📅 2026-06-20: **Fleet hardware audit** — updated node-pool.json v2.0.0 with actual specs (CPU-only, 16-32GB RAM, no NVIDIA GPUs)
- 📅 2026-06-20: **Fleet guide updated** — replaced aspirational GPU specs with real hardware in sending-work-to-the-fleet.md
- 📅 2026-06-19: **v0.3.0 released + deployed** — PiTaskBridge, a2a_chain, fleet deployment, 206/206 tests
- 📅 2026-06-19: **FPB/FDP/Rules audit** — 27 universal rules checked, all violations fixed
- 📅 2026-06-19: **M6 COMPLETE** — All 7 spec gaps fixed, 19/19 conformance tests passing

## 📋 Next up

- [ ] Integrate node-router with A2A (currently targets coms-net, not A2A; health data stale)
- [ ] M7.2: Offer PR to upstream if maintainer responds to issues #3–#8
- [ ] Update local-model-pilot configs on fleet nodes (all profiles empty)
- [ ] Fix node-router capacity_score formula for CPU-only nodes (vram_gb=0 caps score at 0)
- [ ] Wait for pi `newSession()` API, then PiSessionTaskHandler will auto-activate

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-20*
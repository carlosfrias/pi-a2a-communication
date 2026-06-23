---
workbench: true
updated: 2026-06-23
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-06-23: **v0.4.0 released** — All 5 gaps resolved, version bumped, CHANGELOG written
- 📅 2026-06-23: **GAP-1 archived** — node-router archived to 04-Archive, scoring/routing/benchmarking migrated to fleet-resource-manager, 17 cross-references updated
- 📅 2026-06-23: **GAP-2 implemented** — PiSessionTaskHandler with ctx.newSession({withSession}), adaptive polling, streaming handler support, 9 new tests
- 📅 2026-06-23: **GAP-3 created** — linux-31gi + linux-15gi model profiles + deploy-model-profiles.yml Ansible playbook
- 📅 2026-06-23: **GAP-4 closed** — capacity_score fix confirmed in fleet-resource-manager v0.1.0
- 📅 2026-06-23: **GAP-5 cleaned** — A2A playbooks, old coms-net files removed, playbook-index updated
- 📅 2026-06-23: **Benchmark migration** — fleet_benchmark migrated to fleet-resource-manager `benchmark` subcommand (22 new tests, 59 total)
- 📅 2026-06-23: **Audit fixes** — polling race (adaptive poll), streaming bypass (handler check), deliverAs type (nextTurn), 405b suffix
- 📅 2026-06-23: **Cross-reference cleanup** — 17 stale node-router references updated across 10 files
- 📅 2026-06-20: **Architecture & executive report** — full mermaid diagrams, PiSessionTaskHandler deep dive, node-router gap analysis
- 📅 2026-06-20: **Fleet hardware audit** — updated node-pool.json v2.0.0 with actual specs
- 📅 2026-06-19: **v0.3.0 released + deployed** — PiTaskBridge, a2a_chain, fleet deployment, 206/206 tests
- 📅 2026-06-19: **M6 COMPLETE** — All 7 spec gaps fixed, 19/19 conformance tests passing

## 📋 Remaining items (require user action)

- ⏳ **GAP-3.3**: Deploy model profiles to fleet nodes — `ansible-playbook deploy-model-profiles.yml`
- ⏳ **GAP-2.2**: Verify PiSessionTaskHandler auto-activates on fleet nodes — deploy v0.4.0 first
- ⏳ **GAP-3.4**: Verify model routing produces correct `model_match_score` values — after deployment
- ⏳ **M7.2**: Offer PR to upstream (DrOlu/pi-a2a-communication) — strategic decision

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-23*
---
name: pi-a2a-communication
summary: "v0.4.0 deployed. All gaps resolved. qwen3.5:35b-a3b flagship on 32GB nodes (10.4 tok/s). pi-model-router removed from fleet. 215 tests. M7.2 PR assessment ready for review."
status: active
phase: "Post-M10: Gap Remediation Complete — v0.4.0 released"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-06-24
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**v0.4.0 deployed to fleet. All gaps resolved. qwen3.5:35b-a3b (MoE 36B/3B active) is the flagship model on 32GB nodes — 10.4 tok/s CPU, tools+thinking+vision. pi-model-router removed from fleet (Ansible manages routing). 23 local + 10 cloud-via-A2A routes on 32GB nodes. Only M7.2 (upstream PR) remains for user decision.**

## What's Done

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7.1: 6 upstream issues filed (#3–#8)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features — broadcast, chain, status, a2a_chain tool
- ✅ M10: Server integration — PiTaskBridge, SubprocessPiTaskBridge, session handler
- ✅ GAP-1: node-router archived, migrated to fleet-resource-manager
- ✅ GAP-2: PiSessionTaskHandler implemented (ctx.newSession, adaptive polling)
- ✅ GAP-3: Fleet model profiles created and deployed
- ✅ GAP-3.5: qwen3.5:35b-a3b deployed as flagship on 32GB nodes
- ✅ GAP-4: capacity_score fix confirmed in fleet-resource-manager v0.1.0
- ✅ GAP-5: A2A playbooks, coms-net references cleaned
- ✅ Fleet routing verified: 23 local + 10 cloud-via-A2A on 32GB, 6 + 18 on 16GB
- ✅ pi-model-router removed from fleet (was overwriting Ansible config)
- ✅ 215/215 tests passing

## Awaiting User Decision

- [ ] **M7.2: Upstream PR** — PR bundle at `wiki/pi-a2a-communication/reference/upstream-pr/` (7 per-issue folders with README.md + PR-body.md). Unauthorized issues #3–#8 closed. Upstream has 2 existing PRs: PR #1 (5queezer) overlaps S2+S3 partially; PR #2 (cavos-io) no overlap. Our S1, S4, S5, S6/S6b fixes are unique.
- [~] minicpm-o2.6:8b: Kept as fallback on 32GB nodes (5.5GB each, superseded by 35b-a3b)

### Handoff Notes

- PR bundle in `wiki/reference/upstream-pr/` with 7 folders (S1-S6b). Each has README.md (technical analysis) and PR-body.md (copy-paste for GitHub). Index at `upstream-pr/README.md`.
- Two-PR strategy recommended: PR 1 (S2,S3,S5) + PR 2 (S1,S4,S6,S6b). Zero overlap with existing PRs on S1,S4,S5,S6,S6b.
- Issues #3-#8 closed. Do NOT re-open unless PR is submitted.
- Wiki cleaned: 5 stale files archived, Home.md and architecture report updated to v0.4.0.
- Never file issues or PRs against external repos without explicit authorization. Never include internal identifiers in public-facing content.

## Fleet Status

| Node | RAM | Profile | Flagship Model | Routes | A2A |
|------|-----|---------|---------------|--------|-----|
| fnet1 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.4.0 ✅ |
| fnet2 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.4.0 ✅ |
| fnet3 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet4 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet5 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet6 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet7 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.4.0 ✅ |

**Routing managed by Ansible** — pi-model-router removed from fleet. `deploy-model-profiles.yml` handles deployment.

| Scenario | Playbook |
|----------|----------|
| First-time setup | `bootstrap-pi.sh --profile linux-31gi` |
| A2A update | `deploy-a2a.yml` |
| Model config changes | `deploy-model-profiles.yml` |

## Known Gaps (All Resolved)

| ID | Severity | Gap | Status |
|----|----------|-----|--------|
| GAP-1 | 🔴 High | node-router archived | ✅ |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler | ✅ |
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

*Last updated: 2026-06-24*
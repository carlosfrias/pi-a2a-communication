---
name: pi-a2a-communication
summary: "A2A-to-fnet gap CLOSED: transport+auth+real model execution proven (fnet3 returned 391). Fixed unbuilt-extension, 401 auth, dead PiSessionTaskHandler (design flaw), EADDRINUSE on subprocess spawn. TDD + dual-model audit. v0.4.0 + new fixes deployed. Follow-ups filed."
status: active
phase: "Post-v0.4.0: A2A-to-fnet execution gap closed; follow-ups filed"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-07-01
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**A2A-to-fnet gap CLOSED (2026-07-01).** The extension now builds in the pi install location (prepare script), `a2a_call` authenticates (bearer header), and fnet3 ACTUALLY EXECUTES dispatched tasks via the subprocess bridge + `PI_A2A_SKIP_SERVER` env gate (returned a real model answer `391` for `17×23`, qwen3.5:35b-a3b). The original "all gaps resolved" claim was overstated — GAP-2's `PiSessionTaskHandler` was dead code (a design flaw: `ctx.newSession` is only on `ExtensionCommandContext`, not the session_start event's `ExtensionContext`), so execution was always a NoOp placeholder until this session. fnet3 on pi 0.80.3. Follow-ups filed (not done): a2a_call output-extraction quirk, dead-handler cleanup, Option B (command-context reuse to avoid per-task cold start). M7.2 upstream PR still awaits user decision. **⚠ pi `/reload` does NOT re-evaluate extension ESM modules — a full process restart is required to load a rebuilt `dist/`.**

## What's Done

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7.1: 6 upstream issues filed (#3–#8)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features — broadcast, chain, status, a2a_chain tool
- ✅ M10: Server integration — PiTaskBridge, SubprocessPiTaskBridge, session handler
- ✅ GAP-1: node-router archived, migrated to fleet-resource-manager
- ⚠️ GAP-2: PiSessionTaskHandler implemented but **NON-FUNCTIONAL** — it checks `ctx.newSession` from the session_start event handler, where `ctx` is `ExtensionContext` (no `newSession`; that's only on `ExtensionCommandContext`). Always throws `PI_SESSION_UNAVAILABLE` → always falls back to the bridge. Filed for cleanup.
- ✅ A2A-TO-FNET EXECUTION (2026-07-01): extension now builds (prepare script), `a2a_call` authenticates (bearer header), fnet3 executes real tasks (subprocess bridge + `PI_A2A_SKIP_SERVER` env gate + stdio/SIGKILL fix). TDD + dual-model audit. Spine proven end-to-end (fnet3 returned `391`). Commits: 9a7fcf0, 6a39222, e2c7e6b, 00277a7, f0db9fe, 2c4db15.
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
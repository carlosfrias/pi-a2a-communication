---
name: pi-a2a-communication
summary: "v0.5.5 STABLE — fleet A2A re-enable + comprehensive hardening arc complete. All 7 nodes execute dispatched tasks locally (subprocess bridge, opt-in flags, qwen3.5:4b). Non-fleet regression fixed (opt-in). Dual-model review converged (deepseek PASS, kimi no HIGH/MED). Resolves the a2a_call echo + dead-handler follow-ups."
status: active
phase: "v0.5.5 stable — fleet re-enable + hardening arc complete"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-07-02
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**v0.5.5 STABLE (2026-07-02).** Fleet A2A re-enable + hardening arc complete: all 7 nodes execute dispatched A2A tasks locally via the `SubprocessPiTaskBridge` (opt-in flags `--no-extensions --provider ollama --model qwen3.5:4b --tools bash`, 300s, `PI_A2A_SKIP_SERVER`). Root cause of the original 'echo back' was 4 layered issues (noop bridge, extension stdout interference, model-router cloud-via-a2a cross-node loop, 120s timeout) — all fixed across v0.4.1→v0.5.5. The non-fleet regression (v0.5.0 had hardcoded fleet defaults) was fixed by making all execution-shaping flags OPT-IN (non-fleet users get original `pi --print --no-session <msg>`; fleet sets them via per-node `config.json`). Hardening: concurrency cap, byte-accurate maxBuffer, `StringDecoder`, single timeout timer + `procExited` guard, external `AbortSignal` cancellation (bridge + a2a-server threads it, aborts on client disconnect), `a2a_call` streaming=false/300s/`isError`, fail-fast retry-on-abort. Dual-model review (RULE 23, 4 rounds) CONVERGED: deepseek PASS, kimi no HIGH/MED. **Resolves the 'a2a_call output-extraction quirk' + 'dead PiSessionTaskHandler' Emergent follow-ups.** Tip of main = `2619da0`. Accepted limitations (intentional): `--no-extensions` drops extension tools in the subprocess; no cloud/hard-task escalation (all → local qwen3.5:4b); 300s ceiling; checkpoint resume replays from scratch; custom task handlers don't receive the signal. **⚠ pi `/reload` does NOT re-evaluate extension ESM modules — a full process restart is required to load a rebuilt `dist/`.**

> **Session 2026-07-02 closed.** Journal: `.frias/journal/2026-07-02-0708.md`. This session also handled non-a2a items (Chroma Explorer, agenticos consolidation, Trading retirement, carlos-trading-desk alignment, whisper-cpp cleanup, `td frame persist-*` CLI) — noted in the journal; they belong to other project contexts. Coordinated with the concurrent `subagent-chat-019f1eed` session (separate git repos; serialized fleet ansible).

**Workshop submodule structure cleaned up (2026-07-01, phase 2):** pi-a2a-communication was an ORPHAN gitlink (mode 160000, no .gitmodules) — the recurring gitlink-bump was cosmetic busywork (no functional consumer; `git submodule status` aborted). Now a PROPER submodule. 6 orphans → proper submodules, 3 stale `.gitmodules` removed; open-notebook consolidated into one repo + relocated 03-Resources→01-Projects (vault alignment, RULE 20); node-router vault docs archived (RULE 26). `git submodule status` works (28 submodules). RULE 29 merged to universal-rules. **v0.5.0 release tag DEFERRED** until 6614045 (agent-memory dispatch) is deployed+verified on fnet3. **⚠ Re-establish lockstep with the active subagent-chat-019f1eed session before further superproject edits — it swept my staged git mv into commit 084e0df (mixed-concern collision).**

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
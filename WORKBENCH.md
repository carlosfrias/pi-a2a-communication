---
workbench: true
updated: 2026-07-01
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-07-02: **FLEET A2A RE-ENABLE + HARDENING ARC COMPLETE (v0.4.1→v0.5.5, stable)** — all 7 nodes execute dispatched A2A tasks locally. Root cause of the original 'echo back': noop bridge + extension stdout interference + model-router cloud-via-a2a cross-node loop + 120s timeout. Fixes: opt-in flags (non-fleet regression fix) + concurrency cap + byte-accurate maxBuffer + StringDecoder + single timeout timer w/ procExited guard + external AbortSignal cancellation (bridge + a2a-server threads it, aborts on client disconnect) + a2a_call streaming=false/300s/isError + fail-fast retry-on-abort + all A2A path timeouts 300s. Dual-model review (RULE 23) converged: deepseek PASS, kimi no HIGH/MED. Tip of main `2619da0`. Resolves the 'a2a_call output-extraction quirk' + 'dead PiSessionTaskHandler' Emergent follow-ups. Commits e7543e5→4928ff6→c73693d→af27187→bb924fe→988077b→2619da0.
- 📅 2026-07-01 (phase 2): **WORKSHOP SUBMODULE STRUCTURE CLEANED UP** — pi-a2a-communication was an orphan gitlink (no .gitmodules); the recurring gitlink-bump was cosmetic. 6 orphans → proper submodules, 3 stale .gitmodules removed; `git submodule status` works (28). 3 carlosfrias repos' unpushed commits pushed. 2 third-party overlays preserved via PRIVATE forks (BibleGateway-to-Obsidian, open-notebook). open-notebook consolidated + relocated 03-Resources→01-Projects (RULE 20). node-router vault docs archived (RULE 26). RULE 29 merged to universal-rules. Dual-model audited (deepseek + kimi, ×2). Commits: workshop 6685b27/084e0df/670e27d, vault 4a05783a, universal-rules 80fce24.
- 📅 2026-07-01: **A2A-TO-FNET EXECUTION GAP CLOSED** — fnet3 now executes real A2A tasks (returned `391` for 17×23, qwen3.5:35b-a3b). Fixed 4 layered root causes: unbuilt extension in pi install location (prepare script + ambient sqlite decls), 401 auth (bearer header in `fetchAgentCard`), dead `PiSessionTaskHandler` (design flaw — `ctx.newSession` only on command context), EADDRINUSE on subprocess spawn (`PI_A2A_SKIP_SERVER` env gate + `stdio:['ignore','pipe','pipe']` + SIGTERM→SIGKILL). TDD (5 new tests; 111/111 unit + 39/39 conformance); dual-model audit (deepseek-v4-pro validate + kimi-k2.7 audit). Commits 9a7fcf0, 6a39222, e2c7e6b, 00277a7, f0db9fe, 2c4db15. fnet3 pi 0.79.4→0.80.3 (`upgrade-pi.yml` playbook, RULE 28).
- 📅 2026-06-26: **Ansible deploy playbook fix** — `git stash` chdir crash on first deploy fixed (wrapped in conditional block, skips when repo missing). Agent card version update now uses `ansible.builtin.find` + loop (no glob fail on empty dir). `wait_for` host fixed from `0.0.0.0` to `127.0.0.1`. Agents directory creation added before sed. Syntax check + dry-run pass.
- 📅 2026-06-24: **Wiki cleanup** — archived 5 stale guides/references (expertise curriculum, nodejs SDK, learning guide, decomissioned skills migration, spec compliance summary). Updated Home.md and architecture report to v0.4.0.
- 📅 2026-06-24: **Unauthorized issues closed** — 6 issues (#3–#8) filed without authorization against DrOlu/pi-a2a-communication have been closed
- 📅 2026-06-23: **GAP-3.5 COMPLETE** — qwen3.5:35b-a3b deployed as flagship on 32GB nodes
- 📅 2026-06-23: **pi-model-router removed from fleet nodes** — routing now managed exclusively via Ansible
- 📅 2026-06-23: **v0.4.0 deployed to all 7 nodes** — A2A responding on all nodes

## 📋 Emergent

- ⏳ **M7.2: Upstream PR decision** — Assessment at `wiki/pi-a2a-communication/reference/M7.2-upstream-pr-assessment.md`. Upstream has 2 existing PRs (see PLAN for overlap analysis). Unauthorized issues closed. **Decision needed.**
- ✅ **RESOLVED 2026-07-02: a2a_call output-extraction quirk** — fixed in v0.5.0+ (`streaming=false` + 300s timeout so the synchronous wait returns the completed task; extraction already preferred `artifacts[0]`). The echo was the 60s timeout cutting off before the 300s bridge finished.
- ✅ **RESOLVED 2026-07-02: dead `PiSessionTaskHandler`** — superseded: `SubprocessPiTaskBridge` now owns real execution (opt-in flags + cancellation), and `a2a-server` threads the signal through `executePiTask`/`processTask`. The dead handler is harmless (falls back to the bridge) but can be removed in a future cleanup.
- ⏳ **Follow-up: Option B — command-context task execution** — reuse the running tmux pi's loaded model instead of spawning a fresh `pi --print` per task (avoids ~89s cold start from `OLLAMA_KEEP_ALIVE=0`). Not a drop-in (no documented API to dispatch a command from an event handler). Long-term.
- ⏳ **pi limitation: `/reload` doesn't re-evaluate extension ESM modules** — a rebuilt `dist/` requires a full pi process restart to load. Worth documenting/filing upstream.
- ⏳ **Re-establish lockstep with subagent-chat-019f1eed** — it's committing agenticos-memory-pi work to the workshop/vault superprojects concurrently; it swept my staged git mv into commit 084e0df. Announce before further superproject edits.
- ⏳ **Deploy + verify 6614045 (agent-memory dispatch) on fnet3** — committed+pushed but NOT deployed/verified.
- ⏳ **pi-a2a-communication v0.5.0 release tag** — DEFERRED until 6614045 deployed+verified on fnet3 (don't tag unverified features).
- ⏳ **Document the workshop-aggregation convention** in `workshop/AGENTS.md` (per kimi audit): workshop holds working clones of standalone GitHub repos; SHA tracking lives in each repo's .gitmodules (now proper); orphan gitlinks must be proper submodules or untracked, never bumped cosmetically.

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-26*
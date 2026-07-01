---
workbench: true
updated: 2026-07-01
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> Lean desk. Promoted items go to PLAN/FOCUS. Emergent items stay here.

---

## ✅ Recently done

- 📅 2026-07-01: **A2A-TO-FNET EXECUTION GAP CLOSED** — fnet3 now executes real A2A tasks (returned `391` for 17×23, qwen3.5:35b-a3b). Fixed 4 layered root causes: unbuilt extension in pi install location (prepare script + ambient sqlite decls), 401 auth (bearer header in `fetchAgentCard`), dead `PiSessionTaskHandler` (design flaw — `ctx.newSession` only on command context), EADDRINUSE on subprocess spawn (`PI_A2A_SKIP_SERVER` env gate + `stdio:['ignore','pipe','pipe']` + SIGTERM→SIGKILL). TDD (5 new tests; 111/111 unit + 39/39 conformance); dual-model audit (deepseek-v4-pro validate + kimi-k2.7 audit). Commits 9a7fcf0, 6a39222, e2c7e6b, 00277a7, f0db9fe, 2c4db15. fnet3 pi 0.79.4→0.80.3 (`upgrade-pi.yml` playbook, RULE 28).
- 📅 2026-06-26: **Ansible deploy playbook fix** — `git stash` chdir crash on first deploy fixed (wrapped in conditional block, skips when repo missing). Agent card version update now uses `ansible.builtin.find` + loop (no glob fail on empty dir). `wait_for` host fixed from `0.0.0.0` to `127.0.0.1`. Agents directory creation added before sed. Syntax check + dry-run pass.
- 📅 2026-06-24: **Wiki cleanup** — archived 5 stale guides/references (expertise curriculum, nodejs SDK, learning guide, decomissioned skills migration, spec compliance summary). Updated Home.md and architecture report to v0.4.0.
- 📅 2026-06-24: **Unauthorized issues closed** — 6 issues (#3–#8) filed without authorization against DrOlu/pi-a2a-communication have been closed
- 📅 2026-06-23: **GAP-3.5 COMPLETE** — qwen3.5:35b-a3b deployed as flagship on 32GB nodes
- 📅 2026-06-23: **pi-model-router removed from fleet nodes** — routing now managed exclusively via Ansible
- 📅 2026-06-23: **v0.4.0 deployed to all 7 nodes** — A2A responding on all nodes

## 📋 Emergent

- ⏳ **M7.2: Upstream PR decision** — Assessment at `wiki/pi-a2a-communication/reference/M7.2-upstream-pr-assessment.md`. Upstream has 2 existing PRs (see PLAN for overlap analysis). Unauthorized issues closed. **Decision needed.**
- ⏳ **Follow-up: a2a_call output-extraction quirk** — the `a2a_call` tool returns `status.message.parts` (input echo) instead of `artifacts[0].parts` (the real model answer). curl proves the artifact is correct; the tool's extraction is wrong. Minor tool bug.
- ⏳ **Follow-up: dead `PiSessionTaskHandler` cleanup** — always throws `PI_SESSION_UNAVAILABLE` (design flaw: `ctx.newSession` only on `ExtensionCommandContext`, not the session_start event context). Remove it or own the bridge explicitly.
- ⏳ **Follow-up: Option B — command-context task execution** — reuse the running tmux pi's loaded model instead of spawning a fresh `pi --print` per task (avoids ~89s cold start from `OLLAMA_KEEP_ALIVE=0`). Not a drop-in (no documented API to dispatch a command from an event handler). Long-term.
- ⏳ **pi limitation: `/reload` doesn't re-evaluate extension ESM modules** — a rebuilt `dist/` requires a full pi process restart to load. Worth documenting/filing upstream.

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-26*
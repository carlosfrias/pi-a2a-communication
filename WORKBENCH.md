---
workbench: true
updated: 2026-07-10
project: pi-a2a-communication
---

# Workbench — pi-a2a-communication

> **Open issue: Fleet discovery partial failure (2026-07-10).** See FOCUS.md for full details. Needs troubleshooting session.

## 🔴 Needs Troubleshooting

- **Fleet discovery partial failure (2026-07-10):** A2A health ping timed out; only fnet1–fnet3 reachable via A2A despite all 7 nodes being powered on and SSH-reachable. FOCUS.md has full details, root cause candidates, and remediation options A–E. **Schedule a troubleshooting session** to SSH to all nodes, check A2A server status, verify agents.json, check mDNS, and implement remediation.
- **fnet3 NFS mount broken:** Stale symlink + DNS resolving `mac.fleet.local` to fnet1's IP instead of Mac's. Fixed temporarily by mounting via IP. Needs permanent fix in `fnet-network-maintenance`.
- **fnet4–fnet7 NFS status unknown:** Did not check. Needs audit.

## ✅ Session 2026-07-10 — Fleet Diagnostics

- **All 7 fleet nodes confirmed healthy via SSH + curl:** A2A servers on port 10000 responding, Ollama models loaded, agent cards served correctly on both local (192.168.0.x) and Tailscale (100.x.x.x) IPs
- **Root cause narrowed to pi A2A client tool layer:** `a2a_call` times out even with explicit URLs, but direct `curl` to the same URL succeeds. The fleet was never actually down — the tool is the problem.
- **3 stale test agents removed from `agents.json`:** `agent1`, `agent2`, `persistent-agent` with `example.com` URLs removed. Only 7 real fleet nodes remain.
- **Mac RAM pressure noted:** 96% RAM, 95% swap. May contribute to pi process instability.
- **fnet1 high load:** 6.98/7.77/8.20 load average (also runs Nextcloud).
- **fnet3 NFS fixed:** Mounted via IP (192.168.0.154) instead of DNS (`mac.fleet.local`).

## ✅ Session 2026-07-05

- **Git rebase conflict** — resolved gemma4:12b-mlx crashed session's remaining conflict (`.frias/costs/AI-MODEL-COSTS.md`). Pushed as `5dda549`.
- **M7.2 upstream PRs** — PR #9 (S2+S3+S5) + PR #10 (S1+S4+S6+S6b) submitted to DrOlu/pi-a2a-communication. Issues #3–#8 reopened. Created fork `carlosfrias/pi-a2a-communication-1` for cross-fork PR support.
- **Document `/reload` ESM limitation** (RULE 29) — commit `e0403c5`.
- **Vault↔repo FOCUS/PLAN/WORKBENCH sync** — commit `ca6a435`.
- **PiSessionTaskHandler dead code cleanup** (GAP-2) — commit `2699509`. Refactored `createPiSessionHandler` → `createMemoryDispatchHandler`; removed dead `ctx.newSession` code path. 335 tests passing.
- **Unsolicited subagent commits reverted** — auto-route feature (`20fe997`) and docs split (`3f4afa6`) reverted. 335 tests passing.
- **PLAN/FOCUS/WORKBENCH refreshed** — project status → complete, all checkboxes marked, vault synced.

## 📋 Emergent

- *(none)*

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-07-10*
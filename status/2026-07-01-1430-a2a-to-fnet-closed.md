---
status: complete
phase: "Post-v0.4.0: A2A-to-fnet execution gap closed; follow-ups filed"
date: 2026-07-01
session: journal/2026-07-01-1430.md
---

# Status Snapshot — 2026-07-01 1430 — A2A-to-fnet execution closed

## What landed
- A2A-to-fnet gap CLOSED. fnet3 executes real A2A tasks (returned `391` for `17×23`, qwen3.5:35b-a3b, ~89s).
- 4 layered root causes fixed (TDD + dual-model deepseek/kimi audit): unbuilt extension (prepare script), 401 auth (bearer header), dead `PiSessionTaskHandler` (design flaw), EADDRINUSE on subprocess spawn (env gate + stdio + SIGKILL).
- Commits: 9a7fcf0, 6a39222, e2c7e6b, 00277a7, f0db9fe, 2c4db15, ddbd614, a4fa3cc, b22b6c5 (pi-a2a-communication); 2603ac6, 0749135, 696ce77, 912794d, aa38f3e (workshop gitlinks).
- Tests: 111/111 unit + 39/39 conformance.

## Handoff
- Other session unblocked to wire fnet3 MemoryServer as an A2A skill + verify real memory-tool execution.
- Follow-ups filed (WORKBENCH emergent + PLAN): a2a_call extraction quirk; dead-handler cleanup; Option B (command-context reuse); pi `/reload` ESM limitation (universal candidate U1).

## Open
- M7.2 upstream PR — awaits user decision (unchanged).
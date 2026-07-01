---
version: 1
created: 2026-07-01
session: journal/2026-07-01-1430.md
thread: .frias/threads/a2a-to-fnet-execution/0-THREAD.md
unified_prompt: .frias/threads/a2a-to-fnet-execution/prompts/013-go-immediate-fix-file-followups.md
---

# AGENTS-REFINED v1 — pi-a2a-communication

Battle-tested rules from the 2026-07-01 a2a-to-fnet-execution session (the "parked" A2A-to-fnet gap closure).

## Rules (project-specific)

### R1 — Extension `dist/` rebuilds require a full pi process restart, not `/reload`
pi's `/reload` re-reads config/skills/keybindings but does **NOT** re-evaluate already-loaded extension ESM modules (Node `require`/ESM cache). After rebuilding an extension's `dist/`, a full pi process restart (quit + relaunch) is required to load the new code. Confirmed empirically: the auth-fixed `dist/` was on disk but `a2a_call` still 401'd after `/reload`; only a full restart loaded it. **Action:** when you rebuild `dist/` (e.g., after `npm install` triggers `prepare`), tell the user a full restart is needed — `/reload` is not enough.

### R2 — `ctx.newSession` is only on `ExtensionCommandContext`, never on event-handler `ExtensionContext`
pi docs (`extensions.md:1048/1076`): session-control methods (`newSession`, etc.) are on `ExtensionCommandContext` (command handlers) ONLY, because they "can deadlock if called from event handlers." Do NOT attempt to create sub-sessions from `session_start`/`session_end`/`before_agent_start` event handlers — `ctx.newSession` will be `undefined` there. This was GAP-2's fatal design flaw: `PiSessionTaskHandler` was created in the `session_start` event handler and always threw `PI_SESSION_UNAVAILABLE`. **Action:** task execution that needs a sub-session must be dispatched through a registered command (command context), not an event handler.

### R3 — A spawned child `pi --print` re-loads the user's extensions → guard against port/state conflicts
`SubprocessPiTaskBridge` (and any `spawn(pi, ["--print", ...])`) launches a fresh pi that loads every extension in the user's `settings.json`. If the parent extension binds a port (e.g., the A2A server on 10000), the child will try to re-bind it → EADDRINUSE → unhandled rejection → the child hangs and never prints → bridge timeout. **Action:** add an env-var gate (e.g., `PI_A2A_SKIP_SERVER`) checked in the extension's `session_start` server-start block, and set it on the spawned child's `env`. Also use `stdio: ["ignore","pipe","pipe"]` so the child never blocks on stdin EOF, and SIGTERM→SIGKILL on timeout (no zombies).

### R4 — Extension installability: ship a `prepare` script
pi installs git packages by cloning + `npm install`, but does NOT run a build step unless a `prepare` script exists. If `dist/` is gitignored (build artifact), the extension will be unbuilt in the pi install location and silently fail to load (tools never register). **Action:** every pi extension that ships TypeScript must declare `"prepare": "npm run build"` in `package.json` so `npm install` (and `pi update --extensions`) self-heals `dist/`.

## Rules (universal candidates — propose to the `universal-rules` skill)

### U1 — `/reload` does not reload extension code (applies to ANY pi extension)
See R1. Universal: any extension rebuilt mid-session needs a full process restart. (Propose to universal-rules.)

## Lockstep coordination pattern (when two pi sessions edit shared repos/nodes)

When two pi sessions on the same machine mutate the same repos and fleet nodes, adopt an explicit intercom protocol: (a) ownership boundaries (who edits which repo/dist); (b) mutate-before-announce on shared resources (fnet3 nodes, shared configs, repos the other might pull) — send an intercom `ask` and wait for ack; (c) `git fetch && git rebase` before every push; (d) serialize fleet-node mutating ops (one at a time, announced); (e) surgical `git add <path>` for submodule gitlink bumps (never `git add -A` — it sweeps in pre-existing dirty submodules). This session hit one push rejection and several stale-message crossings; the protocol prevented collisions once adopted.

## Corrected record

- FOCUS previously stated "GAP-2: PiSessionTaskHandler implemented ✅". This was misleading — it was registered but NON-FUNCTIONAL (always threw PI_SESSION_UNAVAILABLE → NoOp placeholder). Corrected in FOCUS/WORKBENCH. The A2A-to-fnet execution gap (the actual user-facing symptom) is now CLOSED via the subprocess bridge + env gate, not via the session handler.
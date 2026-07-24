---
title: "Executor-Tier Gap Remediation — fleet A2A nodes echo command plans instead of executing"
project: pi-a2a-communication
kind: architectural-finding → remediation-plan
severity: High (functional, not a regression)
status: promoted-to-plan — Phase EXEC active (2026-07-03); implementation NOT started
found: 2026-07-03
promoted: 2026-07-03
found_by: fresh-session investigation (operator prompt)
affects: v0.5.5 STABLE (tip 22cc813 / 2619da0), all 7 fleet nodes
plan: PLAN.md § Phase EXEC — Executor-Tier Gap Remediation
related: A2A-v1-Conformance-Audit.md, architecture-and-executive-report.md
memory: semantic doc 8a39490e32615912
---

# Executor-Tier Gap Remediation — Fleet A2A Nodes Echo Command Plans Instead of Executing

> **📢 Status (2026-07-03): PROMOTED TO PLAN.** Operator reviewed this finding and approved converting it into an implementation plan. It is now tracked as **`PLAN.md § Phase EXEC: Executor-Tier Gap Remediation`** (progress 5; `FOCUS.md` active phase). **Approach: TDD (RULE 2 / CA-5) + RULE 23 dual-model (deepseek VALIDATE + kimi AUDIT).** Resolution tiers: **A** executor-role system prompt (do-first) → **C** deterministic `shell-exec` short-circuit → **B** narration-detection guard → **D** model-escalation (gated). **This document is now the evidence / root-cause record; the actionable implementation steps live in PLAN.md.** Workbench item cleared.

## TL;DR

The v0.4.1→v0.5.5 arc built and hardened only the **transport tier** of the A2A
subprocess bridge. It never built the **executor-role tier**. On the fleet, every
A2A task — including trivial `echo` / `git log` / "paste stdout" tasks — is forced
through a one-shot `pi --print` round-trip of **qwen3.5:4b** running under pi's
*default generic "coding assistant" system prompt* with the task message verbatim
and **no executor steering**. The 4B model emits plan-narration ("I would run
`git clone …`") as its turn; in the `--print` agent loop a turn with text and no
tool call is treated as the final answer, so the narration is returned verbatim.
The orchestrator reads it as *"the fleet nodes echoed command plans rather than
executing them."*

This is **not a regression** (transport is solid, dual-model review converged).
It is an **unbuilt tier** — the symptom the operator saw is the structural absence
of executor steering + deterministic bypass, not a bug to chase.

## The symptom (operator report)

> "The fleet nodes echoed command plans rather than executing them — a known A2A
> reliability gap. Let me retry with an explicit 'execute and paste actual stdout'
> instruction to fnet3 before deciding whether to dispatch."

The orchestrator's manual retry — adding an explicit *"execute and paste actual
stdout"* instruction — is exactly the **executor steering** that the architecture
does not apply by default. That retry works *ad hoc*; the gap is that it must be
applied by the caller rather than by the bridge.

## Ruled-out causes

| Cause | Status | Why ruled out |
|-------|--------|---------------|
| Stale pre-v0.5.0 `a2a_call` tool in the orchestrator session | ❌ ruled out | Fresh session for the day (2026-07-03); the stale-tool echo only affects sessions that loaded the extension before the v0.5.0 deploy. |
| `bridge.type=noop` | ❌ fixed in v0.4.1 | Bridge is `SubprocessPiTaskBridge`; verified executing across 7 nodes. |
| Extension stdout interference with `pi --print` | ❌ fixed | Fleet sets `--no-extensions`; `PI_A2A_SKIP_SERVER` gates the child. |
| model-router cloud-via-a2a cross-node loop | ❌ fixed | Bridge pins `--provider ollama --model qwen3.5:4b`, bypassing the router. |
| 120s timeout | ❌ fixed | Fleet timeout = 300000ms. |
| `--no-extensions` stripping `bash` | ❌ not the cause | `--tools bash` is passed explicitly; the model *has* the tool, it just doesn't *use* it. |

## Evidence (file:line)

### 1. The bridge builds no system prompt

`src/pi-task-bridge.ts`, `SubprocessPiTaskBridge.runSubprocess`:

```ts
// line ~200
const args = ["--print", "--no-session"];
if (this.noExtensions) args.push("--no-extensions");
if (this.provider) args.push("--provider", this.provider);
if (this.model) args.push("--model", this.model);
if (this.tools) args.push("--tools", this.tools);
args.push(message);
```

No `--system-prompt` / `--append-system-prompt` is ever pushed. `SubprocessBridgeOptions`
(lines ~89-108) has fields for `timeout`, `command`, `provider`, `model`, `tools`,
`noExtensions`, `maxConcurrent`, `maxBufferBytes` — **no `systemPrompt` / `appendSystemPrompt`
field exists.** The executor therefore runs under pi's default "coding assistant"
system prompt with the task verbatim.

### 2. `pi --print` runs a full agent loop, so the executor *can* act

`pi --help`: `--print, -p  Non-interactive mode: process prompt and exit.` This is
the agentic loop (model→tool→result→model→…) run to completion, then the final
text is printed. It is **not single-shot**. The executor has the ability to invoke
`bash` and loop on its output.

### 3. The loop ends on a no-tool-call turn

In the `--print` agent loop, a generation that emits text and **no tool call** is
the final answer; the loop ends and that text is returned. A 4B model under a
generic assistant prompt, given an open-ended task, emits *plan-narration* as its
turn. Narration has no tool call → loop ends → narration returned verbatim →
"echoed command plans." The model has `bash`; it is not **steered** to use it.

### 4. Both deterministic bypasses are dead on the fleet

`src/a2a-server.ts`, `processTask` (line ~849):

```ts
const skillIds = ["a2a-task-execution", ...(task.metadata?.skills as string[] || [])];
for (const skillId of skillIds) {
  const handler = this.taskHandlers.get(skillId);
  if (handler) {
    try { ... return result; }
    catch (handlerError) {
      if (handlerError.message.startsWith("PI_SESSION_UNAVAILABLE")) {
        break; // Fall through to bridge
      }
      throw handlerError;
    }
  }
}
// ... falls through to executePiTask → piTaskBridge.executeTask
```

- **`pi-session-handler`** (the "real subagent" path via `ctx.newSession`,
  registered at `src/index.ts:121`) throws `PI_SESSION_UNAVAILABLE`
  (`pi-session-handler.ts:146/254`) because `ctx.newSession` is **not available
  in the fleet node's a2a-server `ExtensionContext`** — it only exists on
  `ExtensionCommandContext`. (This is the existing **GAP-2** in FOCUS.md, marked
  NON-FUNCTIONAL.) So the one path that could run a real multi-turn agent loop is
  dead on the fleet → always falls through to the subprocess bridge.
- **`registerTaskHandler()`** (skill-specific deterministic handlers, e.g. "run
  this shell command, return stdout, no model") is the extension point
  (`a2a-server.ts:142`), but **no handler is registered for shell execution**, and
  per the accepted limitation, **custom handlers do not receive the `AbortSignal`**.
  So there is no "execute this command and paste stdout" short-circuit.

### 5. End-to-end verification only proved transport

The verification artifact — `SendMessage → completed + real hostname/artifact`
(see FOCUS.md "A2A-TO-FNET EXECUTION") — proves the **transport** works. It does
**not** exercise the case where the executor must actually drive a multi-step tool
loop under an open-ended task. A single tool-free narration turn is indistinguishable
from a "completed" result to that verification, so the gap was never caught.

## Diagnosis

> The A2A subprocess bridge forces **every fleet task — including trivial
> command-execution tasks — through a 4B-model tool-call decision under a generic
> system prompt with no executor steering and no deterministic bypass.** The 4B
> model is below the threshold for reliable agentic tool-calling under a generic
> prompt, so it narrates instead of acts, and the narration is returned as the
> result.

The arc's scope ended at the transport boundary. The executor-role / executor-prompting
tier and the deterministic-bypass tier were never built.

## Resolution (tiered)

### A. Executor-role system prompt — DO FIRST (highest leverage, fixes the observed symptom)

Add executor steering to the bridge:

1. Add fields to `SubprocessBridgeOptions` (`src/pi-task-bridge.ts`):
   ```ts
   /** System prompt for the subprocess (optional; when set, passed via --system-prompt). */
   systemPrompt?: string;
   /** Text appended to the subprocess system prompt (optional; --append-system-prompt). */
   appendSystemPrompt?: string;
   ```
2. In `runSubprocess`, push the flags:
   ```ts
   if (this.systemPrompt) args.push("--system-prompt", this.systemPrompt);
   if (this.appendSystemPrompt) args.push("--append-system-prompt", this.appendSystemPrompt);
   ```
3. Ship a default fleet-executor prompt (configurable via per-node `config.json`):
   > *"You are a fleet execution agent. Complete the assigned task by invoking the
   > available tools (bash/read/edit). Never describe commands in prose — execute
   > them and paste the real stdout/output. A response that contains only plans or
   > described commands, without real tool output, is a failure. If a step cannot
   > be completed, report the actual error."*

This is the **structural** version of the orchestrator's manual *"execute and
paste actual stdout"* retry. Safe (opt-in): non-fleet installs keep the original
`pi --print --no-session <msg>` behaviour.

### B. Narration-detection guard — belt-and-suspenders on top of A

After `pi --print` returns, inspect the output. If the task asked for execution
and the output contains command-looking lines (`I would run`, `I'd execute`,
fenced command blocks) with no preceding real tool output, automatically re-run
with a forced *"actually execute, paste stdout"* follow-up. Cheap heuristic
safety net; not a substitute for A.

### C. Deterministic short-circuit handler — kills the class of trivial-command round-trips

Register a `"shell-exec"` task handler via the existing `registerTaskHandler()`
(`a2a-server.ts:142`). For tasks tagged `metadata.exec = "shell"` with a
`metadata.command`, run the command directly via `child_process` and return
stdout — **no model in the loop.** Wire the `AbortSignal` through to it (this
also closes the accepted limitation *"custom task handlers don't receive the
signal"*). Removes the entire class of "run this command and paste stdout"
round-trips from the 4B model's path.

### D. Model-escalation tier — only if A–C aren't enough for hard tasks

Allow the executor to escalate the **decision** to a stronger/cloud model while
keeping code/data execution local. Reverses the accepted limitation *"no
cloud/hard-task escalation (all → local qwen3.5:4b)."* Heavier; gated on whether
hard tasks still misbehave after A–C.

### Recommended order

**A immediately** (structurally fixes the symptom) → **C next** (removes trivial-command
round-trips entirely) → **B** as a guard → **D** only if hard tasks still misbehave.

## Process note

Per **RULE 23 (dual-model audit)**, any implementation of A–D must be TDD + dual-model
reviewed (deepseek VALIDATE + kimi AUDIT) before deploy, matching the v0.5.x arc's
discipline.

## Cross-references

- `src/pi-task-bridge.ts` — `SubprocessPiTaskBridge`, `SubprocessBridgeOptions`, `runSubprocess`
- `src/a2a-server.ts:142` — `registerTaskHandler`; `~849` — `processTask` fall-through logic
- `src/pi-session-handler.ts:146/254` — `PI_SESSION_UNAVAILABLE`
- `src/index.ts:121` — session handler registration
- FOCUS.md — GAP-2 (PiSessionTaskHandler NON-FUNCTIONAL), accepted limitations
- **PLAN.md § Phase EXEC — Executor-Tier Gap Remediation** (implementation steps; this doc is the evidence record)
- `wiki/pi-a2a-communication/reference/A2A-v1-Conformance-Audit.md` — prior audit
- `wiki/pi-a2a-communication/reference/architecture-and-executive-report.md` — architecture

---

*Found 2026-07-03 via fresh-session investigation after operator asked "what else
could 'fleet nodes echoed command plans rather than executing them' be?" Stored
to semantic memory doc `8a39490e32615912`. **Promoted to PLAN/FOCUS 2026-07-03**
(operator approval) — renamed `executor-tier-gap.md` → `executor-tier-gap-remediation.md`
to reflect promotion from open finding to active remediation plan (Phase EXEC).
Implementation steps live in PLAN.md; this document is the root-cause/evidence record.*
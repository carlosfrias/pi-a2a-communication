/**
 * Memory-dispatch task handler — agent-memory short-circuit for A2A tasks
 *
 * When an A2A task message is an `agent-memory:` request (or bare JSON with a
 * `memory_*` tool), this handler executes it directly against the deployed
 * Python MCP bridge via subprocess and returns the result as a task artifact.
 * This bypasses the pi-session / PiTaskBridge path so memory_* tools work
 * over A2A on fleet nodes where the bridge is noop and `ctx.newSession` is
 * unavailable.
 *
 * Non-memory tasks throw PI_SESSION_UNAVAILABLE so that A2AServer.processTask
 * falls through to the next handler or the PiTaskBridge (subprocess/noop).
 *
 * Formerly this file contained PiSessionTaskHandler, which used ctx.newSession()
 * to execute tasks inside the running pi session. That handler was always
 * non-functional on the fleet (ctx.newSession is only on ExtensionCommandContext,
 * not the session_start ExtensionContext) and always threw PI_SESSION_UNAVAILABLE,
 * falling back to SubprocessPiTaskBridge. The dead newSession code path was
 * removed in the GAP-2 cleanup (2026-07-05). The memory-dispatch logic was
 * preserved because it runs before the fallthrough and works correctly.
 */

import { execFile } from "node:child_process";
import type { A2ATask } from "./types.js";

/**
 * Options for the agent-memory dispatch short-circuit.
 *
 * When an A2A task message is an `agent-memory:` request (or bare JSON with a
 * `memory_*` tool), the handler spawns the deployed Python MCP bridge directly
 * and returns its stdout as the task artifact — bypassing the pi-session /
 * PiTaskBridge path so memory_* tools work over A2A on fleet nodes where the
 * bridge is noop and `ctx.newSession` may be unavailable.
 */
export interface MemoryDispatchOptions {
  /** Path to the agent-memory venv python (default: `/opt/agent-memory-venv/bin/python`, or `AGENTICOS_MEMORY_VENV_PYTHON`). */
  venvPython?: string;
  /** Deployed agent-memory dir containing `agenticos-memory/` + `agenticos-mcp-bridge/` (default: `/opt/agent-memory`, or `AGENTICOS_MEMORY_DIR`). */
  memoryDir?: string;
  /** Subprocess timeout in ms (default: 60000). */
  execTimeoutMs?: number;
  /** Injectable executor (for testing). Receives (python, args, env, timeoutMs) → stdout-or-error-JSON string. Never throws. */
  execFn?: (python: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs: number) => Promise<string>;
}

/**
 * Configuration options for the memory-dispatch handler.
 */
export interface MemoryDispatchHandlerOptions {
  /** agent-memory dispatch options (synchronous Python MCP bridge short-circuit). */
  memory?: MemoryDispatchOptions;
}

/**
 * Detect whether a task message is an agent-memory request, and if so parse
 * the `{tool, arguments}` op. Returns `null` for non-memory requests so the
 * handler falls through to the existing bridge flow unchanged.
 *
 * Recognized shapes:
 *   - `agent-memory: {"tool":"memory_*","arguments":{...}}`
 *   - `{"tool":"memory_*","arguments":{...}}`  (bare JSON)
 */
export function parseMemoryRequest(text: string): { tool: string; arguments: Record<string, unknown> } | null {
  const trimmed = text.trim();
  let payload = trimmed;
  const prefix = "agent-memory:";
  if (trimmed.toLowerCase().startsWith(prefix)) {
    payload = trimmed.slice(prefix.length).trim();
  }
  if (!payload.startsWith("{")) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const tool = o.tool;
  if (typeof tool !== "string" || !tool.startsWith("memory_")) return null;
  const args = (o.arguments && typeof o.arguments === "object") ? (o.arguments as Record<string, unknown>) : {};
  return { tool, arguments: args };
}

/**
 * Default executor: spawns the agent-memory venv python with a short script
 * that loads `create_bridge()` and calls `b.call(tool, arguments)`. The op is
 * passed as JSON via the `AGENTICOS_MEMORY_OP` env var (parsed by the script,
 * never string-interpolated → no code injection). **Never throws** — on any
 * subprocess error it resolves to a JSON error string so the task completes
 * gracefully with the error surfaced as an artifact.
 */
export function defaultMemoryExecFn(
  python: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve) => {
    execFile(python, args, { env, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        resolve(JSON.stringify({ status: "error", error: err.message, stderr: (stderr?.toString() ?? "").slice(0, 2000) }));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Run a memory op against the deployed Python MCP bridge. Returns the bridge
 * stdout (a JSON string) or a JSON error string. Never throws.
 */
export async function runMemoryBridge(
  op: { tool: string; arguments: Record<string, unknown> },
  opts?: MemoryDispatchOptions
): Promise<string> {
  const python = opts?.venvPython ?? process.env.AGENTICOS_MEMORY_VENV_PYTHON ?? "/opt/agent-memory-venv/bin/python";
  const memoryDir = opts?.memoryDir ?? process.env.AGENTICOS_MEMORY_DIR ?? "/opt/agent-memory";
  const timeoutMs = opts?.execTimeoutMs ?? 60_000;
  const exec = opts?.execFn ?? defaultMemoryExecFn;
  const script =
    "import sys, os, json\n" +
    "md = os.environ['AGENTICOS_MEMORY_DIR']\n" +
    "sys.path.insert(0, md + '/agenticos-memory/src')\n" +
    "sys.path.insert(0, md + '/agenticos-mcp-bridge/src')\n" +
    "from agenticos_mcp_bridge import create_bridge\n" +
    "op = json.loads(os.environ['AGENTICOS_MEMORY_OP'])\n" +
    "b = create_bridge()\n" +
    "print(json.dumps(b.call(op['tool'], op['arguments'])))\n";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AGENTICOS_MEMORY_DIR: memoryDir,
    AGENTICOS_MEMORY_OP: JSON.stringify(op),
  };
  return exec(python, ["-c", script], env, timeoutMs);
}

/** Error signal thrown when no handler can process a task; A2AServer.processTask catches this and falls through to PiTaskBridge. */
export const PI_SESSION_UNAVAILABLE = "PI_SESSION_UNAVAILABLE";

/**
 * Task handler function signature — matches A2AServer's TaskHandler type.
 */
export type TaskHandler = (task: A2ATask, onUpdate: (update: Partial<A2ATask>) => void) => Promise<A2ATask>;

/**
 * Creates a task handler that processes agent-memory requests directly
 * via the Python MCP bridge subprocess, and throws PI_SESSION_UNAVAILABLE
 * for all other tasks so A2AServer.processTask falls through to the next
 * handler or the PiTaskBridge (subprocess/noop).
 *
 * This replaces the former PiSessionTaskHandler, which always threw
 * PI_SESSION_UNAVAILABLE because ctx.newSession was unavailable on the fleet.
 * The memory-dispatch path is preserved because it works correctly (it
 * doesn't depend on ctx.newSession).
 *
 * @param _ctx The pi ExtensionContext (unused — kept for API compatibility).
 *   Formerly used for ctx.newSession, which was never available on the fleet.
 * @returns A TaskHandler function suitable for A2AServer.registerTaskHandler()
 */
export function createMemoryDispatchHandler(_ctx: any, options?: MemoryDispatchHandlerOptions): TaskHandler {
  return async (task: A2ATask, onUpdate: (update: Partial<A2ATask>) => void): Promise<A2ATask> => {
    // Extract text content from the A2A message
    const parts = task.status.message?.parts || [];
    const textContent = parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map(p => p.text)
      .join("\n") || "";

    if (!textContent) {
      task.status.state = "failed";
      task.isError = true;
      task.error = "No text content in task message";
      task.status.timestamp = new Date().toISOString();
      return task;
    }

    // agent-memory dispatch short-circuit: if the task message is an
    // `agent-memory:` request (or bare JSON with a `memory_*` tool), execute it
    // directly against the deployed Python MCP bridge via subprocess and return
    // the result. Non-memory requests fall through.
    const memOp = parseMemoryRequest(textContent);
    if (memOp) {
      let memText: string;
      try {
        memText = await runMemoryBridge(memOp, options?.memory);
      } catch (err) {
        memText = JSON.stringify({ status: "error", error: err instanceof Error ? err.message : String(err) });
      }
      task.status.state = "completed";
      task.status.timestamp = new Date().toISOString();
      if (!task.artifacts) {
        task.artifacts = [];
      }
      task.artifacts.push({
        artifactId: task.id + "-memory",
        name: "memory-result",
        parts: [{ type: "text" as const, text: memText }],
      });
      return task;
    }

    // Non-memory task — fall through to the next handler or PiTaskBridge.
    throw new Error(PI_SESSION_UNAVAILABLE);
  };
}

/**
 * @deprecated Use createMemoryDispatchHandler instead. The former
 * PiSessionTaskHandler always threw PI_SESSION_UNAVAILABLE because
 * ctx.newSession was unavailable on the fleet; the memory-dispatch path
 * has been extracted into createMemoryDispatchHandler. This alias is
 * provided for backward compatibility with existing registration code.
 */
export const createPiSessionHandler = createMemoryDispatchHandler;
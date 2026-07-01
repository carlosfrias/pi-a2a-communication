/**
 * PiSessionTaskHandler — Task handler that uses the running pi session
 *
 * When the A2A extension is loaded inside a pi session, this handler
 * executes incoming A2A tasks by sending them to the model via
 * ctx.newSession({ withSession }) — the pi v0.79.10+ API for
 * isolated session-based task execution.
 *
 * Flow:
 * 1. ctx.newSession({ withSession }) opens a new isolated session
 * 2. Inside withSession, sendUserMessage sends the A2A task text
 * 3. The model processes it and writes a response to the session JSONL
 * 4. We read the last assistant message from the JSONL as the result
 *
 * Fallback: if ctx.newSession is not available (older pi versions),
 * the handler throws PI_SESSION_UNAVAILABLE so that A2AServer.processTask
 * falls through to the PiTaskBridge (subprocess or noop).
 */

import * as fs from "node:fs/promises";
import { execFile } from "node:child_process";
import type { A2ATask } from "./types.js";

/**
 * Configuration options for PiSessionTaskHandler polling behavior.
 * Exposed for testing — production defaults are sensible.
 */
export interface SessionHandlerOptions {
  /** Milliseconds between poll attempts (default: 500) */
  pollIntervalMs?: number;
  /** Maximum milliseconds to wait for a response (default: 120000) */
  maxPollMs?: number;
  /** agent-memory dispatch options (synchronous Python MCP bridge short-circuit). */
  memory?: MemoryDispatchOptions;
}

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
 * Detect whether a task message is an agent-memory request, and if so parse
 * the `{tool, arguments}` op. Returns `null` for non-memory requests so the
 * handler falls through to the existing pi-session / bridge flow unchanged.
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

/**
 * Error signal thrown when ctx.newSession is unavailable.
 * A2AServer.processTask catches this and falls back to PiTaskBridge.
 */
export const PI_SESSION_UNAVAILABLE = "PI_SESSION_UNAVAILABLE";

/**
 * Task handler function signature — matches A2AServer's TaskHandler type.
 */
export type TaskHandler = (task: A2ATask, onUpdate: (update: Partial<A2ATask>) => void) => Promise<A2ATask>;

/**
 * Read the last assistant message from a pi session JSONL file.
 *
 * Parses the JSONL, walks entries in reverse order, and returns the
 * text content of the last assistant message (handles both string
 * content and structured content arrays).
 */
async function readLastAssistantMessage(sessionFile: string): Promise<string | null> {
  try {
    const content = await fs.readFile(sessionFile, "utf-8");
    const lines = content.trim().split("\n").filter((l: string) => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.role === "assistant" && entry.content) {
          if (typeof entry.content === "string") {
            return entry.content;
          }
          if (Array.isArray(entry.content)) {
            return entry.content
              .filter((c: unknown) => typeof c === "object" && c !== null && (c as Record<string, unknown>).type === "text")
              .map((c: Record<string, unknown>) => (c as { text: string }).text)
              .join("\n");
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Creates a task handler that processes A2A tasks using ctx.newSession().
 *
 * The handler attempts to use ctx.newSession({ withSession }) for isolated
 * task execution. If newSession is not available (older pi versions),
 * the handler throws PI_SESSION_UNAVAILABLE so that processTask falls
 * back to the PiTaskBridge.
 *
 * @param ctx The pi ExtensionContext for the running session (any-shape
 *   because older pi versions won't have newSession at all)
 * @returns A TaskHandler function suitable for A2AServer.registerTaskHandler()
 */
export function createPiSessionHandler(ctx: any, options?: SessionHandlerOptions): TaskHandler {
  const POLL_INTERVAL_MS = options?.pollIntervalMs ?? 500;
  const MAX_POLL_MS = options?.maxPollMs ?? 120_000;
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
    // the result. This bypasses the pi-session / PiTaskBridge path so memory_*
    // tools work over A2A on fleet nodes where the bridge is noop and
    // `ctx.newSession` may be unavailable. Non-memory requests fall through.
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

    // Report progress
    onUpdate({
      status: { ...task.status, state: "working" as const },
    });

    // Check if newSession is available
    if (typeof ctx?.newSession !== "function") {
      // Fall through — let processTask use the PiTaskBridge instead
      throw new Error(PI_SESSION_UNAVAILABLE);
    }

    let resultText = "";

    try {
      onUpdate({
        status: {
          ...task.status,
          state: "working" as const,
          message: {
            messageId: task.status.message?.messageId || `msg-${Date.now()}`,
            role: "agent" as const,
            parts: [{ type: "text" as const, text: "Opening pi session..." }],
          },
        },
      });

      const sessionResult = await ctx.newSession({
        parentSession: ctx.sessionManager?.getSessionFile?.(),
        withSession: async (newCtx: any) => {
          onUpdate({
            status: {
              ...task.status,
              state: "working" as const,
              message: {
                messageId: task.status.message?.messageId || `msg-${Date.now()}`,
                role: "agent" as const,
                parts: [{ type: "text" as const, text: "Sending task to pi session..." }],
              },
            },
          });

          // Send the A2A task as a user message with nextTurn delivery
          await newCtx.sendUserMessage(textContent, { deliverAs: "nextTurn" });

          onUpdate({
            status: {
              ...task.status,
              state: "working" as const,
              message: {
                messageId: task.status.message?.messageId || `msg-${Date.now()}`,
                role: "agent" as const,
                parts: [{ type: "text" as const, text: "Waiting for pi response..." }],
              },
            },
          });

          // Poll for the model's response in the session JSONL file.
          // Adaptive polling loop that exits as soon as an assistant response appears.
          const pollInterval = POLL_INTERVAL_MS;
          const maxPoll = MAX_POLL_MS;
          const startTime = Date.now();
          let polledResponse: string | null = null;

          const sessionFile = newCtx.sessionManager?.getSessionFile?.();

          while (Date.now() - startTime < maxPoll) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            if (sessionFile) {
              polledResponse = await readLastAssistantMessage(sessionFile);
              if (polledResponse) break;
            }
          }

          if (polledResponse) {
            resultText = polledResponse;
          }
        },
      });

      if (sessionResult.cancelled) {
        task.status.state = "failed";
        task.isError = true;
        task.error = "Session was cancelled";
        task.status.timestamp = new Date().toISOString();
        return task;
      }
    } catch (error) {
      // If the error is our fallback signal, re-throw it
      if (error instanceof Error && error.message === PI_SESSION_UNAVAILABLE) {
        throw error;
      }
      // For other errors, mark the task as failed
      task.status.state = "failed";
      task.isError = true;
      task.error = error instanceof Error ? error.message : String(error);
      task.status.timestamp = new Date().toISOString();
      return task;
    }

    // Use result from session, or fallback message
    if (!resultText) {
      resultText = `Task processed by pi session on ${new Date().toISOString()}. ` +
        `Message: "${textContent.substring(0, 200)}${textContent.length > 200 ? "..." : ""}"`;
    }

    task.status.state = "completed";
    task.status.timestamp = new Date().toISOString();

    if (!task.artifacts) {
      task.artifacts = [];
    }

    task.artifacts.push({
      artifactId: task.id + "-result",
      name: "result",
      parts: [{ type: "text" as const, text: resultText }],
    });

    return task;
  };
}
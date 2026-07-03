/**
 * agent-exec handler — Phase EXEC Tier D (strong-model escalation, explicit tag).
 *
 * A task tagged `metadata.exec="agent"` + `metadata.skills=["agent-exec"]` is
 * routed to this handler, which spawns `pi --print` with a STRONGER local model
 * (qwen3.5:35b-a3b, the 32GB flagship) + full tools (bash,read,edit) + the
 * fleet-executor system prompt + the narration guard — so a capable model runs
 * the agentic decision loop LOCALLY on the node while tool execution stays
 * there (code/data never leave the node). This is the mirror of the Tier C
 * shell-exec handler (which runs a command with NO model); agent-exec runs a
 * real agent loop with a BIGGER model.
 *
 * Scoped to 32GB nodes: the strong model only fits there. The ansible deploy
 * auto-enables this handler where ansible_memtotal_mb >= 30000.
 *
 * Explicit-tag (caller opts in per task) — the caller sets
 * `metadata.exec="agent"` + `metadata.skills=["agent-exec"]` (and may target a
 * 32GB node). If invoked for a non-agent task (`exec!=="agent"`), the handler
 * throws `PI_SESSION_UNAVAILABLE` to fall through to the next handler / bridge.
 *
 * Reuses SubprocessPiTaskBridge for all transport hardening (concurrency cap,
 * byte-accurate maxBuffer, timeout, AbortSignal, narration guard).
 *
 * See wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md.
 */
import { SubprocessPiTaskBridge } from "./pi-task-bridge.js";
import type { SubprocessBridgeOptions } from "./pi-task-bridge.js";
import type { A2ATask } from "./types.js";

export interface AgentExecHandlerOptions {
  /** Strong local model for the decision loop (default "qwen3.5:35b-a3b"). */
  model?: string;
  /** Provider (default "ollama" — bypasses the model-router's cloud-via-a2a loop). */
  provider?: string;
  /** Tools to enable (default "bash,read,edit" — full agentic set). */
  tools?: string;
  /** Fleet-executor system prompt (reused from Tier A; passed via --system-prompt). */
  systemPrompt?: string;
  /** Max execution time in ms (default 600000 = 10 min; agentic loops on CPU are slow). */
  timeout?: number;
  /** Disable extension discovery (default true — avoids --print stdout interference). */
  noExtensions?: boolean;
  /** Max concurrent strong-model subprocesses (default 1 — 35b is heavy on CPU). */
  maxConcurrent?: number;
  /** Max bytes captured per stream (default 10 MB). */
  maxBufferBytes?: number;
  /** Narration guard (default true — reuse Tier B). */
  narrationGuardEnabled?: boolean;
  /** Max narration-guard re-runs (default 1). */
  narrationMaxRetries?: number;
}

/**
 * Create an agent-exec task handler. The handler builds a dedicated
 * SubprocessPiTaskBridge pinned to the strong model + full tools + the
 * fleet-executor prompt, and delegates execution to it.
 *
 * @returns a TaskHandler-shaped `(task, onUpdate, signal) => Promise<A2ATask>`.
 */
export function createAgentExecHandler(options: AgentExecHandlerOptions = {}) {
  const bridgeOptions: SubprocessBridgeOptions = {
    command: "pi",
    timeout: options.timeout ?? 600000,
    provider: options.provider ?? "ollama",
    model: options.model ?? "qwen3.5:35b-a3b",
    tools: options.tools ?? "bash,read,edit",
    noExtensions: options.noExtensions ?? true,
    maxConcurrent: options.maxConcurrent ?? 1,
    maxBufferBytes: options.maxBufferBytes,
    systemPrompt: options.systemPrompt,
    narrationGuardEnabled: options.narrationGuardEnabled ?? true,
    narrationMaxRetries: options.narrationMaxRetries ?? 1,
  };
  const bridge = new SubprocessPiTaskBridge(bridgeOptions);

  return async function agentExecHandler(
    task: A2ATask,
    _onUpdate: (update: Partial<A2ATask>) => void,
    signal?: AbortSignal,
  ): Promise<A2ATask> {
    const md = task.metadata ?? {};
    if (md.exec !== "agent") {
      // Not an agent-exec task — fall through to the next handler / bridge.
      throw new Error("PI_SESSION_UNAVAILABLE");
    }
    const message =
      task.status.message?.parts
        ?.filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("\n") ?? "";
    if (!message) {
      throw new Error("agent-exec: no message text in task");
    }

    const result = await bridge.executeTask(message, signal);

    task.status = { ...task.status, state: "completed", timestamp: new Date().toISOString() };
    if (!task.artifacts) task.artifacts = [];
    task.artifacts.push({
      artifactId: `agent-exec-${Date.now()}`,
      name: "result",
      parts: [{ type: "text", text: result }],
    });
    return task;
  };
}
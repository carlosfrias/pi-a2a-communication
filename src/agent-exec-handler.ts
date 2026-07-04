/**
 * agent-exec handler — Phase EXEC Tier D (strong-model escalation, explicit tag).
 *
 * A task tagged `metadata.exec="agent"` + `metadata.skills=["agent-exec"]` is
 * routed to this handler, which spawns `pi --print` with a STRONGER local model
 * (qwen3.5:35b-a3b, the 32GB flagship) + full tools (bash,read,edit) + a
 * dedicated capable-agent system prompt, so a capable model runs the agentic
 * decision loop LOCALLY on the node while tool execution stays there (code/data
 * never leave the node). This UNLOCKS hard agentic tasks on the fleet. Mirrors
 * the Tier C shell-exec handler (which runs a command with NO model); agent-exec
 * runs a real agent loop with a BIGGER model. Explicit-tag (caller opts in).
 *
 * Scoped to 32GB nodes: the handler is registered everywhere, but on nodes where
 * `enabled` is false (16GB — the strong model does not fit) an `exec="agent"`
 * task FAILS EXPLICITLY (rather than silently degrading to the 4B bridge), so the
 * caller knows to target a 32GB node.
 *
 * Reuses SubprocessPiTaskBridge for all transport hardening (concurrency cap +
 * opt-in queue-depth cap, byte-accurate maxBuffer, timeout, AbortSignal).
 *
 * See wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md.
 */
import { SubprocessPiTaskBridge } from "./pi-task-bridge.js";
import type { SubprocessBridgeOptions } from "./pi-task-bridge.js";
import type { A2ATask } from "./types.js";

export interface AgentExecHandlerOptions {
  /** Whether the strong model is available on this node (default true). When false, exec="agent" tasks fail explicitly. */
  enabled?: boolean;
  /** Strong local model for the decision loop (default "qwen3.5:35b-a3b"). */
  model?: string;
  /** Provider (default "ollama" — bypasses the model-router's cloud-via-a2a loop). */
  provider?: string;
  /** Tools to enable (default "bash,read,edit" — full agentic set). */
  tools?: string;
  /** Dedicated capable-agent system prompt for the strong model (passed via --system-prompt). */
  systemPrompt?: string;
  /** Max execution time in ms (default 600000 = 10 min; agentic loops on CPU are slow). */
  timeout?: number;
  /** Disable extension discovery (default true). */
  noExtensions?: boolean;
  /** Max concurrent strong-model subprocesses (default 1 — 35b is heavy on CPU). */
  maxConcurrent?: number;
  /** Max queued strong-model subprocesses before fast-fail (default 2; 0 = unbounded). */
  maxQueue?: number;
  /** Max bytes captured per stream (default 10 MB). */
  maxBufferBytes?: number;
  /**
   * Ollama keep-alive for the strong model (default "10m"). Sets OLLAMA_KEEP_ALIVE
   * on the subprocess so the model loads once and stays resident across a multi-step
   * agent loop (avoids the per-turn reload churn that OOMs 32GB nodes under the fleet
   * default OLLAMA_KEEP_ALIVE=0). "0" disables (unload after each turn).
   */
  ollamaKeepAlive?: string;
}

/**
 * Create an agent-exec task handler. The handler builds a dedicated
 * SubprocessPiTaskBridge pinned to the strong model + full tools + a capable-agent
 * prompt, and delegates execution to it.
 *
 * @returns a TaskHandler-shaped `(task, onUpdate, signal) => Promise<A2ATask>`.
 */
export function createAgentExecHandler(options: AgentExecHandlerOptions = {}) {
  const enabled = options.enabled ?? true;
  const bridge = new SubprocessPiTaskBridge({
    command: "pi",
    timeout: options.timeout ?? 600000,
    provider: options.provider ?? "ollama",
    model: options.model ?? "qwen3.5:35b-a3b",
    tools: options.tools ?? "bash,read,edit",
    noExtensions: options.noExtensions ?? true,
    maxConcurrent: options.maxConcurrent ?? 1,
    maxQueue: options.maxQueue ?? 2,
    maxBufferBytes: options.maxBufferBytes,
    env: { OLLAMA_KEEP_ALIVE: options.ollamaKeepAlive ?? "10m" },
    systemPrompt: options.systemPrompt,
    // RULE 23 audit (Tier D): the narration guard defaults to OFF for the strong
    // model — a 2nd 35B inference risks blowing the 600s budget on a hard loop,
    // and the capable model rarely narrates. Enable via the bridge config if desired.
    narrationGuardEnabled: false,
    narrationMaxRetries: 0,
  });

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
    if (!enabled) {
      // The strong model does not fit on this node (e.g. 16GB). Fail explicitly
      // rather than silently degrading to the 4B bridge (RULE 23 audit: silent
      // footgun). The caller should target a 32GB node for hard agentic tasks.
      throw new Error(
        "agent-exec not available on this node (the configured strong model " +
          "(qwen3.5:35b-a3b) is too heavy for safe A2A agent loops on 32GB — ~6GB " +
          "headroom + OLLAMA_KEEP_ALIVE=0 reload churn OOMs the node on multi-step " +
          "tasks; configure a lighter capable model (e.g. qwen3.5:14b) or more RAM"
      );
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
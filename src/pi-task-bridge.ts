/**
 * PiTaskBridge — Interface for connecting A2A server to pi task execution
 *
 * The PiTaskBridge interface defines how the A2A server delegates incoming
 * task messages to actual execution backends. The default NoOpPiTaskBridge
 * returns placeholder responses, maintaining backward compatibility with
 * the original executePiTask() stub.
 *
 * M10: Replaces the hardcoded placeholder in a2a-server.ts with an
 * injectable interface that supports real pi subagent integration.
 */

import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import type { TaskLedger, CheckpointRef } from "./task-ledger.js";

/**
 * Interface for task execution backends.
 * 
 * Implementations:
 * - NoOpPiTaskBridge: Returns placeholder (default, backward compatible)
 * - SubprocessPiTaskBridge: Invokes pi CLI via child_process (M10.3)
 * - Custom: Register via A2AServer.registerTaskHandler()
 */
export interface PiTaskBridge {
  /**
   * Execute a task synchronously and return the result string.
   * @param message The text content extracted from the A2A message
   * @returns The result text to send back as the task response
   */
  executeTask(message: string, signal?: AbortSignal): Promise<string>;

  /**
   * Execute a task with progress callbacks for streaming updates.
   * @param message The text content extracted from the A2A message
   * @param onProgress Callback for progress updates during execution
   * @returns The final result text
   */
  executeTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void,
    signal?: AbortSignal
  ): Promise<string>;

  /**
   * Phase-2 (HE-4 / RULE 24): checkpoint an in-flight task to the ledger.
   * MUST durably flush (await) before returning the ref — never cancel-then-hope.
   * Captures enough state to resume on another node (6A2 migration).
   */
  checkpoint(taskId: string, message: string, ledger: TaskLedger): Promise<CheckpointRef>;

  /**
   * Resume execution from a checkpoint ref (e.g. on a remote fleet node after 6A2).
   * Returns the result text, as executeTask would.
   */
  resume(ref: CheckpointRef, ledger: TaskLedger): Promise<string>;
}

/**
 * NoOpPiTaskBridge — Returns placeholder responses.
 * 
 * This is the default bridge when no real execution backend is configured.
 * It preserves the exact behavior of the original executePiTask() stub
 * for backward compatibility.
 */
export class NoOpPiTaskBridge implements PiTaskBridge {
  async executeTask(message: string, _signal?: AbortSignal): Promise<string> {
    return `[A2A Task Result]\n\nMessage received: ${message}\n\nThis is a placeholder response from the NoOp bridge. Replace with a real PiTaskBridge implementation.`;
  }

  async executeTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    onProgress("Analyzing request...");
    onProgress("Processing task...");
    return this.executeTask(message, signal);
  }

  async checkpoint(taskId: string, message: string, ledger: TaskLedger): Promise<CheckpointRef> {
    // RULE 24: await the flush before returning the ref.
    await ledger.update(taskId, { checkpointRef: message });
    return { taskId, ledgerKey: taskId };
  }

  async resume(ref: CheckpointRef, ledger: TaskLedger): Promise<string> {
    const t = await ledger.get(ref.taskId);
    const message = t?.checkpointRef ?? "";
    return this.executeTask(message);
  }
}

/**
 * Options for SubprocessPiTaskBridge
 */
export interface SubprocessBridgeOptions {
  /** Maximum execution time in milliseconds (default: 120000 = 2 minutes; fleet sets 300000). */
  timeout?: number;
  /** Override pi command (default: "pi") */
  command?: string;
  /** Provider for pi --print (optional; when set, bypasses the model-router to avoid cloud-via-a2a cross-node dispatch loops). */
  provider?: string;
  /** Model for pi --print (optional; when set, pins execution to a specific local model). */
  model?: string;
  /** Tools to enable in the subprocess (optional; when set, passed via --tools). */
  tools?: string;
  /** Disable extension discovery in the subprocess (optional; when true, avoids extension interference with --print stdout). Default: false (safe; opt-in for fleet). */
  noExtensions?: boolean;
  /**
   * System prompt for the subprocess (optional; opt-in — passed via --system-prompt when set).
   * Fleet use: a fleet-executor prompt that steers the weak local model to actually invoke
   * tools (bash/read/edit) and paste real stdout instead of narrating command plans.
   * See wiki/.../reference/executor-tier-gap-remediation.md (Phase EXEC Tier A).
   */
  systemPrompt?: string;
  /** Text appended to the subprocess system prompt (optional; opt-in — passed via --append-system-prompt when set). */
  appendSystemPrompt?: string;
  /** Max concurrent subprocess executions (default: 2; protects CPU/RAM on small nodes). */
  maxConcurrent?: number;
  /**
   * Max QUEUED subprocess executions before fast-fail (default 0 = unbounded).
   * When > 0 and the queue is full, executeTask rejects "Subprocess bridge queue
   * full" instead of waiting indefinitely. Phase EXEC Tier D: agent-exec sets this
   * so concurrent hard tasks fast-fail rather than piling up (each holds a 600s slot).
   */
  maxQueue?: number;
  /**
   * Extra environment variables for the spawned `pi --print` subprocess (merged over
   * the parent env + PI_A2A_SKIP_SERVER=1). Phase EXEC Tier D: agent-exec sets
   * OLLAMA_KEEP_ALIVE here so the strong model loads once and stays resident across
   * a multi-step agent loop (avoids the per-turn 23GB reload churn that OOMs 32GB
   * nodes when the fleet default is OLLAMA_KEEP_ALIVE=0).
   */
  env?: Record<string, string>;
  /** Max bytes captured per stream before killing the child (default: 10 MB). */
  maxBufferBytes?: number;
  /**
   * Ollama keep-alive for the regular subprocess bridge (Option B).
   * When set (e.g. "10m"), maps to env.OLLAMA_KEEP_ALIVE in the spawned `pi --print`
   * child, keeping the model resident and avoiding ~89s cold starts per task.
   * Without this, the env inherits OLLAMA_KEEP_ALIVE=0 (or the wrapper's default of 10m).
   * The pi wrapper at /usr/local/bin/pi already sets OLLAMA_KEEP_ALIVE=10m as a fallback;
   * this config value overrides it for the regular bridge subprocess.
   */
  ollamaKeepAlive?: string;
  /**
   * Narration-detection guard (Phase EXEC Tier B; opt-in, default false). When true,
   * if the `pi --print` output looks like plan-narration (the model described
   * commands instead of executing them), re-run once with a forced "actually
   * execute, paste stdout" follow-up that feeds back the model's own plan.
   * Belt-and-suspenders on top of the executor-role system prompt (Tier A).
   */
  narrationGuardEnabled?: boolean;
  /** Max narration-guard re-runs (default 1; 0 disables even when guard enabled). */
  narrationMaxRetries?: number;
}

/**
 * SubprocessPiTaskBridge — Invokes pi CLI via child_process
 * 
 * Production implementation that spawns a pi subprocess to execute tasks.
 * Uses the --print flag for non-interactive execution and --no-session
 * to prevent session persistence.
 * 
 * Error handling:
 * - ENOENT: Returns "Pi CLI not found" error with helpful message
 * - Timeout: Kills process and returns timeout error
 * - Non-zero exit: Returns stderr content
 */
export class SubprocessPiTaskBridge implements PiTaskBridge {
  private timeout: number;
  private command: string;
  private provider?: string;
  private model?: string;
  private tools?: string;
  private noExtensions: boolean;
  private systemPrompt?: string;
  private appendSystemPrompt?: string;
  private maxConcurrent: number;
  private maxQueue: number;
  private maxBufferBytes: number;
  private extraEnv: Record<string, string>;
  private narrationGuardEnabled: boolean;
  private narrationMaxRetries: number;
  /** Option B: OLLAMA_KEEP_ALIVE for the regular subprocess bridge. Mapped from config.ollamaKeepAlive. */
  private ollamaKeepAlive?: string;
  // Concurrency cap state
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(options: SubprocessBridgeOptions = {}) {
    // Safe defaults: the subprocess bridge spawns `pi --print --no-session <msg>`
    // with NO extra flags unless explicitly configured. Fleet nodes set
    // provider/model/tools/noExtensions via config.json. This keeps non-fleet
    // installs on the original behaviour (no regression).
    this.timeout = options.timeout ?? 120000;
    this.command = options.command ?? "pi";
    this.provider = options.provider;
    this.model = options.model;
    this.tools = options.tools;
    this.noExtensions = options.noExtensions ?? false;
    this.systemPrompt = options.systemPrompt;
    this.appendSystemPrompt = options.appendSystemPrompt;
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.maxQueue = options.maxQueue ?? 0;
    this.maxBufferBytes = options.maxBufferBytes ?? 10 * 1024 * 1024;
    this.extraEnv = options.env ?? {};
    this.ollamaKeepAlive = options.ollamaKeepAlive;
    this.narrationGuardEnabled = options.narrationGuardEnabled ?? false;
    this.narrationMaxRetries = options.narrationMaxRetries ?? 1;
  }

  async executeTask(message: string, signal?: AbortSignal): Promise<string> {
    // Concurrency cap (maxConcurrent <= 0 = unlimited). Protects CPU/RAM-
    // constrained nodes from N simultaneous `pi --print` processes. Tasks
    // beyond the cap queue and wait. Node is single-threaded: the capacity
    // check and `active++` run with no await between them, so admission is
    // atomic (no burst overshoot); waiters are released one-at-a-time via
    // shift() in the finally below. The wait races the caller's signal so an
    // aborted caller fails fast instead of spawning a child it would kill.
    if (this.maxConcurrent > 0 && this.active >= this.maxConcurrent) {
      if (signal?.aborted) throw new Error("Aborted");
      // Phase EXEC Tier D: opt-in queue-depth cap. When the queue is full, fast-fail
      // instead of waiting indefinitely (each waiter holds a connection/slot budget).
      if (this.maxQueue > 0 && this.waiters.length >= this.maxQueue) {
        throw new Error("Subprocess bridge queue full");
      }
      await new Promise<void>((resolve, reject) => {
        this.waiters.push(resolve);
        if (signal) {
          const onWaitAbort = () => {
            const idx = this.waiters.indexOf(resolve);
            if (idx >= 0) this.waiters.splice(idx, 1);
            reject(new Error("Aborted"));
          };
          signal.addEventListener("abort", onWaitAbort, { once: true });
        }
      });
    }
    this.active++;
    try {
      return await this.runWithNarrationGuard(message, signal);
    } finally {
      this.active--;
      const next = this.waiters.shift();
      if (next) next();
    }
  }

  /**
   * Phase EXEC Tier B - narration-detection guard. Runs the subprocess; if the
   * output looks like plan-narration and the guard is enabled with retries left,
   * re-runs ONCE with a forced execute-and-paste-stdout follow-up that feeds the
   * model own plan back to it. The re-run uses the same signal. Capped at
   * narrationMaxRetries so it can never loop forever.
   */
  private async runWithNarrationGuard(message: string, signal?: AbortSignal): Promise<string> {
    let result = await this.runSubprocess(message, signal);
    let retries = this.narrationGuardEnabled ? this.narrationMaxRetries : 0;
    while (retries > 0 && isNarration(result)) {
      retries--;
      const prior = result.length > 500 ? result.slice(0, 500) + '\n[...truncated]' : result;
      const followUp =
        message + '\n\n' + NARRATION_FOLLOWUP +
        '\n\nYour previous (plan-only) response was:\n' + prior;
      result = await this.runSubprocess(followUp, signal);
    }
    return result;
  }

  private runSubprocess(message: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      // PI_A2A_SKIP_SERVER: the spawned `pi --print` loads this same A2A
      // extension (in the user's settings.json). Without this gate the child's
      // session_start handler re-binds port 10000 -> EADDRINUSE -> the child
      // hangs and never prints. The env var is read in src/index.ts to skip the
      // server-start block in the child. stdin is 'ignore' so the child never
      // blocks waiting for EOF.
      //
      // Flags are OPT-IN (safe defaults): --no-extensions / --provider /
      // --model / --tools are added only when configured, so non-fleet users
      // get the original `pi --print --no-session <msg>` behaviour. Fleet nodes
      // set these via bridge config to avoid (a) extension interference with
      // --print stdout and (b) the model-router's cloud-via-a2a cross-node loop.
      const args = ["--print", "--no-session"];
      if (this.noExtensions) args.push("--no-extensions");
      if (this.provider) args.push("--provider", this.provider);
      if (this.model) args.push("--model", this.model);
      if (this.tools) args.push("--tools", this.tools);
      // Executor-role steering (Phase EXEC Tier A): a fleet-executor system prompt
      // so the weak local model (qwen3.5:4b) actually invokes tools and pastes real
      // stdout instead of narrating command plans. Opt-in: omitted when unset so
      // non-fleet installs keep the original `pi --print --no-session <msg>` args.
      if (this.systemPrompt) args.push("--system-prompt", this.systemPrompt);
      if (this.appendSystemPrompt) args.push("--append-system-prompt", this.appendSystemPrompt);
      args.push(message);

      const proc = spawn(this.command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PI_A2A_SKIP_SERVER: "1", ...this.extraEnv, ...(this.ollamaKeepAlive ? { OLLAMA_KEEP_ALIVE: this.ollamaKeepAlive } : {}) },
      });

      let settled = false;
      // procExited guards every proc.kill() so a late SIGTERM/SIGKILL (timeout
      // or external abort firing as the child exits) cannot target a dead or
      // reused PID.
      let procExited = false;
      // StringDecoder handles multi-byte UTF-8 split across chunk boundaries
      // (data.toString() per chunk can split a code point). Byte counters make
      // maxBuffer byte-accurate (string .length counts chars, not bytes).
      const stdoutDecoder = new StringDecoder("utf8");
      const stderrDecoder = new StringDecoder("utf8");
      let stdout = "";
      let stderr = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let overflowed = false;

      // SINGLE manual timeout timer (no spawn `timeout`, to avoid a double
      // SIGTERM). SIGTERM first, then SIGKILL after a grace period. Both timers
      // are cleared on close/error; every kill is guarded by procExited.
      let sigKillTimer: NodeJS.Timeout | null = null;
      const killTimer = setTimeout(() => {
        if (!procExited) {
          proc.kill("SIGTERM");
          sigKillTimer = setTimeout(() => { if (!procExited) proc.kill("SIGKILL"); }, 5000);
        }
        if (settled) return;
        settled = true;
        reject(new Error(`Pi process timed out after ${this.timeout}ms`));
      }, this.timeout);

      // External cancellation: if the caller aborts the signal, kill the child.
      // (Only the synchronous wait path wires a signal; fire-and-forget/
      // returnImmediately tasks do not, so a client disconnecting after a queued
      // ack won't cancel them.)
      const onAbort = () => { if (!procExited && !settled) proc.kill("SIGTERM"); };
      if (signal) {
        if (signal.aborted) {
          if (!procExited) proc.kill("SIGTERM");
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      proc.stdout.on("data", (data: Buffer) => {
        stdoutBytes += data.length;
        stdout += stdoutDecoder.write(data);
        if (stdoutBytes > this.maxBufferBytes) {
          overflowed = true;
          if (!procExited) proc.kill("SIGTERM");
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderrBytes += data.length;
        stderr += stderrDecoder.write(data);
        if (stderrBytes > this.maxBufferBytes) {
          overflowed = true;
          if (!procExited) proc.kill("SIGTERM");
        }
      });

      proc.on("close", (code: number | null) => {
        procExited = true;
        if (signal) signal.removeEventListener("abort", onAbort);
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        if (sigKillTimer) clearTimeout(sigKillTimer);
        // Flush any trailing partial multi-byte bytes from the decoders.
        stdout += stdoutDecoder.end();
        stderr += stderrDecoder.end();
        if (overflowed) {
          reject(new Error(`Pi subprocess output exceeded ${this.maxBufferBytes} bytes and was killed.`));
        } else if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Pi process exited with code ${code}: ${stderr.trim()}`));
        }
      });

      proc.on("error", (err: Error) => {
        procExited = true;
        if (signal) signal.removeEventListener("abort", onAbort);
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        if (sigKillTimer) clearTimeout(sigKillTimer);
        // Flush any trailing partial multi-byte bytes from the decoders so
        // captured stderr can be included in the error context.
        stdout += stdoutDecoder.end();
        stderr += stderrDecoder.end();
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          reject(new Error(`Pi CLI not found: ${err.message}. Ensure pi is installed and in PATH.`));
        } else if (code === "EACCES" || code === "EPERM") {
          reject(new Error(`Permission denied executing '${this.command}': ${err.message}.`));
        } else {
          reject(err);
        }
      });
    });
  }

  async executeTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    onProgress("Analyzing request...");
    const result = await this.executeTask(message, signal);
    onProgress("Generating response...");
    return result;
  }

  async checkpoint(taskId: string, message: string, ledger: TaskLedger): Promise<CheckpointRef> {
    // Subprocess bridge is one-shot (`pi --print`); the resumable state IS the
    // message. RULE 24: await the flush before returning.
    await ledger.update(taskId, { checkpointRef: message });
    return { taskId, ledgerKey: taskId };
  }

  async resume(ref: CheckpointRef, ledger: TaskLedger): Promise<string> {
    const t = await ledger.get(ref.taskId);
    if (!t || !t.checkpointRef) {
      throw new Error(`Cannot resume ${ref.taskId}: no checkpoint recorded`);
    }
    // Re-invoke pi with the captured message (6A2 migration to this node).
    return this.executeTask(t.checkpointRef);
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// Phase EXEC Tier B — narration detection (belt-and-suspenders guard).
// Conservative phrase-based detector. RULE 23 audit found the standalone
// fenced-block heuristic was false-positive-prone on legitimate "result + show
// the command" outputs, so it was removed; pure-fence narration is an accepted
// false negative (Tier A's prompt + these phrases cover the common "I would
// run X" cases).
// ═══════════════════════════════════════════════════════════════════════════

/** Follow-up directive appended on a narration-guard re-run. */
const NARRATION_FOLLOWUP =
  "Your previous response only described or planned the command(s) without executing them. " +
  "You MUST now ACTUALLY invoke the available tools (bash/read/edit) to run the command(s) and paste the real stdout. " +
  "Output ONLY the raw result — no prose, no code fences, no re-description of the commands. " +
  "A plan-only or description-only response is a failure.";

/** First-person narration phrases: the model describing what it *would* run. */
const NARRATION_PHRASES: RegExp[] = [
  /\bI would (run|execute|use|invoke|call)\b/i,
  /\bI'd (run|execute|use|invoke|call)\b/i,
  /\bI will (run|execute|use|invoke)\b/i,
  /\bI'll (run|execute|use|invoke)\b/i,
  /\bI should (run|execute|use|invoke)\b/i,
  /\bI need to (run|execute|use)\b/i,
  /\blet me (run|execute|use|try)\b/i,
  /\bI'm going to (run|execute|use)\b/i,
  /\bthe command (I would|to run|would be)\b/i,
];

/**
 * Detect whether a `pi --print` output is plan-narration rather than real
 * execution. Conservative + phrase-based: flags first-person narration
 * ("I would run X", "I'd execute", "I should run", …). Does NOT flag clean
 * real output ("391"), prose-wrapped real output ("The answer is **391**"),
 * or fenced blocks (the standalone-fence heuristic was removed as
 * false-positive-prone — see RULE 23 audit). Exported for unit testing.
 */
export function isNarration(output: string): boolean {
  if (!output || !output.trim()) return false;
  for (const p of NARRATION_PHRASES) {
    if (p.test(output)) return true;
  }
  return false;
}

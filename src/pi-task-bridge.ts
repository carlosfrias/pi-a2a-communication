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
  executeTask(message: string): Promise<string>;

  /**
   * Execute a task with progress callbacks for streaming updates.
   * @param message The text content extracted from the A2A message
   * @param onProgress Callback for progress updates during execution
   * @returns The final result text
   */
  executeTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void
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
  async executeTask(message: string): Promise<string> {
    return `[A2A Task Result]\n\nMessage received: ${message}\n\nThis is a placeholder response from the NoOp bridge. Replace with a real PiTaskBridge implementation.`;
  }

  async executeTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void
  ): Promise<string> {
    onProgress("Analyzing request...");
    onProgress("Processing task...");
    return this.executeTask(message);
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
  /** Max concurrent subprocess executions (default: 2; protects CPU/RAM on small nodes). */
  maxConcurrent?: number;
  /** Max bytes captured per stream before killing the child (default: 10 MB). */
  maxBufferBytes?: number;
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
  private maxConcurrent: number;
  private maxBufferBytes: number;
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
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.maxBufferBytes = options.maxBufferBytes ?? 10 * 1024 * 1024;
  }

  async executeTask(message: string): Promise<string> {
    // Concurrency cap (maxConcurrent <= 0 = unlimited). Protects CPU/RAM-
    // constrained nodes from N simultaneous `pi --print` processes. Tasks
    // beyond the cap queue and wait.
    if (this.maxConcurrent > 0 && this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active++;
    try {
      return await this.runSubprocess(message);
    } finally {
      this.active--;
      const next = this.waiters.shift();
      if (next) next();
    }
  }

  private runSubprocess(message: string): Promise<string> {
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
      args.push(message);

      const proc = spawn(this.command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PI_A2A_SKIP_SERVER: "1" },
      });

      let settled = false;
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
      // are cleared on close/error so a late SIGKILL cannot hit a reused PID.
      let sigKillTimer: NodeJS.Timeout | null = null;
      const killTimer = setTimeout(() => {
        proc.kill("SIGTERM");
        sigKillTimer = setTimeout(() => proc.kill("SIGKILL"), 5000);
        if (settled) return;
        settled = true;
        reject(new Error(`Pi process timed out after ${this.timeout}ms`));
      }, this.timeout);

      proc.stdout.on("data", (data: Buffer) => {
        stdoutBytes += data.length;
        stdout += stdoutDecoder.write(data);
        if (stdoutBytes > this.maxBufferBytes) {
          overflowed = true;
          proc.kill("SIGTERM");
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderrBytes += data.length;
        stderr += stderrDecoder.write(data);
        if (stderrBytes > this.maxBufferBytes) {
          overflowed = true;
          proc.kill("SIGTERM");
        }
      });

      proc.on("close", (code: number | null) => {
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
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        if (sigKillTimer) clearTimeout(sigKillTimer);
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
    onProgress: (progress: string) => void
  ): Promise<string> {
    onProgress("Analyzing request...");
    const result = await this.executeTask(message);
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
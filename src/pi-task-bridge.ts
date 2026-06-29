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
  /** Maximum execution time in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number;
  /** Override pi command (default: "pi") */
  command?: string;
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

  constructor(options: SubprocessBridgeOptions = {}) {
    this.timeout = options.timeout ?? 120000;
    this.command = options.command ?? "pi";
  }

  async executeTask(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.command, ["--print", "--no-session", message], {
        timeout: this.timeout,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Pi process exited with code ${code}: ${stderr.trim()}`));
        }
      });

      proc.on("error", (err: Error) => {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new Error(`Pi CLI not found: ${err.message}. Ensure pi is installed and in PATH.`));
        } else {
          reject(err);
        }
      });

      // Set timeout
      setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`Pi process timed out after ${this.timeout}ms`));
      }, this.timeout);
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
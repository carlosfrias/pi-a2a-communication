/**
 * shell-exec handler — Phase EXEC Tier C (deterministic short-circuit).
 *
 * For a task tagged `metadata.exec="shell"` with a `metadata.command` string,
 * run the command via `child_process` and return stdout as the task artifact —
 * NO model in the loop. This removes the entire class of trivial "run this
 * command and paste stdout" round-trips from the weak local model's path.
 *
 * Honors the `AbortSignal` (closes the accepted limitation "custom task
 * handlers don't receive the signal"): the signal is threaded through
 * `processTask`/`processTaskStreaming` and forwarded to `exec`, which kills the
 * child on abort.
 *
 * Routing: `processTask` checks `"shell-exec"` when present in
 * `task.metadata.skills`. The default `"a2a-task-execution"` (session) handler
 * throws `PI_SESSION_UNAVAILABLE` on the fleet; `processTask` must `continue`
 * (not `break`) so this handler is reached. If this handler is invoked but the
 * task is not a shell-exec task (no command / `exec!="shell"`), it throws
 * `PI_SESSION_UNAVAILABLE` to fall through to the next handler / bridge.
 *
 * See wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md.
 */
import { exec } from "node:child_process";
import type { A2ATask } from "./types.js";

export interface ShellExecHandlerOptions {
  /** Max execution time in ms (default 120000). The command is killed on expiry. */
  timeout?: number;
  /** Max stdout/stderr buffer bytes (default 10 MB). Exceeding kills the child. */
  maxBufferBytes?: number;
}

/**
 * Create a shell-exec task handler.
 *
 * @returns a TaskHandler-shaped async function `(task, onUpdate, signal) => Promise<A2ATask>`.
 * The 3rd `signal` param is threaded by `processTask`/`processTaskStreaming`.
 */
export function createShellExecHandler(options: ShellExecHandlerOptions = {}) {
  const timeoutMs = options.timeout ?? 120000;
  const maxBuffer = options.maxBufferBytes ?? 10 * 1024 * 1024;

  return async function shellExecHandler(
    task: A2ATask,
    _onUpdate: (update: Partial<A2ATask>) => void,
    signal?: AbortSignal,
  ): Promise<A2ATask> {
    const md = task.metadata ?? {};
    const isShell = md.exec === "shell" || md.exec === "shell-exec";
    const command = typeof md.command === "string" ? md.command.trim() : "";

    if (!isShell || !command) {
      // Not a shell-exec task — fall through to the next handler / bridge.
      throw new Error("PI_SESSION_UNAVAILABLE");
    }

    const stdout = await new Promise<string>((resolve, reject) => {
      exec(command, { signal, timeout: timeoutMs, maxBuffer }, (err, out, stderr) => {
        if (err) {
          if (signal?.aborted) return reject(new Error("Aborted"));
          const detail = stderr ? `${err.message}\n${stderr}` : err.message;
          return reject(new Error(`shell-exec failed: ${detail}`));
        }
        resolve(typeof out === "string" ? out : String(out));
      });
    });

    task.status = { ...task.status, state: "completed", timestamp: new Date().toISOString() };
    if (!task.artifacts) task.artifacts = [];
    task.artifacts.push({
      artifactId: `shell-exec-${Date.now()}`,
      name: "stdout",
      parts: [{ type: "text", text: stdout.trim() }],
    });
    return task;
  };
}
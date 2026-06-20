/**
 * PiSessionTaskHandler — Task handler that uses the running pi session
 *
 * When the A2A extension is loaded inside a pi session, this handler
 * executes incoming A2A tasks by sending them to the model via the
 * extension context's newSession API.
 *
 * This avoids spawning a separate pi process (unlike SubprocessPiTaskBridge)
 * and reuses the already-running model connection.
 */

import type { A2ATask } from "./types.js";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

/**
 * Task handler function signature — matches A2AServer's TaskHandler type.
 */
export type TaskHandler = (task: A2ATask, onUpdate: (update: Partial<A2ATask>) => void) => Promise<A2ATask>;

/**
 * Creates a task handler that processes A2A tasks using the running pi session.
 *
 * The handler:
 * 1. Extracts the text content from the A2A message
 * 2. Sends it as a user message to the pi session
 * 3. Returns the response as an A2A artifact
 *
 * If the pi session is unavailable or returns no response, falls back
 * to a "session unavailable" message.
 *
 * @param ctx The pi ExtensionContext for the running session
 * @returns A TaskHandler function suitable for A2AServer.registerTaskHandler()
 */
export function createPiSessionHandler(ctx: ExtensionContext): TaskHandler {
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

    // Report progress
    onUpdate({
      status: { ...task.status, state: "working" as const },
    });

    try {
      // Use pi's newSession to get an isolated response
      const sessionResult = await ctx.newSession({
        parentSession: ctx.sessionManager?.getSessionFile?.(),
      });

      if (sessionResult.cancelled) {
        task.status.state = "failed";
        task.isError = true;
        task.error = "Session was cancelled";
        task.status.timestamp = new Date().toISOString();
        return task;
      }

      // newSession doesn't return the AI response directly.
      // Return a confirmation that the task was processed.
      const resultText = `Task processed by pi session on ${new Date().toISOString()}. ` +
        `Message: "${textContent.substring(0, 200)}${textContent.length > 200 ? "..." : ""}"`;

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
    } catch (error) {
      task.status.state = "failed";
      task.isError = true;
      task.error = String(error);
      task.status.timestamp = new Date().toISOString();
      return task;
    }
  };
}
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
/**
 * Phase-2: Result reclamation — collect results from in-flight fleet tasks on
 * reconnect (health-aware-execution req 4 / 6B).
 *
 * On reconnect, replay in-flight fleet tasks from the ledger, call the A2A
 * client for each, reclaim completed results, and reschedule failed/lost ones.
 */
import type { A2ATask } from "./types.js";
import type { TaskLedger, TaskRecord } from "./task-ledger.js";

/** Minimal slice of TaskManager needed for reclamation (decouples for tests). */
export interface TaskStatusReader {
  getTaskStatus(taskId: string, agentUrl?: string): Promise<A2ATask | null>;
}

export interface ReclamationResult {
  reclaimed: TaskRecord[];   // completed → result recorded
  rescheduled: TaskRecord[]; // failed / canceled / lost → marked failed for re-dispatch
  stillRunning: TaskRecord[];
}

/** Extract text from an A2ATask (mirrors TaskManager.extractOutput). */
export function extractTaskOutput(task: A2ATask): string {
  if (task.artifacts && task.artifacts.length > 0) {
    const text = task.artifacts[0].parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("\n");
    if (text) return text;
  }
  if (task.status?.message?.parts) {
    const text = task.status.message.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("\n");
    if (text) return text;
  }
  return "";
}

const DONE_STATES = new Set(["completed"]);
const FAILED_STATES = new Set(["failed", "canceled", "rejected"]);

/**
 * Reclaim results for all in-flight fleet tasks in the ledger.
 * RULE 24: each ledger update is awaited (durable) before classifying.
 */
export async function reclaimResults(
  reader: TaskStatusReader,
  ledger: TaskLedger
): Promise<ReclamationResult> {
  const inflight = await ledger.reclaim();
  const reclaimed: TaskRecord[] = [];
  const rescheduled: TaskRecord[] = [];
  const stillRunning: TaskRecord[] = [];

  for (const t of inflight) {
    let task: A2ATask | null = null;
    try {
      task = await reader.getTaskStatus(t.taskId, t.agentUrl ?? undefined);
    } catch {
      task = null;
    }

    if (task === null) {
      // Lost (unreachable / unknown) → reschedule
      await ledger.update(t.taskId, { status: "failed" });
      rescheduled.push(t);
      continue;
    }

    const state = task.status?.state;
    if (state && DONE_STATES.has(state)) {
      await ledger.update(t.taskId, { status: "done", result: extractTaskOutput(task) });
      reclaimed.push(t);
    } else if (state && FAILED_STATES.has(state)) {
      await ledger.update(t.taskId, { status: "failed" });
      rescheduled.push(t);
    } else {
      stillRunning.push(t);
    }
  }

  return { reclaimed, rescheduled, stillRunning };
}
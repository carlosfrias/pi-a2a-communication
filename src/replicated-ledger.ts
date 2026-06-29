/**
 * Phase-2 (6B3): ReplicatedTaskLedger — local cache + fleet-side authoritative.
 *
 * The dispatcher (primary machine) reads/writes the LOCAL cache so the gate
 * keeps deciding while offprem / disconnected from the fleet-side authoritative
 * ledger. On reconnect, `sync()` reconciles: push local-only, pull remote-only,
 * and resolve conflicts last-write-wins per task_id (single-owner-at-a-time ⇒
 * conflicts are rare). RULE 24: every write is awaited (durable) before the
 * next; stale copies are overwritten, never move-then-hope.
 *
 * 6B1 (local-only) rejected (RULE 13). 6B2 = authoritative-only (phase-1).
 * 6B3 = this replicated cache + reconcile (phase-2 target).
 */
import type { TaskLedger, TaskRecord, TaskStatus, TaskUpdate } from "./task-ledger.js";

export class ReplicatedTaskLedger implements TaskLedger {
  constructor(private local: TaskLedger, private remote: TaskLedger) {}

  // Offline-first: all reads/writes hit the local cache.
  async add(rec: Omit<TaskRecord, "createdAt" | "updatedAt">): Promise<void> {
    await this.local.add(rec);
  }
  async get(taskId: string): Promise<TaskRecord | null> {
    return this.local.get(taskId);
  }
  async query(status?: TaskStatus): Promise<TaskRecord[]> {
    return this.local.query(status);
  }
  async update(taskId: string, f: TaskUpdate): Promise<void> {
    await this.local.update(taskId, f);
  }
  async reclaim(): Promise<TaskRecord[]> {
    return this.local.reclaim();
  }

  /**
   * Reconcile local cache with the fleet-side authoritative ledger. Call on
   * reconnect (and optionally on a cadence while connected). Last-write-wins
   * per task_id by updatedAt (ISO strings sort lexicographically).
   * Returns a summary of what changed.
   */
  async sync(): Promise<{
    pushed: string[];   // local-only → remote
    pulled: string[];   // remote-only → local
    localWon: string[]; // both, local newer → remote updated
    remoteWon: string[];// both, remote newer → local updated
  }> {
    const localAll = await this.local.query();
    const remoteAll = await this.remote.query();
    const localMap = new Map(localAll.map((t) => [t.taskId, t]));
    const remoteMap = new Map(remoteAll.map((t) => [t.taskId, t]));
    const ids = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);

    const pushed: string[] = [];
    const pulled: string[] = [];
    const localWon: string[] = [];
    const remoteWon: string[] = [];

    for (const id of ids) {
      const l = localMap.get(id);
      const r = remoteMap.get(id);
      if (l && !r) {
        // local-only → push to remote (RULE 24: await)
        await this.remote.add({
          taskId: l.taskId, target: l.target, modelTier: l.modelTier, status: l.status,
          checkpointRef: l.checkpointRef ?? null, taskSpec: l.taskSpec ?? null,
          agentUrl: l.agentUrl ?? null,
        });
        pushed.push(id);
      } else if (r && !l) {
        // remote-only → pull to local
        await this.local.add({
          taskId: r.taskId, target: r.target, modelTier: r.modelTier, status: r.status,
          checkpointRef: r.checkpointRef ?? null, taskSpec: r.taskSpec ?? null,
          agentUrl: r.agentUrl ?? null,
        });
        pulled.push(id);
      } else if (l && r) {
        // both → last-write-wins by updatedAt
        if ((l.updatedAt ?? "") > (r.updatedAt ?? "")) {
          await this.remote.update(id, this.toUpdate(l));
          localWon.push(id);
        } else if ((r.updatedAt ?? "") > (l.updatedAt ?? "")) {
          await this.local.update(id, this.toUpdate(r));
          remoteWon.push(id);
        }
        // equal timestamps → no-op
      }
    }
    return { pushed, pulled, localWon, remoteWon };
  }

  private toUpdate(t: TaskRecord): TaskUpdate {
    return {
      status: t.status, target: t.target, modelTier: t.modelTier,
      checkpointRef: t.checkpointRef ?? null, taskSpec: t.taskSpec ?? null,
      agentUrl: t.agentUrl ?? null, result: t.result ?? null,
    };
  }
}
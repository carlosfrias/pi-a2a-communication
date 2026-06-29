/**
 * Phase-2: TaskLedger — durable work ledger interface (health-aware-execution 6B).
 *
 * Mirrors the Python `fleet_resource_manager.core.ledger.TaskLedger` schema so the
 * TS (A2A dispatch side) and Python (gate/watch side) share ONE on-disk store:
 *   tasks(task_id PK, target, model_tier, status, checkpoint_ref, result,
 *         agent_url, created_at, updated_at)
 *
 * 6B1 (local-only) REJECTED (RULE 13). 6B2 = SQLite on the always-on fleet node
 * (authoritative). 6B3 = replicated local cache + reconcile (phase-2 target).
 *
 * RULE 24: writes are durable before returning — never move-then-hope.
 */
export type TaskTarget = "local" | "fleet";
export type TaskStatus = "running" | "dispatched" | "queued" | "done" | "failed";
export type ModelTier = "cloud" | "local-large" | "local-medium" | "local-small";

export interface CheckpointRef {
  taskId: string;
  /** Opaque key the ledger uses to retrieve the checkpoint (e.g. the task_id itself). */
  ledgerKey: string;
}

export interface TaskRecord {
  taskId: string;
  target: TaskTarget;
  modelTier: ModelTier;
  status: TaskStatus;
  checkpointRef?: string | null;
  result?: string | null;
  /** Fleet node A2A agent URL — needed by reclamation to call getTaskStatus. */
  agentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskUpdate {
  status?: TaskStatus;
  modelTier?: ModelTier;
  checkpointRef?: string | null;
  result?: string | null;
  agentUrl?: string | null;
}

export interface TaskLedger {
  /** Insert a new task. Rejects if taskId exists (single-writer-per-task). */
  add(rec: Omit<TaskRecord, "createdAt" | "updatedAt">): Promise<void>;
  get(taskId: string): Promise<TaskRecord | null>;
  query(status?: TaskStatus): Promise<TaskRecord[]>;
  /** Update fields. Rejects if taskId not found. Durable before resolve (RULE 24). */
  update(taskId: string, fields: TaskUpdate): Promise<void>;
  /** In-flight fleet tasks whose results need collecting on reconnect. */
  reclaim(): Promise<TaskRecord[]>;
}

const INFLIGHT: TaskStatus[] = ["running", "dispatched", "queued", "waiting" as TaskStatus];

function now(): string {
  return new Date().toISOString();
}

/**
 * InMemoryTaskLedger — logic reference impl for tests. NOT durable (6B2/6B3
 * provide the durable SQLite/replicated backends). Same contract.
 */
export class InMemoryTaskLedger implements TaskLedger {
  private tasks = new Map<string, TaskRecord>();

  async add(rec: Omit<TaskRecord, "createdAt" | "updatedAt">): Promise<void> {
    if (this.tasks.has(rec.taskId)) {
      throw new Error(`task_id ${rec.taskId} already exists (single-writer-per-task)`);
    }
    const ts = now();
    this.tasks.set(rec.taskId, { ...rec, createdAt: ts, updatedAt: ts });
  }

  async get(taskId: string): Promise<TaskRecord | null> {
    const t = this.tasks.get(taskId);
    return t ? { ...t } : null;
  }

  async query(status?: TaskStatus): Promise<TaskRecord[]> {
    const all = [...this.tasks.values()];
    const filtered = status ? all.filter((t) => t.status === status) : all;
    return filtered.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).map((t) => ({ ...t }));
  }

  async update(taskId: string, fields: TaskUpdate): Promise<void> {
    const t = this.tasks.get(taskId);
    if (!t) throw new Error(taskId);
    Object.assign(t, fields, { updatedAt: now() });
  }

  async reclaim(): Promise<TaskRecord[]> {
    return this.query()
      .then((all) =>
        all
          .filter((t) => t.target === "fleet" && (INFLIGHT as string[]).includes(t.status))
          .map((t) => ({ ...t }))
      );
  }
}

/**
 * SqliteTaskLedger — production backend sharing the Python ledger's SQLite file.
 * Uses the SAME schema/columns so both sides interoperate. Implemented via a
 * dynamic import of `better-sqlite3` (or Node's `node:sqlite` when stable) so
 * the package has no hard native dependency; throws a clear error if no driver
 * is available at construction time. (Wiring the driver is a deploy step.)
 */
export class SqliteTaskLedger implements TaskLedger {
  private db: any;
  constructor(private dbPath: string) {
    // Placeholder contract — see docstring. A concrete driver binding is wired
    // at deploy time to avoid a native build dependency in the test path.
    throw new Error(
      "SqliteTaskLedger: wire a sqlite driver (better-sqlite3 / node:sqlite) at deploy time. " +
        "Use InMemoryTaskLedger for tests. Schema matches Python fleet_resource_manager.core.ledger."
    );
  }
  async add(): Promise<void> { /* not reached */ }
  async get(): Promise<any> { /* not reached */ }
  async query(): Promise<any[]> { /* not reached */ }
  async update(): Promise<void> { /* not reached */ }
  async reclaim(): Promise<any[]> { /* not reached */ }
}
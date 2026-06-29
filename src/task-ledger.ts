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
  /** The serialized task message/spec — stored so 6A2 can checkpoint + re-dispatch. */
  taskSpec?: string | null;
  /** Fleet node A2A agent URL — needed by reclamation to call getTaskStatus. */
  agentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskUpdate {
  status?: TaskStatus;
  target?: TaskTarget;
  modelTier?: ModelTier;
  checkpointRef?: string | null;
  result?: string | null;
  taskSpec?: string | null;
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
 * Uses the SAME schema/columns so both sides interoperate. Built on Node's
 * built-in `node:sqlite` (DatabaseSync, Node 22.5+/25) via a static async
 * factory so the module stays loadable where the driver is absent. Falls back
 * to `better-sqlite3` if `node:sqlite` is unavailable. (No hard native dep.)
 */
const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
    task_id        TEXT PRIMARY KEY,
    target         TEXT,
    model_tier     TEXT,
    status         TEXT,
    checkpoint_ref TEXT,
    task_spec      TEXT,
    agent_url      TEXT,
    result         TEXT,
    created_at     TEXT,
    updated_at     TEXT
);
`;

function dbRowToRecord(r: any): TaskRecord | null {
  if (!r) return null;
  return {
    taskId: r.task_id, target: r.target, modelTier: r.model_tier, status: r.status,
    checkpointRef: r.checkpoint_ref ?? null, taskSpec: r.task_spec ?? null,
    agentUrl: r.agent_url ?? null, result: r.result ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export class SqliteTaskLedger implements TaskLedger {
  private constructor(private db: any, private dbPath: string) {}

  /** Open (and migrate) the SQLite ledger. Throws a clear error if no driver. */
  static async create(dbPath: string): Promise<SqliteTaskLedger> {
    let DatabaseSync: any;
    try { ({ DatabaseSync } = await import("node:sqlite")); }
    catch {
      try { ({ default: DatabaseSync } = await import("better-sqlite3")); }
      catch {
        throw new Error("SqliteTaskLedger: no sqlite driver available (need node:sqlite or better-sqlite3).");
      }
    }
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode=WAL");
    db.exec(SQLITE_SCHEMA);
    // forward-compatible migration (mirror Python ledger)
    const cols = new Set(db.prepare("PRAGMA table_info(tasks)").all().map((c: any) => c.name));
    if (!cols.has("task_spec")) db.exec("ALTER TABLE tasks ADD COLUMN task_spec TEXT");
    if (!cols.has("agent_url")) db.exec("ALTER TABLE tasks ADD COLUMN agent_url TEXT");
    return new SqliteTaskLedger(db, dbPath);
  }

  async add(rec: Omit<TaskRecord, "createdAt" | "updatedAt">): Promise<void> {
    const ts = new Date().toISOString();
    try {
      this.db.prepare(
        "INSERT INTO tasks (task_id, target, model_tier, status, checkpoint_ref, task_spec, agent_url, result, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)"
      ).run(rec.taskId, rec.target, rec.modelTier, rec.status, rec.checkpointRef ?? null,
            rec.taskSpec ?? null, rec.agentUrl ?? null, ts, ts);
    } catch (e: any) {
      if (/UNIQUE constraint|already exists/i.test(e?.message ?? "")) {
        throw new Error(`task_id ${rec.taskId} already exists (single-writer-per-task)`);
      }
      throw e;
    }
  }

  async get(taskId: string): Promise<TaskRecord | null> {
    return dbRowToRecord(this.db.prepare("SELECT * FROM tasks WHERE task_id = ?").get(taskId));
  }

  async query(status?: TaskStatus): Promise<TaskRecord[]> {
    const rows = status
      ? this.db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY updated_at").all(status)
      : this.db.prepare("SELECT * FROM tasks ORDER BY updated_at").all();
    return rows.map(dbRowToRecord);
  }

  async update(taskId: string, f: TaskUpdate): Promise<void> {
    if (!(await this.get(taskId))) throw new Error(taskId);
    const sets: string[] = []; const vals: any[] = [];
    if (f.status !== undefined) { sets.push("status = ?"); vals.push(f.status); }
    if (f.target !== undefined) { sets.push("target = ?"); vals.push(f.target); }
    if (f.modelTier !== undefined) { sets.push("model_tier = ?"); vals.push(f.modelTier); }
    if (f.checkpointRef !== undefined) { sets.push("checkpoint_ref = ?"); vals.push(f.checkpointRef); }
    if (f.taskSpec !== undefined) { sets.push("task_spec = ?"); vals.push(f.taskSpec); }
    if (f.agentUrl !== undefined) { sets.push("agent_url = ?"); vals.push(f.agentUrl); }
    if (f.result !== undefined) { sets.push("result = ?"); vals.push(f.result); }
    if (!sets.length) return;
    sets.push("updated_at = ?"); vals.push(new Date().toISOString()); vals.push(taskId);
    this.db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE task_id = ?`).run(...vals);
  }

  async reclaim(): Promise<TaskRecord[]> {
    const rows = this.db.prepare(
      `SELECT * FROM tasks WHERE target = 'fleet' AND status IN ('running','dispatched','queued','waiting') ORDER BY updated_at`
    ).all();
    return rows.map(dbRowToRecord);
  }

  close(): void { try { this.db.close(); } catch {} }
}
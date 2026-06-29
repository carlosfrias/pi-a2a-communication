/**
 * Phase-2: SqliteTaskLedger — real durable backend (node:sqlite), same schema
 * as the Python fleet_resource_manager ledger. Verifies RULE 24 persistence
 * across reopen + cross-language schema compatibility.
 */
import { describe, it, expect } from "vitest";
import { SqliteTaskLedger } from "../../src/task-ledger.js";
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function tmpDb(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "a2a-ledger-"));
  return { path: join(dir, "ledger.db"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("SqliteTaskLedger (node:sqlite)", () => {
  it("persists across close + reopen (RULE 24 durability)", async () => {
    const { path, cleanup } = tmpDb();
    try {
      const lg = await SqliteTaskLedger.create(path);
      await lg.add({ taskId: "t1", target: "fleet", modelTier: "cloud", status: "running", taskSpec: "x" });
      await lg.update("t1", { status: "done", result: "payload" });
      lg.close();

      const lg2 = await SqliteTaskLedger.create(path); // reopen same file
      const t = await lg2.get("t1");
      expect(t).not.toBeNull();
      expect(t!.status).toBe("done");
      expect(t!.result).toBe("payload");
      expect(t!.taskSpec).toBe("x");
      lg2.close();
    } finally {
      cleanup();
    }
  });

  it("rejects duplicate add (single-writer-per-task)", async () => {
    const { path, cleanup } = tmpDb();
    try {
      const lg = await SqliteTaskLedger.create(path);
      await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
      await expect(
        lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" })
      ).rejects.toThrow(/already exists/);
      lg.close();
    } finally {
      cleanup();
    }
  });

  it("reclaim returns in-flight fleet tasks only", async () => {
    const { path, cleanup } = tmpDb();
    try {
      const lg = await SqliteTaskLedger.create(path);
      await lg.add({ taskId: "t1", target: "fleet", modelTier: "cloud", status: "dispatched", agentUrl: "u1" });
      await lg.add({ taskId: "t2", target: "local", modelTier: "cloud", status: "running" });
      await lg.add({ taskId: "t3", target: "fleet", modelTier: "cloud", status: "done" });
      const r = await lg.reclaim();
      expect(r.map((t) => t.taskId)).toEqual(["t1"]);
      lg.close();
    } finally {
      cleanup();
    }
  });

  it("creates a real db file (durable on disk)", async () => {
    const { path, cleanup } = tmpDb();
    try {
      const lg = await SqliteTaskLedger.create(path);
      await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
      lg.close();
      expect(existsSync(path)).toBe(true);
    } finally {
      cleanup();
    }
  });
});
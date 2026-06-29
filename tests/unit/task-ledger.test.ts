/**
 * Phase-2: TaskLedger tests — mirrors the Python ledger contract (6B2/6B3).
 * RULE 24: writes durable before resolve; single-writer-per-task.
 */
import { describe, it, expect } from "vitest";
import { InMemoryTaskLedger } from "../../src/task-ledger.js";
import type { TaskLedger } from "../../src/task-ledger.js";

function makeLedger(): TaskLedger {
  return new InMemoryTaskLedger();
}

describe("TaskLedger", () => {
  describe("add / get", () => {
    it("adds then gets a task roundtrip", async () => {
      const lg = makeLedger();
      await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
      const t = await lg.get("t1");
      expect(t).not.toBeNull();
      expect(t!.taskId).toBe("t1");
      expect(t!.target).toBe("local");
      expect(t!.status).toBe("running");
    });

    it("get missing returns null", async () => {
      const lg = makeLedger();
      expect(await lg.get("nope")).toBeNull();
    });

    it("add duplicate id rejects (single-writer-per-task)", async () => {
      const lg = makeLedger();
      await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
      await expect(
        lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" })
      ).rejects.toThrow(/already exists/);
    });
  });

  describe("query", () => {
    it("queries by status", async () => {
      const lg = makeLedger();
      await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
      await lg.add({ taskId: "t2", target: "fleet", modelTier: "cloud", status: "running" });
      await lg.add({ taskId: "t3", target: "local", modelTier: "local-small", status: "done" });
      const running = await lg.query("running");
      expect(running.map((t) => t.taskId).sort()).toEqual(["t1", "t2"]);
      const done = await lg.query("done");
      expect(done.map((t) => t.taskId)).toEqual(["t3"]);
    });

    it("query all returns everything", async () => {
      const lg = makeLedger();
      await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
      await lg.add({ taskId: "t2", target: "local", modelTier: "cloud", status: "done" });
      expect((await lg.query()).length).toBe(2);
    });
  });

  describe("update", () => {
    it("updates status + result", async () => {
      const lg = makeLedger();
      await lg.add({ taskId: "t1", target: "fleet", modelTier: "cloud", status: "running" });
      await lg.update("t1", { status: "done", result: "payload-123" });
      const t = await lg.get("t1");
      expect(t!.status).toBe("done");
      expect(t!.result).toBe("payload-123");
    });

    it("updates checkpointRef (RULE 24 field)", async () => {
      const lg = makeLedger();
      await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
      await lg.update("t1", { checkpointRef: "ckpt-abc" });
      expect((await lg.get("t1"))!.checkpointRef).toBe("ckpt-abc");
    });

    it("update missing rejects", async () => {
      const lg = makeLedger();
      await expect(lg.update("nope", { status: "done" })).rejects.toThrow(/nope/);
    });
  });

  describe("reclaim", () => {
    it("returns in-flight fleet tasks (not local, not done)", async () => {
      const lg = makeLedger();
      await lg.add({ taskId: "t1", target: "fleet", modelTier: "cloud", status: "running" });
      await lg.add({ taskId: "t2", target: "fleet", modelTier: "cloud", status: "dispatched" });
      await lg.add({ taskId: "t3", target: "local", modelTier: "cloud", status: "running" });
      await lg.add({ taskId: "t4", target: "fleet", modelTier: "cloud", status: "done" });
      const r = await lg.reclaim();
      expect(r.map((t) => t.taskId).sort()).toEqual(["t1", "t2"]);
    });
  });

  describe("agentUrl", () => {
    it("stores agentUrl for reclamation routing", async () => {
      const lg = makeLedger();
      await lg.add({
        taskId: "t1", target: "fleet", modelTier: "cloud", status: "dispatched",
        agentUrl: "http://fnet3:4299/a2a",
      });
      const t = await lg.get("t1");
      expect(t!.agentUrl).toBe("http://fnet3:4299/a2a");
    });
  });
});
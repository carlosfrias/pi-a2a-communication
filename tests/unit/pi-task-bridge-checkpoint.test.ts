/**
 * Phase-2: PiTaskBridge checkpoint/resume (HE-4 / RULE 24).
 * checkpoint MUST flush to the ledger before returning the ref.
 */
import { describe, it, expect } from "vitest";
import { NoOpPiTaskBridge, SubprocessPiTaskBridge } from "../../src/pi-task-bridge.js";
import { InMemoryTaskLedger } from "../../src/task-ledger.js";
import type { TaskLedger } from "../../src/task-ledger.js";

async function seededLedger(): Promise<TaskLedger> {
  const lg = new InMemoryTaskLedger();
  await lg.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
  return lg;
}

describe("PiTaskBridge checkpoint/resume", () => {
  describe("NoOpPiTaskBridge", () => {
    it("checkpoint flushes the message to the ledger before returning (RULE 24)", async () => {
      const lg = await seededLedger();
      const bridge = new NoOpPiTaskBridge();
      const ref = await bridge.checkpoint("t1", "hello world", lg);
      expect(ref.taskId).toBe("t1");
      // flush happened before resolve:
      const t = await lg.get("t1");
      expect(t!.checkpointRef).toBe("hello world");
    });

    it("resume re-runs from the recorded checkpoint", async () => {
      const lg = await seededLedger();
      const bridge = new NoOpPiTaskBridge();
      const ref = await bridge.checkpoint("t1", "hello world", lg);
      const result = await bridge.resume(ref, lg);
      expect(typeof result).toBe("string");
      expect(result).toContain("hello world");
    });

    it("checkpoint on an unknown task rejects (cannot flush a non-existent task)", async () => {
      const lg = new InMemoryTaskLedger();
      const bridge = new NoOpPiTaskBridge();
      await expect(bridge.checkpoint("nope", "msg", lg)).rejects.toThrow(/nope/);
    });
  });

  describe("SubprocessPiTaskBridge", () => {
    it("checkpoint flushes the message to the ledger (does not spawn)", async () => {
      const lg = await seededLedger();
      const bridge = new SubprocessPiTaskBridge({ command: "pi" });
      const ref = await bridge.checkpoint("t1", "do the thing", lg);
      expect(ref.taskId).toBe("t1");
      expect((await lg.get("t1"))!.checkpointRef).toBe("do the thing");
    });

    it("resume without a recorded checkpoint rejects clearly", async () => {
      const lg = new InMemoryTaskLedger();
      await lg.add({ taskId: "t1", target: "fleet", modelTier: "cloud", status: "dispatched" });
      const bridge = new SubprocessPiTaskBridge({ command: "pi" });
      await expect(bridge.resume({ taskId: "t1", ledgerKey: "t1" }, lg)).rejects.toThrow(
        /no checkpoint/
      );
    });
  });

  describe("RULE 24 ordering (flush-before-return)", () => {
    it("the ledger reflects the checkpoint immediately after checkpoint resolves", async () => {
      const lg = await seededLedger();
      const bridge = new NoOpPiTaskBridge();
      await bridge.checkpoint("t1", "captured", lg);
      // If checkpoint returned before flushing, this would be null/old.
      expect((await lg.get("t1"))!.checkpointRef).toBe("captured");
    });
  });
});
/**
 * Phase-2: Result reclamation tests (req 4 / 6B).
 * On reconnect: completed → reclaimed, failed/lost → rescheduled, working → still running.
 */
import { describe, it, expect } from "vitest";
import { reclaimResults, extractTaskOutput } from "../../src/reclamation.js";
import { InMemoryTaskLedger } from "../../src/task-ledger.js";
import type { A2ATask } from "../../src/types.js";
import type { TaskStatusReader } from "../../src/reclamation.js";

function task(state: string, text?: string): A2ATask {
  return {
    id: "x",
    status: { state: state as any, message: text ? { messageId: "m", role: "agent", parts: [{ type: "text", text }] } as any : undefined },
  };
}

function reader(map: Record<string, A2ATask | null>): TaskStatusReader {
  return {
    async getTaskStatus(taskId: string) {
      return map[taskId] ?? null;
    },
  };
}

async function seededLedger() {
  const lg = new InMemoryTaskLedger();
  await lg.add({ taskId: "done-1", target: "fleet", modelTier: "cloud", status: "dispatched", agentUrl: "http://fnet3/a2a" });
  await lg.add({ taskId: "fail-1", target: "fleet", modelTier: "cloud", status: "dispatched", agentUrl: "http://fnet5/a2a" });
  await lg.add({ taskId: "lost-1", target: "fleet", modelTier: "cloud", status: "dispatched", agentUrl: "http://fnet7/a2a" });
  await lg.add({ taskId: "work-1", target: "fleet", modelTier: "cloud", status: "dispatched", agentUrl: "http://fnet3/a2a" });
  await lg.add({ taskId: "local-1", target: "local", modelTier: "cloud", status: "running" }); // not reclaimable
  return lg;
}

describe("reclaimResults", () => {
  it("reclaims completed tasks with their output", async () => {
    const lg = await seededLedger();
    const r = await reclaimResults(
      reader({
        "done-1": task("completed", "result-payload"),
        "fail-1": task("failed"),
        "lost-1": null,
        "work-1": task("working"),
      }),
      lg
    );
    expect(r.reclaimed.map((t) => t.taskId)).toEqual(["done-1"]);
    expect((await lg.get("done-1"))!.status).toBe("done");
    expect((await lg.get("done-1"))!.result).toBe("result-payload");
  });

  it("reschedules failed + lost (unreachable) tasks", async () => {
    const lg = await seededLedger();
    const r = await reclaimResults(
      reader({
        "done-1": task("completed", "ok"),
        "fail-1": task("failed"),
        "lost-1": null,
        "work-1": task("working"),
      }),
      lg
    );
    expect(r.rescheduled.map((t) => t.taskId).sort()).toEqual(["fail-1", "lost-1"]);
    expect((await lg.get("fail-1"))!.status).toBe("failed");
    expect((await lg.get("lost-1"))!.status).toBe("failed");
  });

  it("leaves still-working tasks running", async () => {
    const lg = await seededLedger();
    const r = await reclaimResults(
      reader({
        "done-1": task("completed", "ok"),
        "fail-1": task("failed"),
        "lost-1": null,
        "work-1": task("working"),
      }),
      lg
    );
    expect(r.stillRunning.map((t) => t.taskId)).toEqual(["work-1"]);
    expect((await lg.get("work-1"))!.status).toBe("dispatched"); // unchanged
  });

  it("does not touch local (non-fleet) tasks", async () => {
    const lg = await seededLedger();
    await reclaimResults(
      reader({
        "done-1": task("completed", "ok"),
        "fail-1": task("failed"),
        "lost-1": null,
        "work-1": task("working"),
      }),
      lg
    );
    expect((await lg.get("local-1"))!.status).toBe("running"); // untouched
  });

  it("canceled and rejected states are rescheduled, not reclaimed", async () => {
    const lg = new InMemoryTaskLedger();
    await lg.add({ taskId: "c1", target: "fleet", modelTier: "cloud", status: "dispatched", agentUrl: "u" });
    await lg.add({ taskId: "r1", target: "fleet", modelTier: "cloud", status: "dispatched", agentUrl: "u" });
    const r = await reclaimResults(reader({ c1: task("canceled"), r1: task("rejected") }), lg);
    expect(r.rescheduled.map((t) => t.taskId).sort()).toEqual(["c1", "r1"]);
    expect(r.reclaimed).toHaveLength(0);
  });
});

describe("extractTaskOutput", () => {
  it("pulls text from the status message parts", () => {
    expect(extractTaskOutput(task("completed", "hello output"))).toBe("hello output");
  });
  it("returns empty string when no text", () => {
    expect(extractTaskOutput(task("completed"))).toBe("");
  });
});
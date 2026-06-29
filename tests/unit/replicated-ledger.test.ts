/**
 * Phase-2 (6B3): ReplicatedTaskLedger — local cache + fleet-side authoritative
 * reconcile-on-reconnect. Last-write-wins per task_id. RULE 24.
 */
import { describe, it, expect } from "vitest";
import { ReplicatedTaskLedger } from "../../src/replicated-ledger.js";
import { InMemoryTaskLedger } from "../../src/task-ledger.js";

describe("ReplicatedTaskLedger (6B3)", () => {
  it("offline writes go to local; sync pushes local-only to remote", async () => {
    const local = new InMemoryTaskLedger();
    const remote = new InMemoryTaskLedger();
    const rep = new ReplicatedTaskLedger(local, remote);

    await rep.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
    // remote doesn't know about it yet
    expect(await remote.get("t1")).toBeNull();

    const res = await rep.sync();
    expect(res.pushed).toEqual(["t1"]);
    expect((await remote.get("t1"))!.taskId).toBe("t1");
  });

  it("sync pulls remote-only into local cache", async () => {
    const local = new InMemoryTaskLedger();
    const remote = new InMemoryTaskLedger();
    await remote.add({ taskId: "r1", target: "fleet", modelTier: "cloud", status: "done", agentUrl: "u" });

    const rep = new ReplicatedTaskLedger(local, remote);
    expect(await local.get("r1")).toBeNull();

    const res = await rep.sync();
    expect(res.pulled).toEqual(["r1"]);
    expect((await local.get("r1"))!.status).toBe("done");
  });

  it("conflict resolves last-write-wins by updatedAt", async () => {
    const local = new InMemoryTaskLedger();
    const remote = new InMemoryTaskLedger();
    // both have t1; remote was updated later (done) — remote should win.
    await local.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
    await remote.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
    // force remote newer
    await new Promise((r) => setTimeout(r, 5));
    await remote.update("t1", { status: "done", result: "finished" });

    const rep = new ReplicatedTaskLedger(local, remote);
    const res = await rep.sync();
    expect(res.remoteWon).toEqual(["t1"]);
    expect((await local.get("t1"))!.status).toBe("done");
    expect((await local.get("t1"))!.result).toBe("finished");
  });

  it("local-newer conflict updates remote", async () => {
    const local = new InMemoryTaskLedger();
    const remote = new InMemoryTaskLedger();
    await local.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
    await remote.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
    await new Promise((r) => setTimeout(r, 5));
    await local.update("t1", { status: "dispatched", target: "fleet" });

    const rep = new ReplicatedTaskLedger(local, remote);
    const res = await rep.sync();
    expect(res.localWon).toEqual(["t1"]);
    expect((await remote.get("t1"))!.status).toBe("dispatched");
    expect((await remote.get("t1"))!.target).toBe("fleet");
  });

  it("sync is idempotent (second sync is a no-op)", async () => {
    const local = new InMemoryTaskLedger();
    const remote = new InMemoryTaskLedger();
    await local.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });

    const rep = new ReplicatedTaskLedger(local, remote);
    await rep.sync();
    const res2 = await rep.sync();
    expect(res2.pushed.concat(res2.pulled, res2.localWon, res2.remoteWon)).toEqual([]);
  });

  it("delegates reads/writes to local (offline operation)", async () => {
    const local = new InMemoryTaskLedger();
    const remote = new InMemoryTaskLedger();
    const rep = new ReplicatedTaskLedger(local, remote);
    await rep.add({ taskId: "t1", target: "local", modelTier: "cloud", status: "running" });
    expect((await rep.get("t1"))!.status).toBe("running");
    await rep.update("t1", { status: "done" });
    expect((await rep.query("done")).length).toBe(1);
    expect(await remote.get("t1")).toBeNull(); // remote untouched until sync
  });
});
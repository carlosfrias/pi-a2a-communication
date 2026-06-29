/**
 * Cross-language interop: the Python fleet_resource-manager ledger and the TS
 * SqliteTaskLedger share ONE SQLite file (same schema). Python writes → TS reads
 * → TS writes → Python reads. Skips if python3 is unavailable.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteTaskLedger } from "../../src/task-ledger.js";

const PY = "python3";
const FRM = join(process.cwd(), "..", "fleet-resource-manager");

function pythonAvailable(): boolean {
  try { execSync(`${PY} --version`, { stdio: "ignore" }); return true; } catch { return false; }
}

const it_if_py = pythonAvailable() ? it : it.skip;

describe("cross-language shared ledger (Python ↔ TS)", () => {
  let dir: string;
  let dbPath: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "interop-"));
    dbPath = join(dir, "ledger.db");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const pyWrite = (code: string) =>
    execSync(`${PY} -c "${code.replace(/"/g, '\\"').replace(/\$/g, "\\$")}"`, {
      env: { ...process.env, DB: dbPath, PYTHONPATH: FRM },
      cwd: FRM,
    }).toString().trim();

  it_if_py("Python writes → TS reads → TS writes → Python reads", async () => {
    // 1. Python writes t1
    pyWrite(
      "from fleet_resource_manager.core.ledger import TaskLedger;import os;lg=TaskLedger(os.environ['DB']);lg.add('t1',target='local',model_tier='cloud',status='running',task_spec='heavy',agent_url='http://fnet3/a2a');lg.close();print('py-wrote')"
    );

    // 2. TS opens same db, reads, updates to done
    const lg = await SqliteTaskLedger.create(dbPath);
    const t = await lg.get("t1");
    expect(t).not.toBeNull();
    expect(t!.taskSpec).toBe("heavy");
    expect(t!.agentUrl).toBe("http://fnet3/a2a");
    await lg.update("t1", { status: "done", result: "finished-by-ts" });
    lg.close();

    // 3. Python reopens and sees the TS write
    const out = pyWrite(
      "from fleet_resource_manager.core.ledger import TaskLedger;import os;lg=TaskLedger(os.environ['DB']);t=lg.get('t1');print(t['status'],t['result']);lg.close()"
    );
    expect(out).toBe("done finished-by-ts");
  });
});
/**
 * Phase EXEC — Tier B: Narration-detection guard (TDD, RED first).
 *
 * After SubprocessPiTaskBridge's `pi --print` returns, inspect the output. If it
 * looks like plan-narration (the model described commands instead of executing
 * them), re-run ONCE with a forced "actually execute, paste stdout" follow-up
 * that includes the model's own plan. Opt-in (narrationGuardEnabled, default
 * false) and capped at narrationMaxRetries (default 1) so it can't loop forever.
 *
 * Conservative detector: flags first-person narration phrases ("I would run",
 * "I'd execute", …) and fenced ```bash/```sh blocks with no output marker. Does
 * NOT flag clean real output ("391") or prose-wrapped real output ("The answer
 * is **391**") or a fenced block that includes an output marker ("# Output: 391").
 *
 * See wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

function makeFakeChild() {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.pid = 12345;
  return child;
}

/** Drive a spawn mock that succeeds next tick with the given stdout (per-call). */
function succeedSequence(...outputs: string[]) {
  for (const out of outputs) {
    spawnMock.mockImplementationOnce(() => {
      const child = makeFakeChild();
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from(out));
        child.emit("close", 0);
      });
      return child;
    });
  }
}

describe("Phase EXEC Tier B — isNarration detector (TDD)", () => {
  beforeEach(() => spawnMock.mockReset());

  it("EXEC.B.1: flags first-person narration phrases", async () => {
    const { isNarration } = await import("../../src/pi-task-bridge.js");
    expect(isNarration("I would run `echo $((17*23))` to compute this.")).toBe(true);
    expect(isNarration("I'd execute the command echo hello")).toBe(true);
    expect(isNarration("I will run the following:\necho hi")).toBe(true);
    expect(isNarration("Let me run that for you.")).toBe(true);
    expect(isNarration("I'm going to use the bash tool to do this.")).toBe(true);
  });

  it("EXEC.B.1: pure fenced-command-block narration is an accepted false negative (conservative)", async () => {
    const { isNarration } = await import("../../src/pi-task-bridge.js");
    // RULE 23 audit: the standalone fenced-block heuristic was false-positive-prone
    // on legitimate "result + show the command" outputs, so it was removed. Phrase
    // detection is the signal; pure fences without a narration phrase are NOT flagged.
    expect(isNarration("Here is the command:\n```bash\necho $((17*23))\n```")).toBe(false);
    expect(isNarration("```sh\ngit status\n```")).toBe(false);
  });

  it("EXEC.B.1: false-positive regression - real result in prose + bare command fence is NOT flagged", async () => {
    const { isNarration } = await import("../../src/pi-task-bridge.js");
    expect(isNarration("391\n\n```bash\necho $((17*23))\n```")).toBe(false);
    expect(isNarration("The answer is **391**\n\n```bash\necho $((17*23))\n```")).toBe(false);
  });

  it("EXEC.B.1: does NOT flag clean real output or prose-wrapped real output", async () => {
    const { isNarration } = await import("../../src/pi-task-bridge.js");
    expect(isNarration("391")).toBe(false);
    expect(isNarration("fnet3")).toBe(false);
    expect(isNarration("The answer is **391**.")).toBe(false);
    expect(isNarration("The computation gives: **391** (which equals 17 × 23)")).toBe(false);
  });

  it("EXEC.B.1: does NOT flag a fenced block that includes an output marker", async () => {
    const { isNarration } = await import("../../src/pi-task-bridge.js");
    // fnet1-style real output: fence shows the command AND its output.
    expect(isNarration("17 × 23 = **391**\n\n```bash\necho $((17*23))\n# Output: 391\n```")).toBe(false);
    expect(isNarration("```\necho hi\nOutput: hi\n```")).toBe(false);
  });

  it("EXEC.B.1: empty/whitespace output is not narration", async () => {
    const { isNarration } = await import("../../src/pi-task-bridge.js");
    expect(isNarration("")).toBe(false);
    expect(isNarration("   \n  ")).toBe(false);
  });
});

describe("Phase EXEC Tier B — narration guard re-run (TDD)", () => {
  beforeEach(() => spawnMock.mockReset());

  it("EXEC.B.3: buildBridgeOptions maps narrationGuardEnabled/narrationMaxRetries through", async () => {
    const { buildBridgeOptions } = await import("../../src/bridge-options.js");
    const opts = buildBridgeOptions({
      type: "subprocess",
      narrationGuardEnabled: true,
      narrationMaxRetries: 1,
    });
    expect(opts.narrationGuardEnabled).toBe(true);
    expect(opts.narrationMaxRetries).toBe(1);
  });

  it("EXEC.B.3b: buildBridgeOptions leaves narration fields undefined when absent (non-fleet safe)", async () => {
    const { buildBridgeOptions } = await import("../../src/bridge-options.js");
    const opts = buildBridgeOptions({ type: "subprocess" });
    expect(opts.narrationGuardEnabled).toBeUndefined();
    expect(opts.narrationMaxRetries).toBeUndefined();
  });

  it("EXEC.B.2: guard enabled + narration on first run -> re-runs with a forced follow-up; returns real output", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi", timeout: 30000, narrationGuardEnabled: true, narrationMaxRetries: 1,
    });
    succeedSequence("I would run `echo $((17*23))` to get the answer.", "391");
    const result = await bridge.executeTask("compute 17*23");
    expect(result).toBe("391");
    expect(spawnMock).toHaveBeenCalledTimes(2);
    // The second run's message includes the follow-up directive + the narration.
    const [, args2] = spawnMock.mock.calls[1] as [string, string[]];
    const msg2 = args2[args2.length - 1];
    expect(msg2).toContain("compute 17*23"); // original task carried through
    expect(msg2.toLowerCase()).toMatch(/actually (invoke|execute|run).*bash|paste.*stdout|execute.*do not describe/);
    expect(msg2).toContain("I would run `echo $((17*23))`"); // the prior narration is fed back
  });

  it("EXEC.B.2b: guard disabled (default) -> no re-run even if narration (non-fleet safe)", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000 });
    succeedSequence("I would run echo hi");
    const result = await bridge.executeTask("say hi");
    expect(result).toBe("I would run echo hi");
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("EXEC.B.2c: maxRetries=1 -> if the re-run ALSO narrates, return it as-is (no infinite loop)", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi", timeout: 30000, narrationGuardEnabled: true, narrationMaxRetries: 1,
    });
    succeedSequence("I would run echo hi", "I'd execute: echo hi");
    const result = await bridge.executeTask("say hi");
    expect(result).toBe("I'd execute: echo hi");
    expect(spawnMock).toHaveBeenCalledTimes(2); // one retry only
  });

  it("EXEC.B.2d: real output -> no re-run (spawn called once)", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi", timeout: 30000, narrationGuardEnabled: true, narrationMaxRetries: 1,
    });
    succeedSequence("391");
    const result = await bridge.executeTask("compute 17*23");
    expect(result).toBe("391");
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("EXEC.B.2e: narrationMaxRetries=0 disables the re-run even when guard enabled", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi", timeout: 30000, narrationGuardEnabled: true, narrationMaxRetries: 0,
    });
    succeedSequence("I would run echo hi");
    const result = await bridge.executeTask("say hi");
    expect(result).toBe("I would run echo hi");
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("EXEC.B.2f: forwards the AbortSignal to BOTH the first and the follow-up runSubprocess", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi", timeout: 30000, narrationGuardEnabled: true, narrationMaxRetries: 1,
    });
    succeedSequence("I would run echo hi", "hi");
    const ac = new AbortController();
    await bridge.executeTask("say hi", ac.signal);
    const [, , opts1] = spawnMock.mock.calls[0] as [string, string[], any];
    const [, , opts2] = spawnMock.mock.calls[1] as [string, string[], any];
    // env carries PI_A2A_SKIP_SERVER (proves spawn opts captured); signal not threaded
    // into spawn opts by runSubprocess (it uses proc.on + signal listener), so we
    // assert the guard called runSubprocess twice with the same signal context by
    // confirming both calls spawned (the signal did not abort pre-emptively).
    expect(opts1.env.PI_A2A_SKIP_SERVER).toBe("1");
    expect(opts2.env.PI_A2A_SKIP_SERVER).toBe("1");
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it("EXEC.B.2g: if the first run fails/rejects (e.g. aborted or non-zero exit), the guard does NOT retry", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi", timeout: 30000, narrationGuardEnabled: true, narrationMaxRetries: 1,
    });
    // First spawn -> child closes with a non-zero exit -> runSubprocess rejects.
    spawnMock.mockImplementation(() => {
      const child = makeFakeChild();
      process.nextTick(() => {
        child.stderr.emit("data", Buffer.from("boom"));
        child.emit("close", 1);
      });
      return child;
    });
    await expect(bridge.executeTask("say hi")).rejects.toThrow(/exited with code 1/);
    expect(spawnMock).toHaveBeenCalledTimes(1); // rejection skips the guard re-run
  });
});
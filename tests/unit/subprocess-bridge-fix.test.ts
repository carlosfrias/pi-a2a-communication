/**
 * TDD: SubprocessPiTaskBridge must spawn `pi --print` with an env gate that
 * prevents the child from re-binding the A2A server port (EADDRINUSE fix),
 * must not block on stdin, and must SIGKILL a stuck child after SIGTERM.
 *
 * These tests are written BEFORE the implementation changes (red), then made
 * green by editing src/pi-task-bridge.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Capture the spawn calls. The factory returns a controllable fake child.
const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

/** Build a fake child process whose lifecycle we can drive from the test. */
function makeFakeChild() {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.pid = 12345;
  return child;
}

describe("SubprocessPiTaskBridge — EADDRINUSE/stdin/SIGKILL fix (TDD)", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("sets PI_A2A_SKIP_SERVER=1 in the child env so the spawned pi --print skips binding port 10000", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000 });
    const child = makeFakeChild();
    spawnMock.mockImplementation((_cmd, _args, _opts) => {
      // emit a successful result next tick
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from("391"));
        child.emit("close", 0);
      });
      return child;
    });

    await bridge.executeTask("17*23");

    const [, , options] = spawnMock.mock.calls[0] as [string, string[], any];
    expect(options.env).toBeDefined();
    expect(options.env.PI_A2A_SKIP_SERVER).toBe("1");
    // Still inherits the parent env (so PATH / nvm are available to find `pi`).
    expect(options.env.PATH).toBe(process.env.PATH);
  });

  it("uses stdio ['ignore','pipe','pipe'] so the child does not block waiting for stdin EOF", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000 });
    const child = makeFakeChild();
    spawnMock.mockImplementation(() => {
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from("ok"));
        child.emit("close", 0);
      });
      return child;
    });

    await bridge.executeTask("hi");

    const [, , options] = spawnMock.mock.calls[0] as [string, string[], any];
    expect(options.stdio).toEqual(["ignore", "pipe", "pipe"]);
  });

  it("passes --print --no-session <message> as the args", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000 });
    const child = makeFakeChild();
    spawnMock.mockImplementation(() => {
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from("ok"));
        child.emit("close", 0);
      });
      return child;
    });

    await bridge.executeTask("do the thing");

    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe("pi");
    expect(args).toEqual(["--print", "--no-session", "do the thing"]);
  });

  it("sends SIGTERM then SIGKILL on timeout (no zombie)", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    // Short timeout; use fake timers so we can advance deterministically.
    vi.useFakeTimers();
    try {
      const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 100 });
      const child = makeFakeChild();
      spawnMock.mockImplementation(() => child);

      const p = bridge.executeTask("stuck");
      // Attach the rejection handler synchronously so the timer-driven reject
      // is never reported as an unhandled rejection.
      let caught: unknown;
      p.catch((e) => { caught = e; });

      // Advance past the timeout window. SIGTERM should fire first.
      await vi.advanceTimersByTimeAsync(100);
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");

      // After a grace period, SIGKILL should fire.
      await vi.advanceTimersByTimeAsync(5000);
      expect(child.kill).toHaveBeenCalledWith("SIGKILL");

      // The promise must reject with a timeout error.
      await vi.waitFor(() => expect(caught).toBeDefined());
      expect((caught as Error).message).toMatch(/timed out/i);
      // At least two kill signals were attempted (SIGTERM + SIGKILL).
      expect(child.kill.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns stdout as the task result", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000 });
    const child = makeFakeChild();
    spawnMock.mockImplementation(() => {
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from("17 * 23 = 391"));
        child.emit("close", 0);
      });
      return child;
    });

    const result = await bridge.executeTask("17*23");
    expect(result).toBe("17 * 23 = 391");
  });
});
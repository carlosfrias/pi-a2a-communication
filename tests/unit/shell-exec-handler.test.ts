/**
 * Phase EXEC — Tier C: Deterministic shell-exec short-circuit (TDD, RED first).
 *
 * A task tagged metadata.exec="shell" + metadata.command + metadata.skills=["shell-exec"]
 * is routed to a registered "shell-exec" handler that runs the command via
 * child_process and returns stdout as the artifact — NO model in the loop. The
 * handler honors AbortSignal (closes the accepted limitation "custom task
 * handlers don't receive the signal"). processTask must `continue` (not `break`)
 * on PI_SESSION_UNAVAILABLE so the shell-exec handler is reached after the dead
 * session handler, and must thread the signal to handlers.
 *
 * See wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { A2ATask } from "../../src/types.js";
import { A2AServer } from "../../src/a2a-server.js";

// Capture exec() calls.
const execMock = vi.fn();
vi.mock("node:child_process", () => ({
  exec: (...args: unknown[]) => execMock(...args),
}));

/** Build a minimal valid A2ATask with the given metadata. */
function makeTask(md: Record<string, unknown>, text = "run it"): A2ATask {
  return {
    id: "t1",
    contextId: "c1",
    status: {
      state: "submitted",
      message: {
        messageId: "m1",
        contextId: "c1",
        taskId: "t1",
        role: "user",
        parts: [{ type: "text", text }],
      },
      timestamp: new Date().toISOString(),
    },
    artifacts: [],
    history: [],
    metadata: md,
  };
}

/** Drive exec mock: invoke callback next tick with (null, stdout, ""). */
function execSucceedsWith(stdout: string) {
  execMock.mockImplementation((_cmd: unknown, _opts: unknown, cb: any) => {
    process.nextTick(() => cb?.(null, stdout, ""));
    return {} as any;
  });
}
/** Drive exec mock: invoke callback next tick with an exit error + stderr. */
function execFails(stderr: string, code = 1) {
  execMock.mockImplementation((_cmd: unknown, _opts: unknown, cb: any) => {
    process.nextTick(() => {
      const err = new Error(`Command failed: exit ${code}`) as any;
      err.code = code;
      err.stderr = stderr;
      cb?.(err, "", stderr);
    });
    return {} as any;
  });
}

describe("Phase EXEC Tier C — shell-exec handler (TDD)", () => {
  beforeEach(() => execMock.mockReset());

  it("EXEC.C.1: runs metadata.command via child_process and returns stdout as artifact (no model)", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const handler = createShellExecHandler();
    execSucceedsWith("391\n");
    const task = makeTask({ exec: "shell", command: "echo $((17*23))", skills: ["shell-exec"] });
    const result = await handler(task, () => {});

    expect(execMock).toHaveBeenCalled();
    const [cmd] = execMock.mock.calls[0] as [string, unknown, unknown];
    expect(cmd).toBe("echo $((17*23))");
    expect(result.status.state).toBe("completed");
    const textPart = result.artifacts?.[0]?.parts?.find((p) => p.type === "text") as any;
    expect(textPart?.text).toBe("391");
  });

  it("EXEC.C.1b: trims trailing whitespace from stdout", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const handler = createShellExecHandler();
    execSucceedsWith("hello\n\n");
    const result = await handler(makeTask({ exec: "shell", command: "echo hello", skills: ["shell-exec"] }), () => {});
    expect((result.artifacts?.[0]?.parts?.[0] as any)?.text).toBe("hello");
  });

  it("EXEC.C.2: honors AbortSignal — rejects with Aborted when aborted", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const handler = createShellExecHandler();
    const ac = new AbortController();
    // exec invokes cb with a kill/abort error when the signal fires.
    execMock.mockImplementation((_cmd: unknown, _opts: unknown, cb: any) => {
      process.nextTick(() => {
        const err = new Error("AbortError") as any;
        err.killed = true;
        err.signal = "SIGTERM";
        cb?.(err, "", "");
      });
      return {} as any;
    });
    ac.abort();
    const task = makeTask({ exec: "shell", command: "sleep 5", skills: ["shell-exec"] });
    await expect(handler(task, () => {}, ac.signal)).rejects.toThrow(/Aborted/);
  });

  it("EXEC.C.2b: forwards the AbortSignal to exec options", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const ac = new AbortController();
    const handler = createShellExecHandler();
    execSucceedsWith("ok");
    await handler(makeTask({ exec: "shell", command: "echo ok", skills: ["shell-exec"] }), () => {}, ac.signal);
    const [, opts] = execMock.mock.calls[0] as [string, any, any];
    expect(opts?.signal).toBe(ac.signal);
  });

  it("EXEC.C.1c: non-zero exit -> rejects with shell-exec failed + stderr", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    execFails("boom", 2);
    const handler = createShellExecHandler();
    await expect(handler(makeTask({ exec: "shell", command: "false", skills: ["shell-exec"] }), () => {})).rejects.toThrow(/shell-exec failed/);
  });

  it("EXEC.C.edge: no command / exec!=shell -> throws PI_SESSION_UNAVAILABLE (fall through)", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const handler = createShellExecHandler();
    await expect(handler(makeTask({ skills: ["shell-exec"] }), () => {})).rejects.toThrow(/PI_SESSION_UNAVAILABLE/);
    await expect(handler(makeTask({ exec: "shell", skills: ["shell-exec"] }), () => {})).rejects.toThrow(/PI_SESSION_UNAVAILABLE/);
    await expect(handler(makeTask({ command: "echo x", skills: ["shell-exec"] }), () => {})).rejects.toThrow(/PI_SESSION_UNAVAILABLE/);
  });
});

// --- processTask routing (A2AServer) ---

function fakeBridge() {
  return {
    executeTask: vi.fn().mockResolvedValue("BRIDGE_RAN"),
    executeTaskWithProgress: vi.fn().mockResolvedValue("BRIDGE_RAN"),
  };
}
function fakeSessionUnavailableHandler() {
  return vi.fn(async () => {
    throw new Error("PI_SESSION_UNAVAILABLE");
  });
}
function makeServer(bridge: any, sessionHandler: any, shellExecHandler: any) {
  const server = new A2AServer(
    { enabled: true, port: 10099, host: "127.0.0.1" },
    { defaultScheme: "none", verifySsl: true },
    { ui: { notify: vi.fn() } } as any,
    bridge,
  );
  server.registerTaskHandler("a2a-task-execution", sessionHandler);
  server.registerTaskHandler("shell-exec", shellExecHandler);
  return server;
}

describe("Phase EXEC Tier C — processTask routing (TDD)", () => {
  beforeEach(() => execMock.mockReset());

  it("EXEC.C.3: tagged shell-exec task -> shell-exec handler runs; bridge NOT called", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, fakeSessionUnavailableHandler(), createShellExecHandler());
    execSucceedsWith("391\n");
    const task = makeTask({ exec: "shell", command: "echo $((17*23))", skills: ["shell-exec"] });

    const result = await (server as any).processTask(task, undefined);

    expect(result.status.state).toBe("completed");
    expect((result.artifacts?.[0]?.parts?.[0] as any)?.text).toBe("391");
    expect(bridge.executeTask).not.toHaveBeenCalled();
  });

  it("EXEC.C.3b: untagged task -> session unavailable -> falls through to bridge (model)", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, fakeSessionUnavailableHandler(), createShellExecHandler());
    const task = makeTask({}); // no skills, no exec

    const result = await (server as any).processTask(task, undefined);

    expect(bridge.executeTask).toHaveBeenCalledWith("run it", undefined);
    expect(result.status.state).toBe("completed");
  });

  it("EXEC.C.3c: reorder — explicit skills take priority; session handler NOT invoked for a tagged shell-exec task", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const sessionHandler = fakeSessionUnavailableHandler();
    const bridge = fakeBridge();
    const server = makeServer(bridge, sessionHandler, createShellExecHandler());
    execSucceedsWith("hello\n");
    const task = makeTask({ exec: "shell", command: "echo hello", skills: ["shell-exec"] });

    await (server as any).processTask(task, undefined);

    // Explicit metadata.skills are checked BEFORE the catch-all session handler,
    // so the session handler (and its parseMemoryRequest) is never invoked.
    expect(sessionHandler).not.toHaveBeenCalled();
    expect(bridge.executeTask).not.toHaveBeenCalled();
  });

  it("EXEC.C.3e: a real shell-exec command failure FAILS the task (does not fall through to bridge)", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, fakeSessionUnavailableHandler(), createShellExecHandler());
    execFails("boom", 2);
    const task = makeTask({ exec: "shell", command: "false", skills: ["shell-exec"] });

    await expect((server as any).processTask(task, undefined)).rejects.toThrow(/shell-exec failed/);
    expect(bridge.executeTask).not.toHaveBeenCalled();
  });

  it("EXEC.C.3d: threads the AbortSignal to the handler", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, fakeSessionUnavailableHandler(), createShellExecHandler());
    execSucceedsWith("ok\n");
    const ac = new AbortController();
    const task = makeTask({ exec: "shell", command: "echo ok", skills: ["shell-exec"] });

    await (server as any).processTask(task, ac.signal);

    const [, opts] = execMock.mock.calls[0] as [string, any, any];
    expect(opts?.signal).toBe(ac.signal);
  });

  it("EXEC.C.3f: processTaskStreaming routes tagged shell-exec to the handler (streaming path) and wires res close -> abort", async () => {
    const { createShellExecHandler } = await import("../../src/shell-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, fakeSessionUnavailableHandler(), createShellExecHandler());
    execSucceedsWith("hello\n");
    const res = new EventEmitter() as any;
    res.write = vi.fn(); res.writeHead = vi.fn(); res.end = vi.fn();
    const onSpy = vi.spyOn(res, "on");
    const task = makeTask({ exec: "shell", command: "echo hello", skills: ["shell-exec"] });

    await (server as any).processTaskStreaming(task, res);

    // Streaming bridge path NOT taken (handler short-circuited).
    expect(bridge.executeTaskWithProgress).not.toHaveBeenCalled();
    // The shell-exec handler actually ran the command (deterministic, no model).
    expect(execMock).toHaveBeenCalled();
    const [cmd] = execMock.mock.calls[0] as [string, any, any];
    expect(cmd).toBe("echo hello");
    // AbortController wired to res 'close' (Phase EXEC Tier C streaming fix).
    expect(onSpy).toHaveBeenCalledWith("close", expect.any(Function));
    // SSE emitted with completed state.
    const writes = res.write.mock.calls.map((c: any[]) => c[0]).join("");
    expect(writes).toContain("completed");
  });
});
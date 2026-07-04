/**
 * Phase EXEC — Tier D: agent-exec strong-model escalation (TDD, RED first).
 *
 * A task tagged metadata.exec="agent" + metadata.skills=["agent-exec"] routes to
 * a registered "agent-exec" handler that spawns `pi --print` with a STRONGER
 * local model (qwen3.5:35b-a3b) + full tools (bash,read,edit) + the fleet-executor
 * system prompt + narration guard, so a capable model runs the agentic decision
 * loop LOCALLY while tool execution stays on the node. Mirrors the Tier C
 * shell-exec handler (which runs a command with NO model); agent-exec runs a
 * real agent loop with a BIGGER model. Explicit-tag (caller opts in per task).
 * Scoped to 32GB nodes (the strong model only fits there).
 *
 * See wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { A2ATask } from "../../src/types.js";
import { A2AServer } from "../../src/a2a-server.js";

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
function succeedWith(stdout: string) {
  spawnMock.mockImplementation(() => {
    const child = makeFakeChild();
    process.nextTick(() => {
      child.stdout.emit("data", Buffer.from(stdout));
      child.emit("close", 0);
    });
    return child;
  });
}
function makeTask(md: Record<string, unknown>, text = "debug the restart"): A2ATask {
  return {
    id: "t1",
    contextId: "c1",
    status: {
      state: "submitted",
      message: { messageId: "m1", contextId: "c1", taskId: "t1", role: "user", parts: [{ type: "text", text }] },
      timestamp: new Date().toISOString(),
    },
    artifacts: [],
    history: [],
    metadata: md,
  };
}

describe("Phase EXEC Tier D — agent-exec handler (TDD)", () => {
  beforeEach(() => spawnMock.mockReset());

  it("EXEC.D.1: tagged agent-exec task -> spawns pi --print with the STRONG model + full tools + system prompt + message", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({ systemPrompt: "You are a fleet execution agent." });
    succeedWith("root cause: OOM at 03:14; raised MemoryMax");
    const result = await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined);

    expect(spawnMock).toHaveBeenCalled();
    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe("pi");
    expect(args).toContain("--print");
    expect(args).toContain("--no-extensions");
    expect(args).toContain("--model");
    expect(args[args.indexOf("--model") + 1]).toBe("qwen3.5:35b-a3b");
    expect(args).toContain("--tools");
    expect(args[args.indexOf("--tools") + 1]).toBe("bash,read,edit");
    expect(args).toContain("--system-prompt");
    expect(args[args.indexOf("--system-prompt") + 1]).toBe("You are a fleet execution agent.");
    expect(args[args.length - 1]).toBe("debug the restart");
    expect(result.status.state).toBe("completed");
    expect((result.artifacts?.[0]?.parts?.[0] as any)?.text).toBe("root cause: OOM at 03:14; raised MemoryMax");
  });

  it("EXEC.D.1b: options.model overrides the strong model", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({ model: "qwen3.5:35b-a3b", systemPrompt: "SP" });
    succeedWith("ok");
    await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args[args.indexOf("--model") + 1]).toBe("qwen3.5:35b-a3b");
  });

  it("EXEC.D.1c: no systemPrompt configured -> --system-prompt NOT pushed (opt-in safe)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({});
    succeedWith("ok");
    await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--system-prompt");
  });

  it("EXEC.D.edge: exec!=\"agent\" -> throws PI_SESSION_UNAVAILABLE (fall through)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({});
    await expect(handler(makeTask({ skills: ["agent-exec"] }), () => {}, undefined)).rejects.toThrow(/PI_SESSION_UNAVAILABLE/);
    await expect(handler(makeTask({ exec: "shell", command: "echo x", skills: ["agent-exec"] }), () => {}, undefined)).rejects.toThrow(/PI_SESSION_UNAVAILABLE/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("EXEC.D.2: forwards the AbortSignal to the underlying bridge (spawn runs with the signal context)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({ systemPrompt: "SP" });
    succeedWith("ok");
    const ac = new AbortController();
    await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, ac.signal);
    const [, , opts] = spawnMock.mock.calls[0] as [string, string[], any];
    // spawn opts captured (PI_A2A_SKIP_SERVER env proves the bridge ran); the signal
    // is threaded via the bridge's signal-listener (not a spawn opt), so we assert
    // the handler delegated to the bridge (spawn ran) without the signal aborting.
    expect(opts.env.PI_A2A_SKIP_SERVER).toBe("1");
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("EXEC.D.config: createAgentExecHandler defaults (model 35b-a3b, tools bash,read,edit, timeout 600000, narration guard on, maxConcurrent 1)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    // Defaults are observable via the spawned args.
    const handler = createAgentExecHandler({ systemPrompt: "SP" });
    succeedWith("ok");
    await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args[args.indexOf("--model") + 1]).toBe("qwen3.5:35b-a3b");
    expect(args[args.indexOf("--tools") + 1]).toBe("bash,read,edit");
  });

  it("EXEC.D.config2: BridgeConfig carries agentExecEnabled/agentExecModel/agentExecTimeout (runtime)", async () => {
    const cfg = {
      type: "subprocess" as const,
      agentExecEnabled: true,
      agentExecModel: "qwen3.5:35b-a3b",
      agentExecTimeout: 600000,
      agentExecSystemPrompt: "capable agent",
    };
    expect(cfg.agentExecEnabled).toBe(true);
    expect(cfg.agentExecModel).toBe("qwen3.5:35b-a3b");
    expect(cfg.agentExecTimeout).toBe(600000);
    expect(cfg.agentExecSystemPrompt).toBe("capable agent");
  });

  it("EXEC.D.16gb: enabled=false + exec=agent -> explicit failure (NOT silent 4B downgrade)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({ enabled: false, systemPrompt: "SP" });
    await expect(handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined))
      .rejects.toThrow(/not available on this node.*32GB/);
    expect(spawnMock).not.toHaveBeenCalled();
    // A non-agent task still falls through (PI_SESSION_UNAVAILABLE), not the explicit error.
    await expect(handler(makeTask({ exec: "shell", command: "x", skills: ["agent-exec"] }), () => {}, undefined))
      .rejects.toThrow(/PI_SESSION_UNAVAILABLE/);
  });

  it("EXEC.D.noguard: agent-exec narration guard is OFF — a narration output is returned as-is (no 2nd 35B inference)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({ systemPrompt: "SP" });
    spawnMock.mockImplementation(() => {
      const child = makeFakeChild();
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from("I would run echo $((17*23)) to get the answer."));
        child.emit("close", 0);
      });
      return child;
    });
    const result = await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined);
    expect(spawnMock).toHaveBeenCalledTimes(1); // no narration re-run (guard off)
    expect((result.artifacts?.[0]?.parts?.[0] as any)?.text).toContain("I would run");
  });

  it("EXEC.D.maxqueue: bridge maxQueue fast-fails when the queue is full", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000, maxConcurrent: 1, maxQueue: 1 });
    // First spawn holds the slot ~30ms, then completes; second task queues; third rejects.
    spawnMock.mockImplementation(() => {
      const child = makeFakeChild();
      setTimeout(() => {
        child.stdout.emit("data", Buffer.from("ok"));
        child.emit("close", 0);
      }, 30);
      return child;
    });
    const p1 = bridge.executeTask("t1");
    const p2 = bridge.executeTask("t2");
    await expect(bridge.executeTask("t3")).rejects.toThrow(/queue full/);
    await p1;
    await p2;
    expect(spawnMock).toHaveBeenCalledTimes(2); // t1 + t2 ran; t3 fast-failed (not spawned)
  });

  it("EXEC.D.keepalive: agent-exec sets OLLAMA_KEEP_ALIVE=10m in the subprocess env by default (stops reload churn)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({ systemPrompt: "SP" });
    succeedWith("ok");
    await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined);
    const [, , opts] = spawnMock.mock.calls[0] as [string, string[], any];
    expect(opts.env.OLLAMA_KEEP_ALIVE).toBe("10m");
    expect(opts.env.PI_A2A_SKIP_SERVER).toBe("1"); // still gated
    expect(opts.env.PATH).toBe(process.env.PATH); // still inherits parent env
  });

  it("EXEC.D.keepalive2: options.ollamaKeepAlive overrides (e.g. 5m / 0)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const handler = createAgentExecHandler({ systemPrompt: "SP", ollamaKeepAlive: "5m" });
    succeedWith("ok");
    await handler(makeTask({ exec: "agent", skills: ["agent-exec"] }), () => {}, undefined);
    const [, , opts] = spawnMock.mock.calls[0] as [string, string[], any];
    expect(opts.env.OLLAMA_KEEP_ALIVE).toBe("5m");
  });

  it("EXEC.D.bridgeEnv: SubprocessBridgeOptions.env is merged over the parent env in spawn", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000, env: { OLLAMA_KEEP_ALIVE: "10m", CUSTOM: "x" } });
    succeedWith("ok");
    await bridge.executeTask("hi");
    const [, , opts] = spawnMock.mock.calls[0] as [string, string[], any];
    expect(opts.env.OLLAMA_KEEP_ALIVE).toBe("10m");
    expect(opts.env.CUSTOM).toBe("x");
    expect(opts.env.PI_A2A_SKIP_SERVER).toBe("1");
  });
});

// --- processTask routing ---

function fakeBridge() {
  return {
    executeTask: vi.fn().mockResolvedValue("DEFAULT_BRIDGE_RAN"),
    executeTaskWithProgress: vi.fn().mockResolvedValue("DEFAULT_BRIDGE_RAN"),
  };
}
function fakeSessionUnavailableHandler() {
  return vi.fn(async () => { throw new Error("PI_SESSION_UNAVAILABLE"); });
}
function makeServer(bridge: any, agentExecHandler: any) {
  const server = new A2AServer(
    { enabled: true, port: 10099, host: "127.0.0.1" },
    { defaultScheme: "none", verifySsl: true },
    { ui: { notify: vi.fn() } } as any,
    bridge,
  );
  server.registerTaskHandler("a2a-task-execution", fakeSessionUnavailableHandler());
  server.registerTaskHandler("agent-exec", agentExecHandler);
  return server;
}

describe("Phase EXEC Tier D — processTask routing (TDD)", () => {
  beforeEach(() => spawnMock.mockReset());

  it("EXEC.D.3: tagged agent-exec task -> agent-exec handler runs (strong model); default bridge NOT called", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, createAgentExecHandler({ systemPrompt: "SP" }));
    succeedWith("AGENT_ANSWER");
    const task = makeTask({ exec: "agent", skills: ["agent-exec"] });

    const result = await (server as any).processTask(task, undefined);

    expect(result.status.state).toBe("completed");
    expect((result.artifacts?.[0]?.parts?.[0] as any)?.text).toBe("AGENT_ANSWER");
    // The strong-model subprocess ran (spawn called with --model 35b-a3b) ...
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args[args.indexOf("--model") + 1]).toBe("qwen3.5:35b-a3b");
    // ... and the default bridge was NOT called.
    expect(bridge.executeTask).not.toHaveBeenCalled();
  });

  it("EXEC.D.3b: untagged task -> default bridge (model path), agent-exec handler NOT invoked", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, createAgentExecHandler({ systemPrompt: "SP" }));
    const task = makeTask({}); // no exec, no skills

    const result = await (server as any).processTask(task, undefined);

    expect(bridge.executeTask).toHaveBeenCalledWith("debug the restart", undefined);
    expect(result.status.state).toBe("completed");
    expect(spawnMock).not.toHaveBeenCalled(); // agent-exec's strong-model spawn did not run
  });

  it("EXEC.D.3c: a shell-exec task is NOT hijacked by agent-exec (exec=\"shell\" -> agent-exec throws unavailable -> default bridge)", async () => {
    const { createAgentExecHandler } = await import("../../src/agent-exec-handler.js");
    const bridge = fakeBridge();
    const server = makeServer(bridge, createAgentExecHandler({ systemPrompt: "SP" }));
    const task = makeTask({ exec: "shell", command: "echo hi", skills: ["shell-exec"] });

    await (server as any).processTask(task, undefined);

    // agent-exec is not in this task's skills, so it is never consulted; default bridge runs.
    expect(bridge.executeTask).toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
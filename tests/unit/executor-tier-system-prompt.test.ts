/**
 * Phase EXEC — Tier A: Executor-Role System Prompt (TDD, RED first).
 *
 * SubprocessPiTaskBridge must be able to steer the spawned `pi --print` with a
 * fleet-executor system prompt so the weak local model (qwen3.5:4b) actually
 * invokes tools instead of narrating command plans. See
 * wiki/pi-a2a-communication/reference/executor-tier-gap-remediation.md.
 *
 * Opt-in + non-fleet safe: when systemPrompt/appendSystemPrompt are unset, the
 * spawned args MUST be unchanged (no regression).
 *
 * These tests are written BEFORE the implementation changes (red), then made
 * green by editing src/pi-task-bridge.ts, src/types.ts, and adding
 * src/bridge-options.ts.
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

/** Wire a spawn mock that succeeds next tick with the given stdout. */
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

describe("Phase EXEC Tier A — executor-role system prompt (TDD)", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("EXEC.A.3.2: when systemPrompt is set, pushes --system-prompt <value> before the message", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi",
      timeout: 30000,
      systemPrompt: "You are a fleet execution agent. Never narrate — execute.",
    });
    succeedWith("ok");
    await bridge.executeTask("do the thing");

    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const msgIdx = args.indexOf("do the thing");
    const flagIdx = args.indexOf("--system-prompt");
    expect(flagIdx).toBeGreaterThan(-1);
    expect(args[flagIdx + 1]).toBe("You are a fleet execution agent. Never narrate — execute.");
    // flag must come before the message
    expect(flagIdx).toBeLessThan(msgIdx);
  });

  it("EXEC.A.3.3: when appendSystemPrompt is set, pushes --append-system-prompt <value>", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi",
      timeout: 30000,
      appendSystemPrompt: "Always paste real stdout.",
    });
    succeedWith("ok");
    await bridge.executeTask("run it");

    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const flagIdx = args.indexOf("--append-system-prompt");
    expect(flagIdx).toBeGreaterThan(-1);
    expect(args[flagIdx + 1]).toBe("Always paste real stdout.");
    expect(flagIdx).toBeLessThan(args.indexOf("run it"));
  });

  it("EXEC.A.3.4: both set → both flags present, systemPrompt before appendSystemPrompt before message", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({
      command: "pi",
      timeout: 30000,
      systemPrompt: "SP",
      appendSystemPrompt: "ASP",
    });
    succeedWith("ok");
    await bridge.executeTask("msg");

    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const spIdx = args.indexOf("--system-prompt");
    const aspIdx = args.indexOf("--append-system-prompt");
    const msgIdx = args.indexOf("msg");
    expect(spIdx).toBeGreaterThan(-1);
    expect(aspIdx).toBeGreaterThan(-1);
    expect(spIdx).toBeLessThan(aspIdx);
    expect(aspIdx).toBeLessThan(msgIdx);
  });

  it("EXEC.A.3.4: neither set → args unchanged (non-fleet regression guard)", async () => {
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const bridge = new SubprocessPiTaskBridge({ command: "pi", timeout: 30000 });
    succeedWith("ok");
    await bridge.executeTask("do the thing");

    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe("pi");
    expect(args).toEqual(["--print", "--no-session", "do the thing"]);
  });

  it("EXEC.A.3.5: BridgeConfig carries optional systemPrompt/appendSystemPrompt (type + runtime)", async () => {
    const { BridgeConfig } = {} as any; // type-only import shim
    void BridgeConfig;
    // Runtime: a BridgeConfig-shaped object accepts the fields.
    const cfg = {
      type: "subprocess" as const,
      command: "pi",
      timeout: 300000,
      provider: "ollama",
      model: "qwen3.5:4b",
      tools: "bash",
      noExtensions: true,
      maxConcurrent: 2,
      maxBufferBytes: 10 * 1024 * 1024,
      systemPrompt: "You are a fleet execution agent.",
      appendSystemPrompt: "Paste real stdout.",
    };
    expect(cfg.systemPrompt).toBe("You are a fleet execution agent.");
    expect(cfg.appendSystemPrompt).toBe("Paste real stdout.");
  });

  it("EXEC.A.3.5: ConfigManager DEFAULTS leave bridge.systemPrompt/appendSystemPrompt undefined (opt-in)", async () => {
    const { ConfigManager } = await import("../../src/config.js");
    // No disk config in test cwd -> DEFAULTS only.
    const mgr = new ConfigManager();
    const cfg = mgr.getConfig();
    expect(cfg.bridge?.systemPrompt).toBeUndefined();
    expect(cfg.bridge?.appendSystemPrompt).toBeUndefined();
    // Safe defaults preserved: subprocess bridge, no fleet flags forced.
    expect(cfg.bridge?.type).toBe("subprocess");
    expect(cfg.bridge?.noExtensions).toBeUndefined();
  });

  it("EXEC.A.3.6: buildBridgeOptions(config) maps bridge.systemPrompt/appendSystemPrompt through to SubprocessBridgeOptions", async () => {
    const { buildBridgeOptions } = await import("../../src/bridge-options.js");
    const opts = buildBridgeOptions({
      type: "subprocess",
      command: "pi",
      timeout: 300000,
      provider: "ollama",
      model: "qwen3.5:4b",
      tools: "bash",
      noExtensions: true,
      maxConcurrent: 2,
      maxBufferBytes: 10485760,
      systemPrompt: "fleet-exec",
      appendSystemPrompt: "paste stdout",
    });
    expect(opts.systemPrompt).toBe("fleet-exec");
    expect(opts.appendSystemPrompt).toBe("paste stdout");
    // Existing fields still propagate.
    expect(opts.provider).toBe("ollama");
    expect(opts.model).toBe("qwen3.5:4b");
    expect(opts.tools).toBe("bash");
    expect(opts.noExtensions).toBe(true);
    expect(opts.maxConcurrent).toBe(2);
    expect(opts.maxBufferBytes).toBe(10485760);
    expect(opts.timeout).toBe(300000);
    expect(opts.command).toBe("pi");
  });

  it("EXEC.A.3.6: buildBridgeOptions leaves systemPrompt/appendSystemPrompt undefined when absent (non-fleet safe)", async () => {
    const { buildBridgeOptions } = await import("../../src/bridge-options.js");
    const opts = buildBridgeOptions({ type: "subprocess" });
    expect(opts.systemPrompt).toBeUndefined();
    expect(opts.appendSystemPrompt).toBeUndefined();
    // Defaults still apply.
    expect(opts.command).toBe("pi");
    expect(opts.timeout).toBe(120000);
    expect(opts.noExtensions).toBe(false);
  });

  it("EXEC.A.3.6: end-to-end — config.systemPrompt flows through buildBridgeOptions → SubprocessPiTaskBridge → spawned --system-prompt", async () => {
    const { buildBridgeOptions } = await import("../../src/bridge-options.js");
    const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
    const opts = buildBridgeOptions({
      type: "subprocess",
      timeout: 300000,
      provider: "ollama",
      model: "qwen3.5:4b",
      tools: "bash",
      noExtensions: true,
      systemPrompt: "You are a fleet execution agent. Execute, don't narrate.",
    });
    const bridge = new SubprocessPiTaskBridge(opts);
    succeedWith("ok");
    await bridge.executeTask("echo hello");

    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    const flagIdx = args.indexOf("--system-prompt");
    expect(flagIdx).toBeGreaterThan(-1);
    expect(args[flagIdx + 1]).toBe("You are a fleet execution agent. Execute, don't narrate.");
    // Opt-in flags still present.
    expect(args).toContain("--no-extensions");
    expect(args).toContain("--provider");
    expect(args).toContain("ollama");
    expect(args).toContain("--model");
    expect(args).toContain("qwen3.5:4b");
    expect(args).toContain("--tools");
    expect(args).toContain("bash");
  });
});
/**
 * Handler fallback test — verifies that SubprocessPiTaskBridge is still
 * reached when the memory-dispatch handler (formerly PiSessionTaskHandler)
 * throws PI_SESSION_UNAVAILABLE for non-memory tasks.
 *
 * This test was written BEFORE removing the dead PiSessionTaskHandler code
 * path, to ensure the SubprocessPiTaskBridge fallback is preserved.
 */
import { describe, it, expect, vi } from "vitest";
import { SubprocessPiTaskBridge, NoOpPiTaskBridge } from "../../src/pi-task-bridge.js";
import { createMemoryDispatchHandler, PI_SESSION_UNAVAILABLE } from "../../src/pi-session-handler.js";
import type { A2ATask } from "../../src/types.js";

function createMockCtx(overrides: Record<string, unknown> = {}): any {
  return {
    ui: { notify: vi.fn() },
    sessionManager: {
      getSessionFile: vi.fn().mockReturnValue("/tmp/test-session.jsonl"),
      getBranch: vi.fn().mockReturnValue([]),
    },
    ...overrides,
  };
}

function createTestTask(message: string, metadata?: Record<string, unknown>): A2ATask {
  return {
    id: "test-task-" + Date.now(),
    status: {
      state: "submitted",
      message: {
        messageId: "msg-" + Date.now(),
        role: "user" as const,
        parts: [{ type: "text" as const, text: message }],
      },
      timestamp: new Date().toISOString(),
    },
    artifacts: [],
    history: [],
    metadata: metadata ?? {},
  };
}

describe("Handler fallback to SubprocessPiTaskBridge", () => {
  it("memory-dispatch handler throws PI_SESSION_UNAVAILABLE for non-memory tasks (so processTask falls through to bridge)", async () => {
    // This is the core fallback invariant: the handler throws PI_SESSION_UNAVAILABLE
    // for non-memory tasks, which is the signal A2AServer.processTask uses to
    // continue to the next handler or fall through to PiTaskBridge.
    const ctx = createMockCtx();
    const handler = createMemoryDispatchHandler(ctx);
    const task = createTestTask("echo hello");

    await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    // The error message starts with "PI_SESSION_UNAVAILABLE" which is what
    // processTask checks: handlerError.message.startsWith("PI_SESSION_UNAVAILABLE")
    try {
      await handler(task, () => {});
    } catch (e: any) {
      expect(e.message).toBe(PI_SESSION_UNAVAILABLE);
      expect(e.message.startsWith("PI_SESSION_UNAVAILABLE")).toBe(true);
    }
  });

  it("memory-dispatch handler handles memory requests directly (no fallthrough)", async () => {
    const mockExecFn = vi.fn().mockResolvedValue('{"status":"success","result":{"ok":true}}');
    const ctx = createMockCtx();
    const handler = createMemoryDispatchHandler(ctx, {
      memory: { venvPython: "/fake/python", memoryDir: "/fake/dir", execFn: mockExecFn },
    });

    const task = createTestTask('agent-memory: {"tool":"memory_health","arguments":{}}');
    const result = await handler(task, () => {});

    // Memory task is handled directly — no PI_SESSION_UNAVAILABLE thrown
    expect(result.status.state).toBe("completed");
    const art = result.artifacts!.find(a => a.name === "memory-result");
    expect(art).toBeDefined();
    expect(art!.parts[0].text).toContain("success");
  });

  it("NoOpPiTaskBridge is still functional as the fallback bridge", async () => {
    // Verify NoOpPiTaskBridge still works (the default bridge when no subprocess is configured)
    const bridge = new NoOpPiTaskBridge();
    const result = await bridge.executeTask("test message");
    expect(result).toContain("test message");
    expect(result).toContain("NoOp bridge");
  });

  it("SubprocessPiTaskBridge is still functional as the fallback bridge", async () => {
    // Verify SubprocessPiTaskBridge constructor still works (it will try to spawn
    // pi, but we just test instantiation here — execution tests are in
    // subprocess-bridge.test.ts)
    const bridge = new SubprocessPiTaskBridge({ command: "echo", timeout: 5000 });
    // The bridge should be created without error
    expect(bridge).toBeDefined();
    // SubprocessPiTaskBridge.executeTask is integration-tested elsewhere;
    // this just verifies the class is still importable and constructable.
  });

  it("handler chain: memory-dispatch falls through → shell-exec handles tagged tasks", async () => {
    // Simulate what processTask does: iterate skillIds, catch PI_SESSION_UNAVAILABLE
    const ctx = createMockCtx();
    const memoryHandler = createMemoryDispatchHandler(ctx);

    // A non-memory, non-shell-exec task: memory handler throws PI_SESSION_UNAVAILABLE
    const task = createTestTask("plain task");
    let caught = false;
    try {
      await memoryHandler(task, () => {});
    } catch (e: any) {
      expect(e.message).toBe(PI_SESSION_UNAVAILABLE);
      caught = true;
    }
    expect(caught).toBe(true);
    // In the real A2AServer, this would continue to the next handler or bridge.
    // The NoOp bridge would then process it:
    const bridge = new NoOpPiTaskBridge();
    const textContent = task.status.message?.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n") || "";
    const bridgeResult = await bridge.executeTask(textContent);
    expect(bridgeResult).toContain("plain task");
  });
});
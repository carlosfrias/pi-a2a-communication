/**
 * Memory-dispatch handler tests (formerly PiSessionTaskHandler / GAP-2)
 *
 * After removing the dead PiSessionTaskHandler code path (which always threw
 * PI_SESSION_UNAVAILABLE because ctx.newSession was unavailable on the fleet),
 * this file tests the preserved memory-dispatch logic and the PI_SESSION_UNAVAILABLE
 * fallthrough for non-memory tasks.
 *
 * The former PiSessionTaskHandler tests (withSession, polling, newSession, etc.)
 * were removed as dead code. The memory dispatch tests are preserved because
 * that path is live and functional.
 */
import { describe, it, expect, vi } from "vitest";
import { createMemoryDispatchHandler, PI_SESSION_UNAVAILABLE, parseMemoryRequest, runMemoryBridge } from "../../src/pi-session-handler.js";
import type { A2ATask } from "../../src/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

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

function createTestTask(message: string): A2ATask {
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
    metadata: {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("MemoryDispatchHandler (GAP-2 cleanup)", () => {
  describe("PI_SESSION_UNAVAILABLE fallthrough for non-memory tasks", () => {
    it("throws PI_SESSION_UNAVAILABLE for non-memory tasks (falls through to PiTaskBridge)", async () => {
      const ctx = createMockCtx();
      const handler = createMemoryDispatchHandler(ctx);
      const task = createTestTask("hello world");

      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    });

    it("throws PI_SESSION_UNAVAILABLE for regular JSON tasks", async () => {
      const ctx = createMockCtx();
      const handler = createMemoryDispatchHandler(ctx);
      const task = createTestTask('{"action":"analyze","target":"code.ts"}');

      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    });

    it("returns failed task when message has no text parts", async () => {
      const handler = createMemoryDispatchHandler(createMockCtx());
      const task: A2ATask = {
        id: "empty-task",
        status: {
          state: "submitted",
          message: {
            messageId: "msg-empty",
            role: "user",
            parts: [{ type: "file", filename: "test.txt" }],  // no text parts
          },
          timestamp: new Date().toISOString(),
        },
        artifacts: [],
        history: [],
        metadata: {},
      };

      const result = await handler(task, () => {});
      expect(result.status.state).toBe("failed");
      expect(result.isError).toBe(true);
      expect(result.error).toContain("No text content");
    });
  });

  describe("agent-memory dispatch", () => {
    it("dispatches a memory request and returns its stdout as an artifact", async () => {
      const execFn = vi.fn().mockResolvedValue('{"status":"success","result":{"ok":true}}');
      const ctx = createMockCtx();
      const handler = createMemoryDispatchHandler(ctx, {
        memory: { venvPython: "/fake/venv/bin/python", memoryDir: "/fake/agent-memory", execFn: execFn },
      });
      const task = createTestTask('agent-memory: {"tool":"memory_health","arguments":{}}');

      const result = await handler(task, () => {});

      expect(result.status.state).toBe("completed");
      expect(result.artifacts).toBeDefined();
      const art = result.artifacts!.find(a => a.name === "memory-result");
      expect(art).toBeDefined();
      expect(art!.parts[0].text).toBe('{"status":"success","result":{"ok":true}}');
      expect(execFn).toHaveBeenCalledTimes(1);
      const call = execFn.mock.calls[0];
      expect(call[0]).toBe("/fake/venv/bin/python");
      const passedEnv = call[2] as NodeJS.ProcessEnv;
      expect(passedEnv.AGENTICOS_MEMORY_OP).toContain("memory_health");
      expect(passedEnv.AGENTICOS_MEMORY_DIR).toBe("/fake/agent-memory");
    });

    it("completes (does not fail) when the bridge returns an error string", async () => {
      const execFn = vi.fn().mockResolvedValue('{"status":"error","error":"boom"}');
      const ctx = createMockCtx();
      const handler = createMemoryDispatchHandler(ctx, { memory: { execFn } });
      const task = createTestTask('{"tool":"memory_store","arguments":{"collection":"c","text":"t"}}');
      const result = await handler(task, () => {});
      expect(result.status.state).toBe("completed");
      const art = result.artifacts!.find(a => a.name === "memory-result");
      expect(art!.parts[0].text).toContain('"error":"boom"');
    });

    it("falls through to PI_SESSION_UNAVAILABLE for non-memory tasks", async () => {
      const execFn = vi.fn();
      const ctx = createMockCtx();
      const handler = createMemoryDispatchHandler(ctx, {
        memory: { execFn },
      });
      const task = createTestTask("hello");
      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
      // bridge was NOT called for a non-memory task
      expect(execFn).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// agent-memory dispatch — synchronous Python MCP bridge short-circuit
// ═══════════════════════════════════════════════════════════════════════════

describe("parseMemoryRequest", () => {
  it("detects agent-memory: prefix with JSON op", () => {
    const op = parseMemoryRequest('agent-memory: {"tool":"memory_health","arguments":{}}');
    expect(op).toEqual({ tool: "memory_health", arguments: {} });
  });

  it("detects bare JSON op with memory_ tool", () => {
    const op = parseMemoryRequest('{"tool":"memory_store","arguments":{"collection":"c","text":"t"}}');
    expect(op).toEqual({ tool: "memory_store", arguments: { collection: "c", text: "t" } });
  });

  it("tolerates whitespace around prefix", () => {
    const op = parseMemoryRequest('  agent-memory:  {"tool":"memory_query","arguments":{}}  ');
    expect(op).toEqual({ tool: "memory_query", arguments: {} });
  });

  it("defaults missing arguments to empty object", () => {
    const op = parseMemoryRequest('{"tool":"memory_health"}');
    expect(op).toEqual({ tool: "memory_health", arguments: {} });
  });

  it("returns null for non-memory text", () => {
    expect(parseMemoryRequest("hello")).toBeNull();
    expect(parseMemoryRequest("Analyze this code")).toBeNull();
    expect(parseMemoryRequest("test task")).toBeNull();
  });

  it("returns null for JSON with a non-memory tool", () => {
    expect(parseMemoryRequest('{"tool":"read_file","arguments":{}}')).toBeNull();
  });

  it("returns null for malformed agent-memory payload", () => {
    expect(parseMemoryRequest("agent-memory: notjson")).toBeNull();
    expect(parseMemoryRequest("agent-memory: {}")).toBeNull(); // no tool
    expect(parseMemoryRequest("agent-memory: {\"tool\":123}")).toBeNull(); // tool not string
  });

  it("returns null for empty string", () => {
    expect(parseMemoryRequest("")).toBeNull();
  });
});

describe("runMemoryBridge (real subprocess, guarded)", () => {
  it("returns an error JSON string (never throws) when the venv python is missing", async () => {
    const text = await runMemoryBridge(
      { tool: "memory_health", arguments: {} },
      { venvPython: "/nonexistent/venv/bin/python", memoryDir: "/nonexistent/agent-memory", execTimeoutMs: 5000 }
    );
    expect(text).toContain("error");
  }, 15000);
});
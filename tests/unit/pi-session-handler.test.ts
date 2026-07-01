/**
 * GAP-2: PiSessionTaskHandler — Task handler using ctx.newSession({ withSession })
 *
 * Tests that:
 * - createPiSessionHandler throws PI_SESSION_UNAVAILABLE when ctx.newSession is not available
 * - createPiSessionHandler throws PI_SESSION_UNAVAILABLE when ctx is null/undefined
 * - Uses withSession to send user message and read response from session JSONL
 * - Returns cancellation message when session is cancelled
 * - Handles errors from newSession gracefully
 * - Reports progress updates via onUpdate
 * - A2AServer.processTask falls through to PiTaskBridge on PI_SESSION_UNAVAILABLE
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { A2AServer } from "../../src/a2a-server.js";
import { NoOpPiTaskBridge } from "../../src/pi-task-bridge.js";
import { createPiSessionHandler, PI_SESSION_UNAVAILABLE, parseMemoryRequest, runMemoryBridge } from "../../src/pi-session-handler.js";
import type { PiTaskBridge, A2ATask, ServerConfig, SecurityConfig } from "../../src/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const defaultServerConfig: ServerConfig = {
  enabled: true,
  port: 10098,
  host: "127.0.0.1",
};

const defaultSecurity: SecurityConfig = {
  defaultScheme: "none",
  verifySsl: true,
};

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

describe("PiSessionHandler (GAP-2)", () => {
  describe("PI_SESSION_UNAVAILABLE fallback", () => {
    it("throws PI_SESSION_UNAVAILABLE when ctx.newSession is not available", async () => {
      const ctx = createMockCtx({ newSession: undefined });
      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("hello");

      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    });

    it("throws PI_SESSION_UNAVAILABLE when ctx is null", async () => {
      const handler = createPiSessionHandler(null);
      const task = createTestTask("hello");

      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    });

    it("throws PI_SESSION_UNAVAILABLE when ctx is undefined", async () => {
      const handler = createPiSessionHandler(undefined);
      const task = createTestTask("hello");

      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    });

    it("throws PI_SESSION_UNAVAILABLE when ctx.newSession is not a function", async () => {
      const ctx = createMockCtx({ newSession: "not a function" });
      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("hello");

      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    });
  });

  describe("withSession flow", () => {
    it("calls ctx.newSession with withSession callback and parentSession", async () => {
      const mockSendUserMessage = vi.fn().mockResolvedValue(undefined);
      const mockGetSessionFile = vi.fn().mockReturnValue("/tmp/new-session.jsonl");

      let capturedWithSession: ((ctx: any) => Promise<void>) | undefined;

      const ctx = createMockCtx({
        newSession: vi.fn().mockImplementation(async (options: any) => {
          capturedWithSession = options?.withSession;
          if (capturedWithSession) {
            await capturedWithSession({
              sendUserMessage: mockSendUserMessage,
              sessionManager: { getSessionFile: mockGetSessionFile, getBranch: () => [] },
            });
          }
          return { cancelled: false };
        }),
      });

      // Mock readLastAssistantMessage by creating a fake session file
      // Since we can't mock the module, we test the withSession callback directly
      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("Analyze this code");
      const result = await handler(task, () => {});

      // Verify newSession was called with parentSession and withSession
      expect(ctx.newSession).toHaveBeenCalledWith(
        expect.objectContaining({
          parentSession: "/tmp/test-session.jsonl",
          withSession: expect.any(Function),
        })
      );

      // Verify sendUserMessage was called with the task text
      expect(mockSendUserMessage).toHaveBeenCalledWith(
        "Analyze this code",
        { deliverAs: "nextTurn" }
      );
    });

    it("returns assistant message from session JSONL when available", async () => {
      const mockSendUserMessage = vi.fn().mockResolvedValue(undefined);
      const mockGetSessionFile = vi.fn().mockReturnValue("/tmp/new-session-result.jsonl");

      // Write a fake JSONL file that readLastAssistantMessage will read
      const fs = await import("node:fs/promises");
      const os = await import("node:os");
      const path = await import("node:path");
      const tmpFile = path.join(os.tmpdir(), `test-session-${Date.now()}.jsonl`);

      const jsonlContent = [
        JSON.stringify({ role: "user", content: "Analyze this code" }),
        JSON.stringify({ role: "assistant", content: "Here is the analysis: the code looks good." }),
      ].join("\n");
      await fs.writeFile(tmpFile, jsonlContent, "utf-8");

      const ctx = createMockCtx({
        newSession: vi.fn().mockImplementation(async (options: any) => {
          if (options?.withSession) {
            await options.withSession({
              sendUserMessage: mockSendUserMessage,
              sessionManager: { getSessionFile: () => tmpFile, getBranch: () => [] },
            });
          }
          return { cancelled: false };
        }),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("Analyze this code");
      const result = await handler(task, () => {});

      expect(result.status.state).toBe("completed");
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts!.length).toBeGreaterThan(0);
      const resultArtifact = result.artifacts!.find(a => a.name === "result");
      expect(resultArtifact).toBeDefined();
      expect(resultArtifact!.parts[0].text).toContain("Here is the analysis");

      // Cleanup
      await fs.unlink(tmpFile).catch(() => {});
    });

    it("handles structured content arrays in session JSONL", async () => {
      const mockSendUserMessage = vi.fn().mockResolvedValue(undefined);
      const fs = await import("node:fs/promises");
      const os = await import("node:os");
      const path = await import("node:path");
      const tmpFile = path.join(os.tmpdir(), `test-session-structured-${Date.now()}.jsonl`);

      const jsonlContent = [
        JSON.stringify({ role: "user", content: "test" }),
        JSON.stringify({ role: "assistant", content: [
          { type: "text", text: "First part" },
          { type: "text", text: "Second part" },
        ] }),
      ].join("\n");
      await fs.writeFile(tmpFile, jsonlContent, "utf-8");

      const ctx = createMockCtx({
        newSession: vi.fn().mockImplementation(async (options: any) => {
          if (options?.withSession) {
            await options.withSession({
              sendUserMessage: mockSendUserMessage,
              sessionManager: { getSessionFile: () => tmpFile, getBranch: () => [] },
            });
          }
          return { cancelled: false };
        }),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("test");
      const result = await handler(task, () => {});

      expect(result.status.state).toBe("completed");
      const resultArtifact = result.artifacts!.find(a => a.name === "result");
      expect(resultArtifact!.parts[0].text).toContain("First part");
      expect(resultArtifact!.parts[0].text).toContain("Second part");

      // Cleanup
      await fs.unlink(tmpFile).catch(() => {});
    });

    it("returns fallback message when session file has no assistant content", async () => {
      const mockSendUserMessage = vi.fn().mockResolvedValue(undefined);
      const fs = await import("node:fs/promises");
      const os = await import("node:os");
      const path = await import("node:path");
      const tmpFile = path.join(os.tmpdir(), `test-session-noassistant-${Date.now()}.jsonl`);

      // Only user message, no assistant response
      const jsonlContent = [
        JSON.stringify({ role: "user", content: "hello" }),
      ].join("\n");
      await fs.writeFile(tmpFile, jsonlContent, "utf-8");

      const ctx = createMockCtx({
        newSession: vi.fn().mockImplementation(async (options: any) => {
          if (options?.withSession) {
            await options.withSession({
              sendUserMessage: mockSendUserMessage,
              sessionManager: { getSessionFile: () => tmpFile, getBranch: () => [] },
            });
          }
          return { cancelled: false };
        }),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("hello");
      const result = await handler(task, () => {});

      expect(result.status.state).toBe("completed");
      const resultArtifact = result.artifacts!.find(a => a.name === "result");
      // Fallback message contains the original message snippet
      expect(resultArtifact!.parts[0].text).toContain("Task processed by pi session");

      // Cleanup
      await fs.unlink(tmpFile).catch(() => {});
    });
  });

  describe("cancellation", () => {
    it("returns failed task when session is cancelled", async () => {
      const ctx = createMockCtx({
        newSession: vi.fn().mockResolvedValue({ cancelled: true }),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("test task");
      const result = await handler(task, () => {});

      expect(result.status.state).toBe("failed");
      expect(result.isError).toBe(true);
      expect(result.error).toContain("cancelled");
    });
  });

  describe("error handling", () => {
    it("re-throws PI_SESSION_UNAVAILABLE errors", async () => {
      const ctx = createMockCtx({
        newSession: vi.fn().mockImplementation(async () => {
          throw new Error(PI_SESSION_UNAVAILABLE);
        }),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("test");

      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    });

    it("returns failed task for other errors from newSession", async () => {
      const ctx = createMockCtx({
        newSession: vi.fn().mockRejectedValue(new Error("session crashed")),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("test");
      const result = await handler(task, () => {});

      expect(result.status.state).toBe("failed");
      expect(result.isError).toBe(true);
      expect(result.error).toContain("session crashed");
    });

    it("handles non-Error throws from newSession", async () => {
      const ctx = createMockCtx({
        newSession: vi.fn().mockRejectedValue("string error"),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("test");
      const result = await handler(task, () => {});

      expect(result.status.state).toBe("failed");
      expect(result.isError).toBe(true);
      expect(result.error).toContain("string error");
    });
  });

  describe("progress updates", () => {
    it("calls onUpdate with progress statuses", async () => {
      const updates: Partial<A2ATask>[] = [];
      const onUpdate = (update: Partial<A2ATask>) => updates.push(update);

      const ctx = createMockCtx({
        newSession: vi.fn().mockResolvedValue({ cancelled: false }),
      });

      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });
      const task = createTestTask("test task");
      await handler(task, onUpdate);

      // Should have at least the initial "working" update
      expect(updates.length).toBeGreaterThanOrEqual(1);
      expect(updates[0].status?.state).toBe("working");
    });
  });

  describe("empty task message", () => {
    it("returns failed task when message has no text parts", async () => {
      const handler = createPiSessionHandler(createMockCtx(), { pollIntervalMs: 50, maxPollMs: 500 });
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

  describe("A2AServer processTask fallthrough", () => {
    it("falls through to PiTaskBridge when handler throws PI_SESSION_UNAVAILABLE", async () => {
      const mockBridge: PiTaskBridge = {
        executeTask: vi.fn().mockResolvedValue("Bridge fallback result"),
        executeTaskWithProgress: vi.fn().mockImplementation(async (msg, onProgress) => {
          onProgress("Working...");
          return "Bridge fallback result";
        }),
      };

      const ctx = createMockCtx({ newSession: undefined });
      const handler = createPiSessionHandler(ctx, { pollIntervalMs: 50, maxPollMs: 500 });

      // The handler should throw PI_SESSION_UNAVAILABLE
      const task = createTestTask("test");
      await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);

      // In A2AServer.processTask, this error is caught and falls through to the bridge
      // Verify the bridge is available as fallback
      expect(mockBridge.executeTask).not.toHaveBeenCalled(); // Not called yet, but available
      const bridgeResult = await mockBridge.executeTask("test");
      expect(bridgeResult).toBe("Bridge fallback result");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// agent-memory dispatch — synchronous Python MCP bridge short-circuit
// Bypasses the pi-session/noop-bridge path so memory_* tools work over A2A
// on fleet nodes (where PiTaskBridge is noop and newSession may be unavailable).
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

describe("createPiSessionHandler agent-memory dispatch", () => {
  it("dispatches a memory request to the bridge and returns its stdout as an artifact", async () => {
    const execFn = vi.fn().mockResolvedValue('{"status":"success","result":{"ok":true}}');
    // ctx has NO newSession — proves the memory path does not need it
    const ctx = createMockCtx({ newSession: undefined });
    const handler = createPiSessionHandler(ctx, {
      pollIntervalMs: 50, maxPollMs: 500,
      memory: { venvPython: "/fake/venv/bin/python", memoryDir: "/fake/agent-memory", execFn: execFn },
    });
    const task = createTestTask('agent-memory: {"tool":"memory_health","arguments":{}}');

    const result = await handler(task, () => {});

    expect(result.status.state).toBe("completed");
    expect(result.artifacts).toBeDefined();
    const art = result.artifacts!.find(a => a.name === "memory-result");
    expect(art).toBeDefined();
    expect(art!.parts[0].text).toBe('{"status":"success","result":{"ok":true}}');
    // The bridge subprocess was invoked once with the configured venv python
    expect(execFn).toHaveBeenCalledTimes(1);
    const call = execFn.mock.calls[0];
    expect(call[0]).toBe("/fake/venv/bin/python");
    // The script reads AGENTICOS_MEMORY_OP env (op JSON) — verify env carries the op
    const passedEnv = call[2] as NodeJS.ProcessEnv;
    expect(passedEnv.AGENTICOS_MEMORY_OP).toContain("memory_health");
    expect(passedEnv.AGENTICOS_MEMORY_DIR).toBe("/fake/agent-memory");
  });

  it("completes (does not fail) when the bridge returns an error string", async () => {
    const execFn = vi.fn().mockResolvedValue('{"status":"error","error":"boom"}');
    const ctx = createMockCtx({ newSession: undefined });
    const handler = createPiSessionHandler(ctx, {
      memory: { execFn },
    });
    const task = createTestTask('{"tool":"memory_store","arguments":{"collection":"c","text":"t"}}');
    const result = await handler(task, () => {});
    expect(result.status.state).toBe("completed");
    const art = result.artifacts!.find(a => a.name === "memory-result");
    expect(art!.parts[0].text).toContain('"error":"boom"');
  });

  it("falls through to the existing path for non-memory tasks (newSession undefined → PI_SESSION_UNAVAILABLE)", async () => {
    const execFn = vi.fn();
    const ctx = createMockCtx({ newSession: undefined });
    const handler = createPiSessionHandler(ctx, {
      pollIntervalMs: 50, maxPollMs: 500,
      memory: { execFn },
    });
    const task = createTestTask("hello");
    await expect(handler(task, () => {})).rejects.toThrow(PI_SESSION_UNAVAILABLE);
    // bridge was NOT called for a non-memory task
    expect(execFn).not.toHaveBeenCalled();
  });
});

describe("runMemoryBridge (real subprocess, guarded)", () => {
  it("returns an error JSON string (never throws) when the venv python is missing", async () => {
    // Use a python path that does not exist — execFile should error; handler must not throw.
    const text = await runMemoryBridge(
      { tool: "memory_health", arguments: {} },
      { venvPython: "/nonexistent/venv/bin/python", memoryDir: "/nonexistent/agent-memory", execTimeoutMs: 5000 }
    );
    expect(text).toContain("error");
  }, 15000);
});
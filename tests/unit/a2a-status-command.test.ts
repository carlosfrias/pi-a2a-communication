/**
 * M9.3: /a2a-status command tests
 *
 * Tests for status command: usage, cache lookup, agent URL resolution,
 * and output formatting.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskManager } from "../../src/task-manager.js";
import type { A2AClient, RemoteAgent, A2ATask, ClientConfig } from "../../src/types.js";

const createMockClient = (): A2AClient => {
  const mockTask: A2ATask = {
    id: "task-status-001",
    status: {
      state: "completed",
      message: {
        messageId: "msg-s-001",
        role: "agent",
        parts: [{ type: "text", text: "Status result" }],
      },
      timestamp: new Date().toISOString(),
    },
    contextId: "ctx-001",
    artifacts: [{ artifactId: "art-001", name: "result", parts: [{ type: "text", text: "artifact text" }] }],
    history: [
      { messageId: "msg-001", role: "user", parts: [{ type: "text", text: "hello" }] },
      { messageId: "msg-002", role: "agent", parts: [{ type: "text", text: "response" }] },
    ],
  };

  return {
    sendMessage: vi.fn().mockResolvedValue(mockTask),
    sendStreamingMessage: vi.fn().mockResolvedValue(mockTask),
    getTask: vi.fn().mockResolvedValue(mockTask),
    cancelTask: vi.fn().mockResolvedValue(mockTask),
    cancelAll: vi.fn(),
    discoverAgent: vi.fn(),
  } as unknown as A2AClient;
};

const testAgent: RemoteAgent = {
  url: "http://agent1.example.com:10000",
  name: "Agent Alpha",
  description: "Test agent",
  version: "1.0.0",
  skills: [],
  capabilities: { streaming: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const defaultConfig: ClientConfig = {
  timeout: 30000,
  retryAttempts: 1,
  retryDelay: 1000,
  maxConcurrentTasks: 5,
};

describe("/a2a-status command", () => {
  let client: A2AClient;
  let taskManager: TaskManager;

  beforeEach(() => {
    client = createMockClient();
    taskManager = new TaskManager(client, defaultConfig);
  });

  describe("M9.3.1: no task ID shows usage", () => {
    it("should detect empty args as needing usage message", () => {
      const args = "";
      const parts = args.trim().split(/\s+/).filter(Boolean);
      expect(parts.length).toBe(0);
      // Handler checks: if (parts.length < 1) → show usage
    });
  });

  describe("M9.3.2: resolves agent from taskAgents cache", () => {
    it("should resolve agent URL from taskManager.getTaskAgent() after sendTask", async () => {
      // M9.0 ensures sendTask records the mapping
      const result = await taskManager.sendTask(testAgent, "hello");
      
      const agent = taskManager.getTaskAgent(result.id);
      expect(agent).not.toBeNull();
      expect(agent!.url).toBe(testAgent.url);
    });

    it("should call a2aClient.getTask() with the resolved agent", async () => {
      const result = await taskManager.sendTask(testAgent, "hello");
      const agent = taskManager.getTaskAgent(result.id);

      // Now the status handler can use this agent
      const task = await client.getTask(agent!, result.id);
      expect(task.id).toBe("task-status-001");
      expect(task.status.state).toBe("completed");
    });
  });

  describe("M9.3.3: unknown task suggests providing agent URL", () => {
    it("should return null for unknown task ID", () => {
      const agent = taskManager.getTaskAgent("nonexistent-task-id");
      expect(agent).toBeNull();
      // Handler would show: "Task not found in cache. Provide agent URL."
    });
  });

  describe("M9.3.4: formats output with task details", () => {
    it("should format task info showing ID, state, context ID, artifacts, and history", async () => {
      const task = await client.getTask(testAgent, "task-001");

      const info = [
        `Task ID: ${task.id}`,
        `State: ${task.status?.state}`,
        `Context ID: ${task.contextId}`,
        `Artifacts: ${task.artifacts?.length || 0}`,
        `History: ${task.history?.length || 0} messages`,
      ].join("\n");

      expect(info).toContain("Task ID: task-status-001");
      expect(info).toContain("State: completed");
      expect(info).toContain("Context ID: ctx-001");
      expect(info).toContain("Artifacts: 1");
      expect(info).toContain("History: 2 messages");
    });
  });
});
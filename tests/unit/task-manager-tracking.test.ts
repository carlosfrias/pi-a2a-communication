/**
 * M9.0: Task Manager tracking tests
 * 
 * Tests that sendTask, sendParallelTasks, and sendChainedTasks
 * record agent URLs in the taskAgents Map so /a2a-status can resolve them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskManager } from "../../src/task-manager.js";
import type { A2AClient } from "../../src/a2a-client.js";
import type { RemoteAgent, A2ATask, ClientConfig } from "../../src/types.js";

// Mock A2AClient
const createMockClient = (): A2AClient => {
  const mockTask: A2ATask = {
    id: "task-test-001",
    status: {
      state: "completed",
      message: {
        messageId: "msg-001",
        role: "agent",
        parts: [{ type: "text" as const, text: "Task completed successfully" }],
      },
      timestamp: new Date().toISOString(),
    },
    artifacts: [],
  };

  return {
    sendMessage: vi.fn().mockResolvedValue(mockTask),
    sendStreamingMessage: vi.fn().mockResolvedValue(mockTask),
    getTask: vi.fn().mockResolvedValue(mockTask),
    cancelTask: vi.fn().mockResolvedValue({
      ...mockTask,
      status: { ...mockTask.status, state: "canceled" },
    }),
    cancelAll: vi.fn(),
    discoverAgent: vi.fn(),
  } as unknown as A2AClient;
};

const defaultConfig: ClientConfig = {
  timeout: 30000,
  retryAttempts: 1,
  retryDelay: 1000,
  maxConcurrentTasks: 5,
};

const testAgent: RemoteAgent = {
  url: "http://localhost:10000",
  name: "Test Agent",
  description: "A test agent",
  version: "1.0.0",
  skills: [],
  capabilities: { streaming: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const testAgent2: RemoteAgent = {
  ...testAgent,
  url: "http://localhost:10001",
  name: "Test Agent 2",
};

describe("TaskManager tracking", () => {
  let client: A2AClient;
  let taskManager: TaskManager;

  beforeEach(() => {
    client = createMockClient();
    taskManager = new TaskManager(client, defaultConfig);
  });

  describe("sendTask() records agent URL", () => {
    it("M9.0.1: should record agent URL in taskAgents Map after sendTask", async () => {
      const result = await taskManager.sendTask(testAgent, "hello");

      // After sendTask, getTaskAgent should return the agent URL
      const agent = taskManager.getTaskAgent(result.id);
      expect(agent).not.toBeNull();
      expect(agent!.url).toBe(testAgent.url);
    });

    it("should record agent URL even when task fails", async () => {
      (client.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection refused")
      );

      const result = await taskManager.sendTask(testAgent, "will-fail");

      // Even on failure, the task should be tracked
      const agent = taskManager.getTaskAgent(result.id);
      expect(agent).not.toBeNull();
      expect(agent!.url).toBe(testAgent.url);
    });
  });

  describe("sendParallelTasks() records agent URLs", () => {
    it("M9.0.2: should record each task's agent URL after sendParallelTasks", async () => {
      const tasks = [
        { agent: testAgent, message: "task 1" },
        { agent: testAgent2, message: "task 2" },
      ];

      // Mock sendMessage to return different task IDs
      let callCount = 0;
      (client.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          callCount++;
          return Promise.resolve({
            id: `task-parallel-${callCount}`,
            status: {
              state: "completed",
              message: {
                messageId: `msg-p-${callCount}`,
                role: "agent",
                parts: [{ type: "text", text: `Result ${callCount}` }],
              },
              timestamp: new Date().toISOString(),
            },
            artifacts: [],
          } as A2ATask);
        }
      );

      const results = await taskManager.sendParallelTasks(tasks);

      // Each result should have its agent tracked
      expect(results).toHaveLength(2);
      
      for (let i = 0; i < results.length; i++) {
        const agent = taskManager.getTaskAgent(results[i].id);
        expect(agent).not.toBeNull();
        expect(agent!.url).toBe(tasks[i].agent.url);
      }
    });
  });

  describe("sendChainedTasks() records agent URLs", () => {
    it("M9.0.3: should record each step's agent URL after sendChainedTasks", async () => {
      const steps = [
        { agent: testAgent, message: "step 1" },
        { agent: testAgent2, message: "step 2 with {previous}" },
      ];

      // Mock sendMessage to return different task IDs per step
      let callCount = 0;
      (client.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          callCount++;
          return Promise.resolve({
            id: `task-chain-${callCount}`,
            status: {
              state: "completed",
              message: {
                messageId: `msg-c-${callCount}`,
                role: "agent",
                parts: [{ type: "text", text: `Chain result ${callCount}` }],
              },
              timestamp: new Date().toISOString(),
            },
            artifacts: [],
          } as A2ATask);
        }
      );

      const { results } = await taskManager.sendChainedTasks({
        steps,
        continueOnError: false,
      });

      expect(results).toHaveLength(2);

      for (let i = 0; i < results.length; i++) {
        const agent = taskManager.getTaskAgent(results[i].id);
        expect(agent).not.toBeNull();
        expect(agent!.url).toBe(steps[i].agent.url);
      }
    });
  });
});
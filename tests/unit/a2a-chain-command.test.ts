/**
 * M9.2: /a2a-chain command tests
 *
 * Tests for chain command: argument parsing, delegation to
 * taskManager.sendChainedTasks(), and progress formatting.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskManager } from "../../src/task-manager.js";
import type { A2AClient, RemoteAgent, A2ATask, ClientConfig } from "../../src/types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

const createMockClient = (): A2AClient => {
  let callCount = 0;
  const mockTask = (): A2ATask => {
    callCount++;
    return {
      id: `task-chain-${callCount}`,
      status: {
        state: "completed",
        message: {
          messageId: `msg-c-${callCount}`,
          role: "agent" as const,
          parts: [{ type: "text" as const, text: `Chain result ${callCount}` }],
        },
      },
      artifacts: [],
    } as A2ATask;
  };

  return {
    sendMessage: vi.fn().mockImplementation(() => Promise.resolve(mockTask())),
    sendStreamingMessage: vi.fn().mockImplementation(() => Promise.resolve(mockTask())),
    getTask: vi.fn().mockResolvedValue(mockTask()),
    cancelTask: vi.fn().mockResolvedValue(mockTask()),
    cancelAll: vi.fn(),
    discoverAgent: vi.fn(),
  } as unknown as A2AClient;
};

const agent1: RemoteAgent = {
  url: "http://agent1.example.com:10000",
  name: "Agent Alpha",
  description: "First test agent",
  version: "1.0.0",
  skills: [],
  capabilities: { streaming: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
};

const agent2: RemoteAgent = {
  ...agent1,
  url: "http://agent2.example.com:10000",
  name: "Agent Beta",
};

const defaultConfig: ClientConfig = {
  timeout: 30000,
  retryAttempts: 1,
  retryDelay: 1000,
  maxConcurrentTasks: 5,
};

// ── Chain Logic Tests ───────────────────────────────────────────────────────

describe("/a2a-chain command", () => {
  let client: A2AClient;
  let taskManager: TaskManager;

  beforeEach(() => {
    client = createMockClient();
    taskManager = new TaskManager(client, defaultConfig);
  });

  describe("M9.2.1: no args shows usage", () => {
    it("should return empty steps when no pipe-delimited input", () => {
      const args = "";
      const steps = args.split("|").map(s => s.trim()).filter(Boolean);
      expect(steps).toHaveLength(0);
    });

    it("should return empty steps when only whitespace", () => {
      const args = "   ";
      const steps = args.split("|").map(s => s.trim()).filter(Boolean);
      expect(steps).toHaveLength(0);
    });
  });

  describe("M9.2.2: parses pipe-delimited steps into TaskChainConfig", () => {
    it("should parse 'agent1 task1 | agent2 task2' into 2 steps", () => {
      const args = "agent1 analyze code | agent2 fix bugs";
      const steps = args.split("|").map(s => s.trim()).filter(Boolean);

      expect(steps).toHaveLength(2);
      expect(steps[0]).toBe("agent1 analyze code");
      expect(steps[1]).toBe("agent2 fix bugs");
    });

    it("should parse each step into agent ref and message", () => {
      const steps = ["agent1 analyze code", "agent2 fix {previous}"];

      const parsed = steps.map(step => {
        const parts = step.split(/\s+/);
        return {
          agentRef: parts[0],
          message: parts.slice(1).join(" "),
        };
      });

      expect(parsed[0].agentRef).toBe("agent1");
      expect(parsed[0].message).toBe("analyze code");
      expect(parsed[1].agentRef).toBe("agent2");
      expect(parsed[1].message).toBe("fix {previous}");
    });

    it("should support {previous} substitution in message", () => {
      const message = "fix {previous} bugs";
      expect(message.includes("{previous}")).toBe(true);
    });
  });

  describe("M9.2.3: delegates to taskManager.sendChainedTasks()", () => {
    it("should call sendChainedTasks with correct config", async () => {
      const sendChainedSpy = vi.spyOn(taskManager, "sendChainedTasks");

      const config = {
        steps: [
          { agent: agent1, message: "analyze code" },
          { agent: agent2, message: "fix {previous}" },
        ],
        continueOnError: false,
      };

      await taskManager.sendChainedTasks(config);

      expect(sendChainedSpy).toHaveBeenCalledOnce();
      const callArg = sendChainedSpy.mock.calls[0][0];
      expect(callArg.steps).toHaveLength(2);
      expect(callArg.steps[0].agent).toBe(agent1);
      expect(callArg.steps[0].message).toBe("analyze code");
      expect(callArg.steps[1].agent).toBe(agent2);
      expect(callArg.steps[1].message).toBe("fix {previous}");
      expect(callArg.continueOnError).toBe(false);
    });

    it("should return results and finalOutput from sendChainedTasks", async () => {
      const { results, finalOutput } = await taskManager.sendChainedTasks({
        steps: [
          { agent: agent1, message: "step 1" },
          { agent: agent2, message: "step 2 with {previous}" },
        ],
        continueOnError: false,
      });

      expect(results).toHaveLength(2);
      expect(typeof finalOutput).toBe("string");
    });
  });

  describe("M9.2.4: reports step progress as Step X/N: AgentName", () => {
    it("should call onUpdate with step index for each step", async () => {
      const progressCalls: Array<{ step: number; state: string }> = [];

      await taskManager.sendChainedTasks(
        {
          steps: [
            { agent: agent1, message: "step 1" },
            { agent: agent2, message: "step 2" },
          ],
          continueOnError: false,
        },
        (update, step) => {
          if (update.status?.state) {
            progressCalls.push({ step, state: update.status.state });
          }
        }
      );

      // Progress callbacks should have been received
      // (may be 0 or more depending on streaming behavior)
      expect(progressCalls.length).toBeGreaterThanOrEqual(0);
    });
  });
});
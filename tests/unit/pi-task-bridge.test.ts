/**
 * M10.0: PiTaskBridge interface tests
 *
 * Tests for the PiTaskBridge interface definition and NoOpPiTaskBridge.
 * These are the foundation for replacing the executePiTask() stub.
 */
import { describe, it, expect } from "vitest";
import { NoOpPiTaskBridge } from "../../src/pi-task-bridge.js";
import type { PiTaskBridge } from "../../src/pi-task-bridge.js";

describe("PiTaskBridge interface", () => {
  describe("M10.0.1: executeTask interface", () => {
    it("should define executeTask(message: string): Promise<string>", async () => {
      const bridge: PiTaskBridge = new NoOpPiTaskBridge();
      const result = await bridge.executeTask("hello");
      expect(typeof result).toBe("string");
      expect(result).toContain("hello");
    });
  });

  describe("M10.0.2: executeTaskWithProgress interface", () => {
    it("should define executeTaskWithProgress(message, onProgress): Promise<string>", async () => {
      const bridge: PiTaskBridge = new NoOpPiTaskBridge();
      const progressCalls: string[] = [];

      const result = await bridge.executeTaskWithProgress("hello", (progress) => {
        progressCalls.push(progress);
      });

      expect(typeof result).toBe("string");
      expect(result).toContain("hello");
      expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("M10.0.3: NoOpPiTaskBridge returns placeholder", () => {
    it("should return a placeholder string matching the original stub format", async () => {
      const bridge = new NoOpPiTaskBridge();
      const result = await bridge.executeTask("test message");
      expect(result).toContain("[A2A Task Result]");
      expect(result).toContain("test message");
      expect(result).toContain("NoOp bridge");
    });

    it("should return the same format for different messages", async () => {
      const bridge = new NoOpPiTaskBridge();
      const result1 = await bridge.executeTask("msg1");
      const result2 = await bridge.executeTask("msg2");
      expect(result1).toContain("msg1");
      expect(result2).toContain("msg2");
      expect(result1).not.toBe(result2);
    });
  });
});
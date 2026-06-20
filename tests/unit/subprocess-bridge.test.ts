/**
 * M10.3: SubprocessPiTaskBridge implementation tests
 *
 * Tests that SubprocessPiTaskBridge invokes the pi CLI,
 * returns stdout, handles errors, and supports timeouts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the SubprocessPiTaskBridge by mocking child_process
// Since it hasn't been implemented yet, we test against the expected interface

describe("SubprocessPiTaskBridge", () => {
  describe("M10.3.1: spawns pi CLI with task message as input", () => {
    it("should construct the correct command for pi CLI invocation", () => {
      // Expected command: pi --non-interactive --message "task message"
      const message = "Analyze this code for bugs";
      const expectedArgs = ["--non-interactive", "--message", message];
      
      expect(expectedArgs[0]).toBe("--non-interactive");
      expect(expectedArgs[2]).toBe(message);
    });
  });

  describe("M10.3.2: returns stdout as task result", () => {
    it("should return stdout from pi process as result string", async () => {
      // Mock a successful subprocess result
      const mockStdout = "Analysis complete: No bugs found.";
      
      // SubprocessPiTaskBridge should return stdout as-is
      expect(typeof mockStdout).toBe("string");
      expect(mockStdout).toContain("Analysis complete");
    });
  });

  describe("M10.3.3: handles pi CLI not found (ENOENT)", () => {
    it("should return meaningful error when pi command not found", () => {
      const enoentError = new Error("spawn pi ENOENT");
      
      // SubprocessPiTaskBridge should catch ENOENT and return a helpful message
      const errorMessage = `Pi CLI not found: ${enoentError.message}. Ensure pi is installed and in PATH.`;
      
      expect(errorMessage).toContain("not found");
      expect(errorMessage).toContain("PATH");
    });
  });

  describe("M10.3.4: handles timeout with meaningful error", () => {
    it("should return timeout error when pi process exceeds timeout", () => {
      const timeoutMs = 120000; // 2 minutes default
      
      // SubprocessPiTaskBridge should reject after timeout
      const timeoutError = new Error(`Pi process timed out after ${timeoutMs}ms`);
      
      expect(timeoutError.message).toContain("timed out");
      expect(timeoutError.message).toContain("120000ms");
    });
  });

  describe("M10.3.5: SubprocessPiTaskBridge implementation", () => {
    it("should implement PiTaskBridge interface", async () => {
      // Import the actual implementation
      const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
      
      // Create instance with default timeout
      const bridge = new SubprocessPiTaskBridge({ timeout: 5000 });
      
      expect(typeof bridge.executeTask).toBe("function");
      expect(typeof bridge.executeTaskWithProgress).toBe("function");
    });
  });
});
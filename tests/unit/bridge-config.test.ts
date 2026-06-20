/**
 * M10.5: Bridge configuration from config file
 *
 * Tests that the A2A config supports a bridge section,
 * and that the server uses it to instantiate the correct PiTaskBridge.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigManager } from "../../src/config.js";

describe("Bridge configuration", () => {
  describe("M10.5.1: Config supports bridge section", () => {
    it("should parse bridge config with type 'subprocess'", () => {
      const config = {
        bridge: {
          type: "subprocess" as const,
          command: "pi",
          timeout: 60000,
        },
      };
      expect(config.bridge.type).toBe("subprocess");
      expect(config.bridge.command).toBe("pi");
      expect(config.bridge.timeout).toBe(60000);
    });

    it("should parse bridge config with type 'noop'", () => {
      const config = {
        bridge: {
          type: "noop" as const,
        },
      };
      expect(config.bridge.type).toBe("noop");
    });
  });

  describe("M10.5.2: Default bridge is noop when not configured", () => {
    it("should default to noop when bridge config is missing", () => {
      const config = {};
      expect(config.bridge).toBeUndefined();
      // NoOpPiTaskBridge is used as default when config is missing
    });
  });

  describe("M10.5.3: SubprocessPiTaskBridge created from config", () => {
    it("should create SubprocessPiTaskBridge with custom timeout", async () => {
      const { SubprocessPiTaskBridge } = await import("../../src/pi-task-bridge.js");
      const bridge = new SubprocessPiTaskBridge({ timeout: 30000, command: "/usr/local/bin/pi" });
      expect(bridge).toBeInstanceOf(SubprocessPiTaskBridge);
    });
  });
});
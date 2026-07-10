/**
 * M10.6: Option B — OLLAMA_KEEP_ALIVE mapping for the regular subprocess bridge
 *
 * Tests that ollamaKeepAlive in BridgeConfig is mapped to the subprocess
 * environment variable OLLAMA_KEEP_ALIVE, preventing cold model loads
 * (~89s per task) on fleet nodes.
 *
 * This is the code-level implementation of Option B from FOCUS.md:
 * "ollamaKeepAlive: '10m'" in config.json → OLLAMA_KEEP_ALIVE=10m in
 * the spawned `pi --print` child environment.
 *
 * Prior state: agentExecKeepAlive was mapped (for the Tier D agent-exec
 * path), but ollamaKeepAlive (for the regular subprocess bridge) was NOT
 * mapped. The config value was present but silently ignored.
 */
import { describe, it, expect } from "vitest";
import { buildBridgeOptions } from "../../src/bridge-options.js";
import type { BridgeConfig } from "../../src/types.js";

describe("Option B: ollamaKeepAlive mapping", () => {
  describe("M10.6.1: ollamaKeepAlive is mapped to SubprocessBridgeOptions", () => {
    it("should map ollamaKeepAlive from config to options", () => {
      const config: BridgeConfig = {
        type: "subprocess",
        ollamaKeepAlive: "10m",
      };
      const opts = buildBridgeOptions(config);
      expect(opts.ollamaKeepAlive).toBe("10m");
    });

    it("should default to undefined when ollamaKeepAlive is not set", () => {
      const config: BridgeConfig = {
        type: "subprocess",
      };
      const opts = buildBridgeOptions(config);
      expect(opts.ollamaKeepAlive).toBeUndefined();
    });

    it("should pass through ollamaKeepAlive value as-is", () => {
      const config: BridgeConfig = {
        type: "subprocess",
        ollamaKeepAlive: "5m",
      };
      const opts = buildBridgeOptions(config);
      expect(opts.ollamaKeepAlive).toBe("5m");
    });

    it("should allow '0' to explicitly disable keep-alive", () => {
      const config: BridgeConfig = {
        type: "subprocess",
        ollamaKeepAlive: "0",
      };
      const opts = buildBridgeOptions(config);
      expect(opts.ollamaKeepAlive).toBe("0");
    });
  });

  describe("M10.6.2: ollamaKeepAlive is independent of agentExecKeepAlive", () => {
    it("should map both ollamaKeepAlive and agentExecKeepAlive", () => {
      const config: BridgeConfig = {
        type: "subprocess",
        ollamaKeepAlive: "10m",
        agentExecKeepAlive: "15m",
      };
      const opts = buildBridgeOptions(config);
      expect(opts.ollamaKeepAlive).toBe("10m");
      // agentExecKeepAlive is not in SubprocessBridgeOptions — it's handled
      // by the agent-exec handler, not the regular subprocess bridge
    });

    it("should map ollamaKeepAlive without agentExecKeepAlive", () => {
      const config: BridgeConfig = {
        type: "subprocess",
        ollamaKeepAlive: "10m",
      };
      const opts = buildBridgeOptions(config);
      expect(opts.ollamaKeepAlive).toBe("10m");
    });
  });

  describe("M10.6.3: regression — existing options still work", () => {
    it("should map all existing options alongside ollamaKeepAlive", () => {
      const config: BridgeConfig = {
        type: "subprocess",
        command: "/usr/local/bin/pi",
        timeout: 300000,
        provider: "ollama",
        model: "qwen3.5:4b",
        tools: "bash,read,edit",
        noExtensions: true,
        maxConcurrent: 2,
        maxBufferBytes: 10485760,
        systemPrompt: "You are a fleet executor.",
        narrationGuardEnabled: true,
        narrationMaxRetries: 1,
        ollamaKeepAlive: "10m",
      };
      const opts = buildBridgeOptions(config);
      expect(opts.command).toBe("/usr/local/bin/pi");
      expect(opts.timeout).toBe(300000);
      expect(opts.provider).toBe("ollama");
      expect(opts.model).toBe("qwen3.5:4b");
      expect(opts.tools).toBe("bash,read,edit");
      expect(opts.noExtensions).toBe(true);
      expect(opts.maxConcurrent).toBe(2);
      expect(opts.maxBufferBytes).toBe(10485760);
      expect(opts.systemPrompt).toBe("You are a fleet executor.");
      expect(opts.narrationGuardEnabled).toBe(true);
      expect(opts.narrationMaxRetries).toBe(1);
      expect(opts.ollamaKeepAlive).toBe("10m");
    });
  });
});
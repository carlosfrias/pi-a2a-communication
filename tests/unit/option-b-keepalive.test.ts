/**
 * Option B — OLLAMA_KEEP_ALIVE for the regular subprocess bridge.
 *
 * The agent-exec handler (Tier D) already sets OLLAMA_KEEP_ALIVE=10m so the
 * strong model stays resident across multi-step loops. But the REGULAR
 * subprocess bridge (buildBridgeOptions) does NOT — it inherits the fleet
 * default OLLAMA_KEEP_ALIVE=0, causing ~89s cold-start per task.
 *
 * Option B: add `ollamaKeepAlive` to BridgeConfig so the per-node config.json
 * can keep the model resident for ALL A2A tasks, not just agent-exec.
 */
import { describe, it, expect } from "vitest";
import { buildBridgeOptions } from "../../src/bridge-options.js";
import type { BridgeConfig } from "../../src/types.js";

describe("Option B — ollamaKeepAlive for regular subprocess bridge", () => {
  it("maps config.ollamaKeepAlive to env.OLLAMA_KEEP_ALIVE", () => {
    const config: BridgeConfig = {
      type: "subprocess",
      ollamaKeepAlive: "10m",
    };
    const opts = buildBridgeOptions(config);
    expect(opts.env).toBeDefined();
    expect(opts.env!.OLLAMA_KEEP_ALIVE).toBe("10m");
  });

  it("does not set env when ollamaKeepAlive is unset (no regression)", () => {
    const config: BridgeConfig = {
      type: "subprocess",
    };
    const opts = buildBridgeOptions(config);
    // env should be undefined or not contain OLLAMA_KEEP_ALIVE
    if (opts.env) {
      expect(opts.env.OLLAMA_KEEP_ALIVE).toBeUndefined();
    } else {
      expect(opts.env).toBeUndefined();
    }
  });

  it("supports '0' value to explicitly disable keep-alive", () => {
    const config: BridgeConfig = {
      type: "subprocess",
      ollamaKeepAlive: "0",
    };
    const opts = buildBridgeOptions(config);
    expect(opts.env).toBeDefined();
    expect(opts.env!.OLLAMA_KEEP_ALIVE).toBe("0");
  });

  it("preserves other bridge options alongside ollamaKeepAlive", () => {
    const config: BridgeConfig = {
      type: "subprocess",
      command: "pi",
      timeout: 300000,
      provider: "ollama",
      model: "qwen3.5:4b",
      tools: "bash,read,edit",
      noExtensions: true,
      systemPrompt: "You are a fleet executor.",
      ollamaKeepAlive: "10m",
    };
    const opts = buildBridgeOptions(config);
    expect(opts.command).toBe("pi");
    expect(opts.timeout).toBe(300000);
    expect(opts.provider).toBe("ollama");
    expect(opts.model).toBe("qwen3.5:4b");
    expect(opts.tools).toBe("bash,read,edit");
    expect(opts.noExtensions).toBe(true);
    expect(opts.systemPrompt).toBe("You are a fleet executor.");
    expect(opts.env?.OLLAMA_KEEP_ALIVE).toBe("10m");
  });
});
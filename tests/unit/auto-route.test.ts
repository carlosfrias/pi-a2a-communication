/**
 * Unit tests for auto-route.ts — fleet routing tier hints and resolution
 */

import { describe, it, expect } from "vitest";
import {
  isTierHint,
  resolveFleetTarget,
  resolveFleetTargets,
} from "../../dist/auto-route.js";
import type { ConfigManager } from "../../dist/config.js";
import type { RemoteAgent } from "../../dist/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

function makeConfigManager(agents: RemoteAgent[]): ConfigManager {
  return {
    getRemoteAgents: () => agents,
    getRemoteAgent: (urlOrName: string) =>
      agents.find(
        (a) => a.url === urlOrName || a.name === urlOrName || a.name.toLowerCase().replace(/\s+/g, "-") === urlOrName.toLowerCase()
      ) || null,
  } as unknown as ConfigManager;
}

const FLEET_AGENTS: RemoteAgent[] = [
  {
    name: "fnet1",
    description: "Fleet node fnet1 — RTX 4090, 64GB RAM, llama3:70b/qwen3:32b/mixtral:8x22b",
    url: "http://fnet1:10000",
    version: "0.3.0",
    skills: [{ id: "a2a-task-execution", name: "task-execution", description: "Execute tasks", tags: ["execution"] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet2",
    description: "Fleet node fnet2 — RTX 3090, 64GB RAM, llama3:70b/qwen3:32b/gemma4:27b",
    url: "http://fnet2:10000",
    version: "0.3.0",
    skills: [{ id: "a2a-task-execution", name: "task-execution", description: "Execute tasks", tags: ["execution"] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet3",
    description: "Fleet node fnet3 — RTX 4080, 32GB RAM, llama3:8b/qwen3:8b/gemma4:9b",
    url: "http://fnet3:10000",
    version: "0.3.0",
    skills: [{ id: "a2a-task-execution", name: "task-execution", description: "Execute tasks", tags: ["execution"] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet4",
    description: "Fleet node fnet4 — RTX 4070, 32GB RAM, llama3:8b/qwen3:8b/gemma4:4b",
    url: "http://fnet4:10000",
    version: "0.3.0",
    skills: [{ id: "a2a-task-execution", name: "task-execution", description: "Execute tasks", tags: ["execution"] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet5",
    description: "Fleet node fnet5 — RTX 4060, 16GB RAM, llama3:8b/qwen3:4b/gemma4:4b",
    url: "http://fnet5:10000",
    version: "0.3.0",
    skills: [{ id: "a2a-task-execution", name: "task-execution", description: "Execute tasks", tags: ["execution"] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet7",
    description: "Fleet node fnet7 — 2x RTX 3090, 128GB RAM, llama3:70b/qwen3:32b/mixtral:8x22b/gemma4:27b",
    url: "http://fnet7:10000",
    version: "0.3.0",
    skills: [{ id: "a2a-task-execution", name: "task-execution", description: "Execute tasks", tags: ["execution"] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("isTierHint", () => {
  it("recognizes all tier hints (case-insensitive)", () => {
    expect(isTierHint("auto")).toBe(true);
    expect(isTierHint("AUTO")).toBe(true);
    expect(isTierHint("any")).toBe(true);
    expect(isTierHint("executor")).toBe(true);
    expect(isTierHint("strong")).toBe(true);
    expect(isTierHint("medium")).toBe(true);
    expect(isTierHint("weak")).toBe(true);
    expect(isTierHint("light")).toBe(true);
  });

  it("rejects URLs", () => {
    expect(isTierHint("http://fnet1:10000")).toBe(false);
    expect(isTierHint("https://example.com:8080")).toBe(false);
  });

  it("rejects unknown strings", () => {
    expect(isTierHint("fnet1")).toBe(false);
    expect(isTierHint("random-node")).toBe(false);
  });
});

describe("resolveFleetTarget", () => {
  const configManager = makeConfigManager(FLEET_AGENTS);

  it("passes through explicit URLs unchanged", () => {
    const result = resolveFleetTarget("http://fnet1:10000", configManager);
    expect(result.url).toBe("http://fnet1:10000");
    expect(result.source).toBe("registry");
    expect(result.hint).toBe("explicit");
  });

  it("resolves 'auto' to a healthy fleet node", () => {
    const result = resolveFleetTarget("auto", configManager);
    expect(result.url).toMatch(/^http:\/\/fnet\d+:10000$/);
    expect(result.source).toBe("registry");
  });

  it("resolves 'executor' to a strong node", () => {
    const result = resolveFleetTarget("executor", configManager);
    expect(["http://fnet7:10000", "http://fnet1:10000", "http://fnet2:10000"]).toContain(result.url);
    expect(result.tier).toBe("strong");
  });

  it("resolves 'strong' to a strong node", () => {
    const result = resolveFleetTarget("strong", configManager);
    expect(["http://fnet7:10000", "http://fnet1:10000", "http://fnet2:10000"]).toContain(result.url);
    expect(result.tier).toBe("strong");
  });

  it("resolves 'weak' to a weak or medium node", () => {
    const result = resolveFleetTarget("weak", configManager);
    expect(result.url).toMatch(/^http:\/\/fnet\d+:10000$/);
    expect(result.tier).toMatch(/^(weak|medium)$/);
  });

  it("resolves 'medium' to a medium node", () => {
    const result = resolveFleetTarget("medium", configManager);
    expect(result.url).toMatch(/^http:\/\/fnet\d+:10000$/);
    expect(result.tier).toBe("medium");
  });

  it("resolves node names from registry", () => {
    const result = resolveFleetTarget("fnet3", configManager);
    expect(result.url).toBe("http://fnet3:10000");
    expect(result.source).toBe("registry");
  });

  it("falls back to fnet3 for unknown names", () => {
    const result = resolveFleetTarget("unknown-node-xyz", configManager);
    expect(result.url).toBe("http://fnet3:10000");
    expect(result.source).toBe("fallback");
  });

  it("falls back to fnet3 when no agents are registered", () => {
    const emptyConfig = makeConfigManager([]);
    const result = resolveFleetTarget("auto", emptyConfig);
    expect(result.url).toBe("http://fnet3:10000");
    expect(result.source).toBe("fallback");
  });

  it("prefers strong nodes for 'auto' hint", () => {
    const result = resolveFleetTarget("auto", configManager);
    expect(["http://fnet7:10000", "http://fnet1:10000", "http://fnet2:10000"]).toContain(result.url);
  });

  it("skips unhealthy agents", () => {
    const unhealthyAgents = FLEET_AGENTS.map((a, i) =>
      i === 0 ? { ...a, healthStatus: "unhealthy" as const } : a
    );
    const config = makeConfigManager(unhealthyAgents);
    const result = resolveFleetTarget("strong", config);
    expect(result.url).not.toBe("http://fnet1:10000");
    expect(["http://fnet7:10000", "http://fnet2:10000"]).toContain(result.url);
  });
});

describe("resolveFleetTargets", () => {
  const configManager = makeConfigManager(FLEET_AGENTS);

  it("resolves all agent_urls in an array of steps", () => {
    const steps = [
      { agent_url: "executor", message: "heavy task" },
      { agent_url: "weak", message: "light task" },
      { agent_url: "http://fnet3:10000", message: "explicit task" },
    ];
    const resolved = resolveFleetTargets(steps, configManager);

    expect(["http://fnet7:10000", "http://fnet1:10000", "http://fnet2:10000"]).toContain(resolved[0].agent_url);
    expect(resolved[0].resolved.hint).toBe("executor");
    expect(resolved[1].agent_url).toMatch(/^http:\/\/fnet\d+:10000$/);
    expect(resolved[2].agent_url).toBe("http://fnet3:10000");
    expect(resolved[2].resolved.hint).toBe("explicit");
  });
});

describe("tier classification", () => {
  it("classifies fnet7 as strong (2x3090, 128GB)", () => {
    const config = makeConfigManager(FLEET_AGENTS);
    const result = resolveFleetTarget("strong", config);
    expect(result.tier).toBe("strong");
  });

  it("classifies fnet5 as weak (4060, 16GB)", () => {
    const fnet5only = makeConfigManager([FLEET_AGENTS.find((a) => a.name === "fnet5")!]);
    const result = resolveFleetTarget("auto", fnet5only);
    expect(result.tier).toBe("weak");
  });

  it("classifies fnet3 as medium (4080, 32GB)", () => {
    const fnet3only = makeConfigManager([FLEET_AGENTS.find((a) => a.name === "fnet3")!]);
    const result = resolveFleetTarget("auto", fnet3only);
    expect(result.tier).toBe("medium");
  });
});
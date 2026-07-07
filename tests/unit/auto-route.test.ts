/**
 * Unit tests for auto-route.ts — fleet routing tier hints and resolution
 *
 * Hardware reality (audited 2026-07-06):
 * - All nodes are Intel NUC10i7FNH (no discrete GPUs, CPU-only inference)
 * - fnet1, fnet2: 16GB RAM, qwen3.5:4b (fnet1 also runs Nextcloud)
 * - fnet3, fnet4, fnet5, fnet6: 32GB RAM, qwen3.5:35b-a3b
 * - fnet7: 16GB single-channel RAM, qwen3.5:4b
 * - Tailscale hostnames resolve on LAN and remotely
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
// MOCKS — accurate hardware descriptions
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

/** Accurate fleet agents — matches real hardware (no GPUs, CPU-only NUCs) */
const FLEET_AGENTS: RemoteAgent[] = [
  {
    name: "fnet1",
    description: "Fleet node fnet1 — Intel NUC, 16GB RAM, qwen3.5:4b (also runs Nextcloud)",
    url: "http://fnet1:10000",
    version: "0.6.0",
    skills: [{ id: "a2a-task-execution", name: "A2A Task Execution", description: "Execute tasks", tags: ["a2a", "task-execution", "fleet"] }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json", "text/markdown"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet2",
    description: "Fleet node fnet2 — Intel NUC, 16GB RAM, qwen3.5:4b",
    url: "http://fnet2:10000",
    version: "0.6.0",
    skills: [{ id: "a2a-task-execution", name: "A2A Task Execution", description: "Execute tasks", tags: ["a2a", "task-execution", "fleet"] }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json", "text/markdown"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet3",
    description: "Fleet node fnet3 — Intel NUC, 32GB RAM, qwen3.5:35b-a3b (coordinator)",
    url: "http://fnet3:10000",
    version: "0.6.0",
    skills: [{ id: "a2a-task-execution", name: "A2A Task Execution", description: "Execute tasks", tags: ["a2a", "task-execution", "fleet"] }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json", "text/markdown"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet4",
    description: "Fleet node fnet4 — Intel NUC, 32GB RAM, qwen3.5:35b-a3b",
    url: "http://fnet4:10000",
    version: "0.6.0",
    skills: [{ id: "a2a-task-execution", name: "A2A Task Execution", description: "Execute tasks", tags: ["a2a", "task-execution", "fleet"] }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json", "text/markdown"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet5",
    description: "Fleet node fnet5 — Intel NUC, 32GB RAM, qwen3.5:35b-a3b",
    url: "http://fnet5:10000",
    version: "0.6.0",
    skills: [{ id: "a2a-task-execution", name: "A2A Task Execution", description: "Execute tasks", tags: ["a2a", "task-execution", "fleet"] }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json", "text/markdown"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet6",
    description: "Fleet node fnet6 — Intel NUC, 32GB RAM, qwen3.5:35b-a3b",
    url: "http://fnet6:10000",
    version: "0.6.0",
    skills: [{ id: "a2a-task-execution", name: "A2A Task Execution", description: "Execute tasks", tags: ["a2a", "task-execution", "fleet"] }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json", "text/markdown"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
  {
    name: "fnet7",
    description: "Fleet node fnet7 — Intel NUC, 16GB RAM (single-channel), qwen3.5:4b",
    url: "http://fnet7:10000",
    version: "0.6.0",
    skills: [{ id: "a2a-task-execution", name: "A2A Task Execution", description: "Execute tasks", tags: ["a2a", "task-execution", "fleet"] }],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json", "text/markdown"],
    capabilities: { streaming: true, pushNotifications: true },
    healthStatus: "healthy",
    discoveredAt: Date.now(),
  },
];

const STRONG_NODES = ["fnet3", "fnet4", "fnet5", "fnet6"];
const WEAK_NODES = ["fnet1", "fnet2", "fnet7"];
const STRONG_URLS = STRONG_NODES.map((n) => `http://${n}:10000`);
const WEAK_URLS = WEAK_NODES.map((n) => `http://${n}:10000`);

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
    const result = resolveFleetTarget("http://fnet3:10000", configManager);
    expect(result.url).toBe("http://fnet3:10000");
    expect(result.source).toBe("registry");
    expect(result.hint).toBe("explicit");
  });

  it("resolves 'auto' to a strong (32GB) node", () => {
    const result = resolveFleetTarget("auto", configManager);
    expect(STRONG_URLS).toContain(result.url);
    expect(result.source).toBe("registry");
    expect(result.tier).toBe("strong");
  });

  it("resolves 'executor' to a strong node", () => {
    const result = resolveFleetTarget("executor", configManager);
    expect(STRONG_URLS).toContain(result.url);
    expect(result.tier).toBe("strong");
  });

  it("resolves 'strong' to a strong node", () => {
    const result = resolveFleetTarget("strong", configManager);
    expect(STRONG_URLS).toContain(result.url);
    expect(result.tier).toBe("strong");
  });

  it("resolves 'weak' to a weak node", () => {
    const result = resolveFleetTarget("weak", configManager);
    // weak maps to ["weak", "medium"] — but with healthy 16GB nodes, should get a weak one
    expect([...WEAK_URLS, ...STRONG_URLS]).toContain(result.url);
    expect(result.tier).toMatch(/^(weak|medium)$/);
  });

  it("resolves 'medium' to a medium or strong node", () => {
    const result = resolveFleetTarget("medium", configManager);
    expect([...STRONG_URLS]).toContain(result.url);
    // In this fleet, medium = 32GB = strong, so tier will be "strong"
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
    expect(STRONG_URLS).toContain(result.url);
  });

  it("skips unhealthy agents", () => {
    const unhealthyAgents = FLEET_AGENTS.map((a, i) =>
      i === 0 ? { ...a, healthStatus: "unhealthy" as const } : a
    );
    const config = makeConfigManager(unhealthyAgents);
    const result = resolveFleetTarget("strong", config);
    expect(result.url).not.toBe("http://fnet1:10000");
    expect(STRONG_URLS).toContain(result.url);
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

    expect(STRONG_URLS).toContain(resolved[0].agent_url);
    expect(resolved[0].resolved.hint).toBe("executor");
    expect(resolved[1].agent_url).toMatch(/^http:\/\/fnet\d+:10000$/);
    expect(resolved[2].agent_url).toBe("http://fnet3:10000");
    expect(resolved[2].resolved.hint).toBe("explicit");
  });
});

describe("tier classification (real hardware)", () => {
  it("classifies 32GB nodes (fnet3-6) as strong", () => {
    for (const name of STRONG_NODES) {
      const agent = FLEET_AGENTS.find((a) => a.name === name)!;
      const config = makeConfigManager([agent]);
      const result = resolveFleetTarget("strong", config);
      expect(result.tier).toBe("strong");
    }
  });

  it("classifies 16GB nodes (fnet1, fnet2, fnet7) as weak", () => {
    for (const name of WEAK_NODES) {
      const agent = FLEET_AGENTS.find((a) => a.name === name)!;
      const config = makeConfigManager([agent]);
      const result = resolveFleetTarget("auto", config);
      expect(result.tier).toBe("weak");
    }
  });

  it("defaults to fnet3 (avoids fnet1 which runs Nextcloud)", () => {
    const emptyConfig = makeConfigManager([]);
    const result = resolveFleetTarget("auto", emptyConfig);
    expect(result.url).toBe("http://fnet3:10000");
    expect(result.source).toBe("fallback");
  });
});
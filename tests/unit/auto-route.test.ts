/**
 * Unit tests for auto-route.ts — fleet routing tier hints and resolution
 *
 * Hardware reality (audited 2026-07-06/07):
 * - fnet1: Intel i5-6400 (desktop), 16GB RAM, no GPU (Nextcloud host)
 * - fnet2: Intel i7-8700 (desktop), 16GB RAM, GTX 660 (driver broken, CPU-only)
 * - fnet3-fnet6: Intel i7-10710U (NUC10), 32GB RAM, Intel UHD 620 (CPU-only)
 * - fnet7: Intel i7-10710U (NUC10), 16GB RAM single-channel, Intel UHD 620 (CPU-only)
 * - No discrete GPUs exist in the fleet — all inference is CPU-only
 * - Tailscale hostnames resolve on LAN and remotely
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isTierHint,
  resolveFleetTarget,
  resolveFleetTargets,
  _setCliExecutorForTest,
} from "../../dist/auto-route.js";
import type { ConfigManager } from "../../dist/config.js";
import type { RemoteAgent } from "../../dist/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS — accurate hardware descriptions
// ═══════════════════════════════════════════════════════════════════════════

function makeConfigManager(agents: RemoteAgent[]): ConfigManager {
  return {
    getRemoteAgents: () => agents,
    getRemoteAgent: (urlOrName: string) => {
      const found =
        agents.find(
          (a) =>
            a.url === urlOrName ||
            a.name === urlOrName ||
            a.name.toLowerCase().replace(/\s+/g, "-") === urlOrName.toLowerCase()
        ) || null;
      if (found) (found as any).lastUsedAt = Date.now();
      return found;
    },
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

// By default, disable the real fleet-resource-manager CLI so registry-path tests
// exercise the registry. CLI-strategy tests override the executor inside each
// `it` body (after this beforeEach runs).
beforeEach(() =>
  _setCliExecutorForTest(() => {
    throw new Error("CLI disabled for registry-path tests");
  })
);
afterEach(() => _setCliExecutorForTest(null));

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
    expect(result.source).toBe("fallback");
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

// ═══════════════════════════════════════════════════════════════════════════
// AC-SAT-2: LRU rotation (the "always fnet3" bug fix)
// ═══════════════════════════════════════════════════════════════════════════

describe("LRU rotation (AC-SAT-2)", () => {
  it("rotates among same-tier healthy nodes instead of always picking the first", () => {
    // Two strong nodes, both healthy, no prior usage
    const strong = FLEET_AGENTS.filter((a) => ["fnet3", "fnet4"].includes(a.name));
    const config = makeConfigManager(strong);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const r = resolveFleetTarget("auto", config);
      seen.add(r.url);
    }
    // Should have touched BOTH nodes (rotation), not just fnet3
    expect(seen.size).toBeGreaterThanOrEqual(2);
    expect(seen.has("http://fnet3:10000")).toBe(true);
    expect(seen.has("http://fnet4:10000")).toBe(true);
  });

  it("cycles across all four strong nodes over repeated calls", () => {
    const strong = FLEET_AGENTS.filter((a) =>
      ["fnet3", "fnet4", "fnet5", "fnet6"].includes(a.name)
    );
    const config = makeConfigManager(strong);
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      seen.add(resolveFleetTarget("auto", config).url);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-SAT-3: CLI is the A2A router's first strategy (saturation-aware)
// ═══════════════════════════════════════════════════════════════════════════

describe("CLI strategy (AC-SAT-3)", () => {
  afterEach(() => _setCliExecutorForTest(null));

  it("returns the CLI result as source:cli when the CLI resolves", () => {
    _setCliExecutorForTest(() =>
      JSON.stringify({
        url: "http://a2a-fnet4.svc.friasc.com:10000",
        node_id: "fnet4",
        tier: "strong",
        hint: "auto",
        source: "cli",
        saturation: { ram_pct: 40, cpu_pct: 8, active_tasks: 0, status: "healthy" },
        score: 0.73,
        degraded_tier: false,
        skipped: [{ node_id: "fnet3", reason: "critical", ram_pct: 91, score: 0.0 }],
        announce: null,
        refuse: false,
      })
    );
    const config = makeConfigManager(FLEET_AGENTS);
    const result = resolveFleetTarget("auto", config);
    expect(result.source).toBe("cli");
    expect(result.url).toBe("http://a2a-fnet4.svc.friasc.com:10000");
    expect(result.tier).toBe("strong");
  });

  it("falls through to registry + warns (LOUD) when the CLI throws", () => {
    _setCliExecutorForTest(() => {
      throw new Error("spawn fleet-resource-manager ENOENT");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = makeConfigManager(FLEET_AGENTS);
    const result = resolveFleetTarget("auto", config);
    expect(result.source).toBe("registry");
    expect(STRONG_URLS).toContain(result.url);
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toMatch(/auto-route.*failed|falling back/i);
    warnSpy.mockRestore();
  });

  it("falls through when the CLI refuses (no eligible node)", () => {
    _setCliExecutorForTest(() =>
      JSON.stringify({
        url: null,
        node_id: null,
        tier: null,
        hint: "executor",
        source: "cli",
        saturation: null,
        score: null,
        degraded_tier: true,
        skipped: [],
        announce: "A2A route('executor'): no eligible non-saturated fleet node.",
        refuse: true,
      })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = makeConfigManager(FLEET_AGENTS);
    const result = resolveFleetTarget("executor", config);
    expect(result.source).toBe("registry");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("falls through (LOUD) when every binary candidate is ENOENT (AC-SAT-3)", () => {
    // Simulate the pi process PATH lacking /usr/local/bin: the bare-name candidate
    // ENOENTs, and so do the absolute fallbacks (none installed) -> fall to registry.
    _setCliExecutorForTest(() => {
      const e = new Error("spawn fleet-resource-manager ENOENT") as NodeJS.ErrnoException;
      e.code = "ENOENT";
      throw e;
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = makeConfigManager(FLEET_AGENTS);
    const result = resolveFleetTarget("auto", config);
    expect(result.source).toBe("registry");
    expect(warnSpy).toHaveBeenCalled();
    expect((warnSpy.mock.calls[0][0] as string)).toMatch(/not found in candidates/i);
    warnSpy.mockRestore();
  });
});
/**
 * Auto-Route — Automatic fleet routing for A2A tool calls
 *
 * Resolves agent_url hints ("auto", "executor", "strong", "weak", "any")
 * to concrete fleet node URLs without the model needing to know fleet
 * topology. This eliminates ~15K tokens of "check fleet resources" reads
 * per fleet-related request.
 *
 * Resolution order:
 * 1. fleet-resource-manager CLI (if available — has health data)
 * 2. ConfigManager agents registry (in-memory, health-checked)
 * 3. Hardcoded fallback (fnet3 — 32GB coordinator node, avoids fnet1
 *    which runs Nextcloud)
 *
 * Tier classification is RAM-based (no discrete GPUs in this fleet):
 *   - strong/executor: 32GB RAM (can run qwen3.5:35b-a3b)
 *   - medium: 32GB RAM (same hardware, but available for lighter tasks)
 *   - weak/light: 16GB RAM (only qwen3.5:4b, single-channel on fnet7)
 *
 * All hostnames use Tailscale MagicDNS (e.g. "fnet3" → 100.x.x.x)
 * which resolves on LAN and remotely.
 */

import { execFileSync } from "node:child_process";
import type { ConfigManager } from "./config.js";
import type { RemoteAgent } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// CLI EXECUTOR (test-injectable)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subprocess executor for the fleet-resource-manager CLI. Injectable so unit
 * tests can mock the CLI without spawning processes. Returns stdout string.
 */
export type CliExecutor = (
  args: string[],
  opts: { timeout: number; encoding: string }
) => string;

let _cliExecutor: CliExecutor | null = null;

/** Test hook: override the CLI executor (pass null to restore default). */
export function _setCliExecutorForTest(fn: CliExecutor | null): void {
  _cliExecutor = fn;
}

const FRM_BIN = process.env.PI_FRM_BIN || "fleet-resource-manager";
const FRM_CLI_TIMEOUT_MS = Number(process.env.PI_FRM_CLI_TIMEOUT_MS || 6000);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Tier hints the model can pass as agent_url instead of a full URL. */
export type TierHint = "auto" | "any" | "executor" | "strong" | "medium" | "weak" | "light";

/** All recognized hint strings (case-insensitive matching). */
const TIER_HINTS: Record<string, TierHint> = {
  auto: "auto",
  any: "any",
  executor: "executor",
  strong: "strong",
  heavy: "strong",
  big: "strong",
  medium: "medium",
  mid: "medium",
  weak: "weak",
  light: "light",
  small: "light",
};

/** Internal tier classification derived from agent descriptions. */
type NodeTier = "strong" | "medium" | "weak";

/**
 * Resolved routing result.
 */
export interface ResolvedTarget {
  /** The resolved URL (e.g. "http://fnet3:10000") */
  url: string;
  /** How the URL was resolved */
  source: "cli" | "registry" | "fallback";
  /** The tier hint that was resolved (for logging) */
  hint: string;
  /** The agent name if resolved from registry */
  agentName?: string;
  /** The resolved tier if classified */
  tier?: NodeTier;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify a node's tier from its description and name.
 *
 * This fleet has NO discrete GPUs — all nodes use Intel integrated graphics.
 * Classification is RAM-based:
 *   - strong: 32GB+ RAM (can run qwen3.5:35b-a3b for agentic work)
 *   - medium: 32GB RAM (same pool, for lighter/medium tasks)
 *   - weak: <20GB RAM (only qwen3.5:4b; fnet7 is single-channel 16GB)
 *
 * Description patterns are tolerant — they may contain old or new
 * descriptions, so we extract RAM numbers and fall back gracefully.
 */
function classifyTier(agent: RemoteAgent): NodeTier {
  const desc = (agent.description || "").toLowerCase();
  const name = (agent.name || "").toLowerCase();

  // RAM-based classification (most reliable signal)
  const ramMatch = desc.match(/(\d+)\s*gb\s*ram/);
  const ramGb = ramMatch ? parseInt(ramMatch[1], 10) : 0;

  // Also check for RAM in parentheses like "fnet3 (32GB)"
  if (ramGb === 0) {
    const parenRam = desc.match(/\((\d+)\s*gb\)/);
    if (parenRam) {
      return parseInt(parenRam[1], 10) >= 32 ? "strong" : "weak";
    }
  }

  // Strong: 32GB+ RAM (executor-capable, runs 35b models)
  if (ramGb >= 32) {
    return "strong";
  }

  // Weak: <20GB RAM (only 4b models; includes fnet7's single-channel 16GB)
  if (ramGb > 0 && ramGb < 20) {
    return "weak";
  }

  // Name-based fallback for known nodes
  const strongNodes = ["fnet3", "fnet4", "fnet5", "fnet6"];
  const weakNodes = ["fnet1", "fnet2", "fnet7"];

  if (strongNodes.some((n) => name.includes(n))) return "strong";
  if (weakNodes.some((n) => name.includes(n))) return "weak";

  // Unknown specs default to medium (safe middle ground)
  return "medium";
}

/**
 * Map a tier hint to the desired NodeTier(s) for matching.
 * For "auto"/"any": prefer strong (executor-capable) nodes.
 * For "executor"/"strong": only strong nodes.
 * For "medium": only medium nodes (same hardware as strong, less contested).
 * For "weak"/"light": prefer weak, fall back to medium.
 */
function hintToTiers(hint: TierHint): NodeTier[] {
  switch (hint) {
    case "strong":
    case "executor":
      return ["strong"];
    case "medium":
      return ["medium", "strong"]; // medium OK, prefer medium
    case "weak":
    case "light":
      return ["weak", "medium"]; // prefer weak, fall back to medium
    case "any":
    case "auto":
    default:
      return ["strong", "medium", "weak"]; // prefer stronger
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default fallback URL when no agents are available.
 * fnet3 is the coordinator node (32GB, qwen3.5:35b-a3b) and avoids fnet1
 * which runs Nextcloud alongside A2A.
 */
const DEFAULT_FALLBACK_URL = "http://fnet3:10000";

/**
 * Try resolving via fleet-resource-manager CLI (`a2a-route`).
 *
 * This is the FIRST resolution strategy: it has live per-node saturation data
 * (RAM/CPU/active_tasks from health-monitor) and skips saturated/stale/critical
 * nodes (AC-SAT-1, FRM-10). Uses execFileSync with an argv array (no shell
 * interpolation) to avoid injection. On any failure/timeout/parse-error, emits
 * a LOUD warning (HE-2) and falls through to registry-based routing.
 *
 * Output JSON shape (from `fleet-resource-manager a2a-route --json`):
 *   { url, node_id, tier, hint, source:"cli", saturation{...}, score,
 *     degraded_tier, skipped[], announce, refuse }
 * `refuse:true` / `url:null` means no eligible non-saturated node — we fall
 * through to the registry/fallback rather than silently defaulting to fnet3.
 */
function tryResolveViaCli(hint: string, _prompt?: string): ResolvedTarget | null {
  const exec: CliExecutor =
    _cliExecutor ??
    ((args, opts) =>
      execFileSync(FRM_BIN, args, {
        timeout: opts.timeout,
        encoding: opts.encoding as BufferEncoding,
      }) as unknown as string);
  try {
    const out = exec(["a2a-route", "--hint", String(hint), "--json"], {
      timeout: FRM_CLI_TIMEOUT_MS,
      encoding: "utf-8",
    });
    const plan = JSON.parse(out) as {
      url: string | null;
      node_id: string | null;
      tier: NodeTier | null;
      refuse?: boolean;
      announce?: string | null;
    };
    if (!plan || !plan.url || plan.refuse) {
      // CLI refused (no eligible node) or no URL — fall through (LOUD if announce)
      if (plan?.announce) console.warn(`[auto-route] ${plan.announce}`);
      return null;
    }
    return {
      url: plan.url,
      source: "cli",
      hint: String(hint),
      agentName: plan.node_id ?? undefined,
      tier: plan.tier ?? undefined,
    };
  } catch (e) {
    // CLI not installed, timed out, or returned bad JSON — fall through (LOUD, HE-2)
    console.warn(
      `[auto-route] fleet-resource-manager a2a-route failed (hint=${hint}); ` +
        `falling back to registry routing. ${(e as Error).message}`
    );
    return null;
  }
}

/**
 * Resolve via ConfigManager agents registry.
 * Filters by health status and tier, picks the best match.
 */
function resolveViaRegistry(
  hint: TierHint,
  configManager: ConfigManager
): ResolvedTarget | null {
  const agents = configManager.getRemoteAgents();
  if (agents.length === 0) return null;

  // Filter agents: include healthy and unknown (includes undefined,
  // which is the default for newly-discovered agents without health checks).
  // Exclude explicitly unhealthy agents.
  const healthy = agents.filter(
    (a) => a.healthStatus !== "unhealthy"
  );
  if (healthy.length === 0) return null;

  // Classify and sort by tier preference
  const desiredTiers = hintToTiers(hint);

  // Build classified list
  const classified = healthy.map((a) => ({
    agent: a,
    tier: classifyTier(a),
    // Prefer least-recently-used (sort by lastUsedAt ascending, null first)
    lastUsed: (a as any).lastUsedAt ?? 0,
  }));

  // Sort: match tier preference first, then least-recently-used
  classified.sort((a, b) => {
    const aTierIdx = desiredTiers.indexOf(a.tier);
    const bTierIdx = desiredTiers.indexOf(b.tier);
    // Unknown tiers go to end
    const aRank = aTierIdx === -1 ? desiredTiers.length : aTierIdx;
    const bRank = bTierIdx === -1 ? desiredTiers.length : bTierIdx;
    if (aRank !== bRank) return aRank - bRank;
    // Among same tier, prefer least recently used
    return a.lastUsed - b.lastUsed;
  });

  const best = classified[0];

  // FRM-10 / AC-SAT-2: mark the chosen agent as used so the LRU tiebreak
  // rotates among same-tier nodes on subsequent calls. getRemoteAgents() does
  // NOT advance lastUsedAt; getRemoteAgent(url) does. Without this, the first
  // strong node (fnet3) won every `auto`/`executor` call.
  try {
    configManager.getRemoteAgent(best.agent.url);
  } catch {
    // mock or non-standard ConfigManager — non-fatal
  }

  return {
    url: best.agent.url,
    source: "registry",
    hint,
    agentName: best.agent.name,
    tier: best.tier,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if an agent_url string is a tier hint (rather than a real URL).
 */
export function isTierHint(agentUrl: string): boolean {
  return agentUrl.toLowerCase() in TIER_HINTS;
}

/**
 * Resolve an agent_url to a concrete fleet node URL.
 *
 * If agent_url is already a real URL (contains "://"), return it as-is.
 * If it's a tier hint ("auto", "executor", "weak", etc.), resolve it:
 *   1. Try fleet-resource-manager CLI (has health data)
 *   2. Try ConfigManager agents registry (in-memory)
 *   3. Fall back to DEFAULT_FALLBACK_URL (fnet3)
 *
 * @param agentUrl - URL or tier hint string
 * @param configManager - ConfigManager instance with known agents
 * @param prompt - Optional task prompt for tier-based routing
 * @returns ResolvedTarget with the concrete URL and resolution metadata
 */
export function resolveFleetTarget(
  agentUrl: string,
  configManager: ConfigManager,
  prompt?: string
): ResolvedTarget {
  // Already a real URL — pass through
  if (agentUrl.includes("://")) {
    return {
      url: agentUrl,
      source: "fallback" as const,
      hint: "explicit",
    };
  }

  const normalizedHint = agentUrl.toLowerCase().trim();
  const tier = TIER_HINTS[normalizedHint];

  if (!tier) {
    // Not a known hint and not a URL — treat as a node name
    // Try to resolve from registry by name
    const agent = configManager.getRemoteAgent(normalizedHint);
    if (agent) {
      return {
        url: agent.url,
        source: "registry",
        hint: normalizedHint,
        agentName: agent.name,
        tier: classifyTier(agent),
      };
    }
    // Unknown name — fall back
    return {
      url: DEFAULT_FALLBACK_URL,
      source: "fallback",
      hint: normalizedHint,
    };
  }

  // Strategy 1: Try fleet-resource-manager CLI
  const cliResult = tryResolveViaCli(tier, prompt);
  if (cliResult) return cliResult;

  // Strategy 2: Try ConfigManager registry
  const regResult = resolveViaRegistry(tier, configManager);
  if (regResult) return regResult;

  // Strategy 3: Hardcoded fallback
  return {
    url: DEFAULT_FALLBACK_URL,
    source: "fallback",
    hint: tier,
  };
}

/**
 * Resolve all agent_url values in an array of task steps.
 * Returns new array with resolved URLs and resolution metadata.
 */
export function resolveFleetTargets(
  steps: Array<{ agent_url: string; message: string; [key: string]: unknown }>,
  configManager: ConfigManager
): Array<{ agent_url: string; message: string; resolved: ResolvedTarget; [key: string]: unknown }> {
  return steps.map((step) => {
    const resolved = resolveFleetTarget(step.agent_url, configManager, step.message);
    return {
      ...step,
      agent_url: resolved.url,
      resolved,
    };
  });
}
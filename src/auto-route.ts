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
 * 3. Hardcoded fallback (fnet3 — avoids fnet1 which runs Nextcloud)
 */

import { execSync } from "node:child_process";
import type { ConfigManager } from "./config.js";
import type { RemoteAgent } from "./types.js";

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
 * Heuristics based on typical fleet descriptions:
 *   - fnet1: "RTX 4090, 64GB RAM" → strong
 *   - fnet2: "RTX 3090, 64GB RAM" → strong
 *   - fnet3: "RTX 4080, 32GB RAM" → medium
 *   - fnet4: "RTX 4070, 32GB RAM" → medium
 *   - fnet5: "RTX 4060, 16GB RAM" → weak
 *   - fnet6: "RTX A4000, 32GB RAM" → medium
 *   - fnet7: "2x RTX 3090, 128GB RAM" → strong
 */
function classifyTier(agent: RemoteAgent): NodeTier {
  const desc = (agent.description || "").toLowerCase();
  const name = (agent.name || "").toLowerCase();

  // RAM-based classification (most reliable)
  const ramMatch = desc.match(/(\d+)\s*gb\s*ram/);
  const ramGb = ramMatch ? parseInt(ramMatch[1], 10) : 0;

  // GPU-based classification
  const hasMultiGpu = /\b2x\b|\bdual\b/.test(desc);
  const hasBigGpu = /\b4090\b|\b3090\b|\ba100\b|\bh100\b/i.test(desc);
  const hasSmallGpu = /\b4060\b|\b3060\b|\b1660\b/i.test(desc);

  // Strong: multi-GPU, or 64GB+ RAM, or big GPU with 32GB+ RAM
  if (hasMultiGpu || ramGb >= 64 || (hasBigGpu && ramGb >= 32)) {
    return "strong";
  }

  // Weak: small GPU or <20GB RAM
  if (hasSmallGpu || (ramGb > 0 && ramGb < 20)) {
    return "weak";
  }

  // Medium: everything else (32GB RAM, mid-range GPUs)
  if (ramGb >= 20 || hasBigGpu) {
    return "medium";
  }

  // Unknown specs default to medium (safe middle ground)
  return "medium";
}

/**
 * Map a tier hint to the desired NodeTier(s) for matching.
 */
function hintToTiers(hint: TierHint): NodeTier[] {
  switch (hint) {
    case "strong":
    case "executor":
      return ["strong"];
    case "medium":
      return ["medium"];
    case "weak":
    case "light":
      return ["weak", "medium"]; // prefer weak, fall back to medium
    case "any":
    case "auto":
    default:
      return ["strong", "medium", "weak"]; // any tier, prefer stronger
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default fallback URL when no agents are available.
 * fnet3 is preferred over fnet1 because fnet1 runs Nextcloud.
 */
const DEFAULT_FALLBACK_URL = "http://fnet3:10000";

/**
 * Try resolving via fleet-resource-manager CLI.
 * Returns null if CLI is unavailable or fails.
 */
function tryResolveViaCli(hint: string, prompt?: string): ResolvedTarget | null {
  try {
    const promptArg = prompt ? ` --prompt "${prompt.replace(/"/g, '\\"')}"` : "";
    const output = execSync(
      `fleet-resource-manager route${promptArg} --format json 2>/dev/null`,
      { timeout: 10000, encoding: "utf-8" }
    );
    const plan = JSON.parse(output);
    if (plan.target_node) {
      const nodeId = plan.target_node;
      const url = plan.target_url || `http://${nodeId}:10000`;
      return {
        url,
        source: "cli",
        hint,
        agentName: nodeId,
        tier: plan.model_tier,
      };
    }
  } catch {
    // CLI not available or failed — fall through to registry
  }
  return null;
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

  // Filter healthy agents
  const healthy = agents.filter(
    (a) => a.healthStatus === "healthy" || a.healthStatus === "unknown"
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
      source: "registry" as const,
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
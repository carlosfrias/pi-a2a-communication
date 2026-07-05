/**
 * Agent Discovery Module
 * 
 * Handles discovery and caching of A2A agents via Agent Cards.
 * Supports multiple discovery mechanisms and maintains a registry.
 */

import type { 
  RemoteAgent, 
  AgentCard, 
  DiscoveryConfig, 
  CachedAgent,
  AgentHealth,
} from "./types.js";
import { AGENT_CARD_PATH, AGENT_CARD_DISCOVERY_PATHS } from "./types.js";

/**
 * Agent Discovery class
 */
export class AgentDiscovery {
  private config: DiscoveryConfig;
  private cache: Map<string, CachedAgent> = new Map();
  private healthChecks: Map<string, AgentHealth> = new Map();

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  /**
   * Discover an agent at a given URL
   * Fetches and parses the Agent Card
   */
  async discoverAgent(url: string): Promise<RemoteAgent> {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedAgent(url);
      if (cached) {
        return cached;
      }
    }

    // Fetch agent card with fallback discovery paths
    const agentUrl = this.normalizeUrl(url);
    
    try {
      const response = await this.fetchAgentCardWithFallback(agentUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agent card: ${response.status} ${response.statusText}`);
      }

      const card: AgentCard = await response.json() as AgentCard;
      
      // Validate required fields
      if (!card.name || !card.description || !card.version) {
        throw new Error("Invalid agent card: missing required fields");
      }

      const remoteAgent: RemoteAgent = {
        ...card,
        url: agentUrl,
        discoveredAt: Date.now(),
        healthStatus: "unknown",
      };

      // Cache the agent
      if (this.config.cacheEnabled) {
        this.cacheAgent(url, remoteAgent, response.headers.get("etag") || undefined);
      }

      return remoteAgent;
    } catch (error) {
      throw new Error(`Agent discovery failed for ${url}: ${error}`);
    }
  }

  /**
   * Discover multiple agents in parallel
   */
  async discoverAgents(urls: string[]): Promise<RemoteAgent[]> {
    const results = await Promise.allSettled(
      urls.map(url => this.discoverAgent(url))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<RemoteAgent> => r.status === "fulfilled")
      .map(r => r.value);
  }

  /**
   * Refresh a cached agent
   */
  async refreshAgent(url: string): Promise<RemoteAgent> {
    // Force cache invalidation
    this.cache.delete(url);
    return this.discoverAgent(url);
  }

  /**
   * Search for agents by capability
   */
  findAgentsByCapability(capability: string): RemoteAgent[] {
    const results: RemoteAgent[] = [];
    
    for (const cached of this.cache.values()) {
      const agent = cached.agent;
      
      // Check if agent has the capability
      if (agent.capabilities[capability as keyof typeof agent.capabilities]) {
        results.push(agent);
        continue;
      }
      
      // Check skills
      for (const skill of agent.skills) {
        if (skill.tags.includes(capability) || skill.id === capability) {
          results.push(agent);
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Search for agents by skill
   */
  findAgentsBySkill(skillId: string): RemoteAgent[] {
    const results: RemoteAgent[] = [];
    
    for (const cached of this.cache.values()) {
      if (cached.agent.skills.some(s => s.id === skillId)) {
        results.push(cached.agent);
      }
    }
    
    return results;
  }

  /**
   * Search for agents by tag
   */
  findAgentsByTag(tag: string): RemoteAgent[] {
    const results: RemoteAgent[] = [];
    
    for (const cached of this.cache.values()) {
      const agent = cached.agent;
      
      // Check skill tags
      for (const skill of agent.skills) {
        if (skill.tags.includes(tag)) {
          results.push(agent);
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Check health of an agent
   */
  async checkHealth(agent: RemoteAgent): Promise<AgentHealth> {
    const startTime = Date.now();
    
    try {
      // Try to discover the agent (lightweight health check)
      await this.discoverAgent(agent.url);
      
      const health: AgentHealth = {
        url: agent.url,
        status: "healthy",
        latency: Date.now() - startTime,
        checkedAt: Date.now(),
      };
      
      this.healthChecks.set(agent.url, health);
      return health;
    } catch (error) {
      const health: AgentHealth = {
        url: agent.url,
        status: "unhealthy",
        latency: Date.now() - startTime,
        error: String(error),
        checkedAt: Date.now(),
      };
      
      this.healthChecks.set(agent.url, health);
      return health;
    }
  }

  /**
   * Check health of all cached agents
   */
  async checkAllHealth(): Promise<AgentHealth[]> {
    const agents = Array.from(this.cache.values()).map(c => c.agent);
    
    const results = await Promise.all(
      agents.map(agent => this.checkHealth(agent))
    );
    
    return results;
  }

  /**
   * Get cached health status
   */
  getHealthStatus(url: string): AgentHealth | null {
    return this.healthChecks.get(url) || null;
  }

  /**
   * Get all health statuses
   */
  getAllHealthStatuses(): AgentHealth[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get cached agent
   */
  private getCachedAgent(url: string): RemoteAgent | null {
    const cached = this.cache.get(url);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache has expired
    const age = Date.now() - cached.cachedAt;
    if (age > this.config.cacheTtl) {
      this.cache.delete(url);
      return null;
    }
    
    return cached.agent;
  }

  /**
   * Cache an agent
   */
  private cacheAgent(url: string, agent: RemoteAgent, etag?: string): void {
    const cached: CachedAgent = {
      agent,
      cachedAt: Date.now(),
      etag,
    };
    
    this.cache.set(url, cached);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all cached agents
   */
  getCachedAgents(): RemoteAgent[] {
    return Array.from(this.cache.values()).map(c => c.agent);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    total: number;
    expired: number;
    healthy: number;
    avgAge: number;
  } {
    const now = Date.now();
    let expired = 0;
    let totalAge = 0;
    
    for (const cached of this.cache.values()) {
      const age = now - cached.cachedAt;
      totalAge += age;
      
      if (age > this.config.cacheTtl) {
        expired++;
      }
    }
    
    const healthy = Array.from(this.healthChecks.values()).filter(h => h.status === "healthy").length;
    
    return {
      total: this.cache.size,
      expired,
      healthy,
      avgAge: this.cache.size > 0 ? Math.round(totalAge / this.cache.size) : 0,
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [url, cached] of this.cache) {
      if (now - cached.cachedAt > this.config.cacheTtl) {
        this.cache.delete(url);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Normalize URL
   */
  private normalizeUrl(url: string): string {
    // Remove trailing slash
    return url.replace(/\/$/, "");
  }

  /**
   * Get Agent Card URL (primary path)
   */
  private getAgentCardUrl(baseUrl: string): string {
    return `${baseUrl}${AGENT_CARD_PATH}`;
  }

  /**
   * Get all Agent Card discovery URLs (primary + fallbacks)
   */
  private getAgentCardUrls(baseUrl: string): string[] {
    return AGENT_CARD_DISCOVERY_PATHS.map(p => `${baseUrl}${p}`);
  }

  /**
   * Fetch agent card with fallback discovery paths
   * Tries /.well-known/agent-card.json first (spec path),
   * then /.well-known/agent.json (local fork),
   * then /.well-known/agent-card (npm legacy).
   */
  private async fetchAgentCardWithFallback(baseUrl: string): Promise<Response> {
    const urls = this.getAgentCardUrls(baseUrl);
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        const response = await this.fetchAgentCard(url);
        if (response.ok) {
          return response;
        }
        // 404 means this path isn't served — try next fallback
        if (response.status === 404) {
          lastError = new Error(`Agent Card not found at ${url} (404)`);
          continue;
        }
        // Auth errors or other issues — don't try fallbacks
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Network error on this path — try next fallback
        continue;
      }
    }

    throw lastError || new Error(`Agent Card not found at any discovery path for ${baseUrl}`);
  }

  /**
   * Fetch agent card with retries
   */
  private async fetchAgentCard(url: string, attempt = 0): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout || 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeout);
      return response;
    } catch (error) {
      if (attempt < 2) {
        // Retry after 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchAgentCard(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Validate agent card format
   */
  private validateAgentCard(card: unknown): card is AgentCard {
    if (typeof card !== "object" || card === null) {
      return false;
    }
    
    const c = card as Record<string, unknown>;
    
    // Required fields
    if (typeof c.name !== "string" || c.name.length === 0) {
      return false;
    }
    
    if (typeof c.description !== "string" || c.description.length === 0) {
      return false;
    }
    
    if (typeof c.version !== "string" || c.version.length === 0) {
      return false;
    }
    
    if (!Array.isArray(c.skills) || c.skills.length === 0) {
      return false;
    }
    
    return true;
  }
}

/**
 * A2A Client Implementation
 * 
 * Handles communication with remote A2A agents via HTTP/JSON-RPC.
 * Supports synchronous, streaming, and asynchronous operations.
 */

import * as https from "node:https";
import * as http from "node:http";
import { URL } from "node:url";
import type { 
  RemoteAgent, 
  A2ATask, 
  Message, 
  TaskOptions, 
  JSONRPCRequest, 
  JSONRPCResponse,
  StreamResponse,
  TaskUpdateCallback,
  ClientConfig,
  SecurityConfig,
  AgentCard,
  PushNotificationConfig,
} from "./types.js";
import { A2A_METHODS, AGENT_CARD_PATH, AGENT_CARD_DISCOVERY_PATHS } from "./types.js";

/**
 * A2A Client class
 */
export class A2AClient {
  private config: ClientConfig;
  private security: SecurityConfig;
  private pendingStreams: Map<string, AbortController> = new Map();

  constructor(config: ClientConfig, security: SecurityConfig) {
    this.config = config;
    this.security = security;
  }

  /**
   * Send a message to an agent (non-streaming)
   */
  async sendMessage(
    agent: RemoteAgent,
    message: Message,
    options: TaskOptions = {}
  ): Promise<A2ATask | Message> {
    const request = this.createRequest(A2A_METHODS.MESSAGE_SEND, {
      message,
      configuration: {
        acceptedOutputModes: agent.defaultOutputModes || ["text/plain", "application/json"],
        historyLength: options.historyLength ?? 10,
        returnImmediately: options.returnImmediately ?? false,
        pushNotificationConfig: options.pushNotificationConfig,
      },
      metadata: options.metadata,
    });

    const response = await this.sendRequest(agent, request, options);
    
    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`);
    }

    const result = response.result as { task?: A2ATask; message?: Message };
    
    if (result.task) {
      return result.task;
    } else if (result.message) {
      return result.message;
    }
    
    throw new Error("Invalid response: no task or message");
  }

  /**
   * Send a streaming message to an agent
   */
  async sendStreamingMessage(
    agent: RemoteAgent,
    message: Message,
    onUpdate: TaskUpdateCallback,
    options: TaskOptions = {}
  ): Promise<A2ATask> {
    const request = this.createRequest(A2A_METHODS.MESSAGE_STREAM, {
      message,
      configuration: {
        acceptedOutputModes: agent.defaultOutputModes || ["text/plain", "application/json"],
        historyLength: options.historyLength ?? 10,
        returnImmediately: false,
        pushNotificationConfig: options.pushNotificationConfig,
      },
      metadata: options.metadata,
    });

    return new Promise((resolve, reject) => {
      const abortController = new AbortController();
      const requestId = request.id as string;
      this.pendingStreams.set(requestId, abortController);

      // Add abort signal listener
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          abortController.abort();
          this.pendingStreams.delete(requestId);
          reject(new Error("Aborted"));
        });
      }

      this.sendStreamingRequest(agent, request, abortController.signal, (update) => {
        if (update.type === "task") {
          // Task complete
          this.pendingStreams.delete(requestId);
          resolve(update.task);
        } else if (update.type === "status_update") {
          // Status update
          onUpdate({
            id: update.taskId,
            contextId: update.contextId,
            status: update.status,
          });
        } else if (update.type === "artifact_update") {
          // Artifact update
          onUpdate({
            id: update.taskId,
            contextId: update.contextId,
            artifacts: [update.artifact],
          });
        } else if (update.type === "message") {
          // Message received
          onUpdate({
            status: {
              state: "working",
              message: update.message,
            },
          });
        }
      }).catch((error) => {
        this.pendingStreams.delete(requestId);
        reject(error);
      });
    });
  }

  /**
   * Get task status
   */
  async getTask(agent: RemoteAgent, taskId: string, historyLength?: number): Promise<A2ATask> {
    const request = this.createRequest(A2A_METHODS.TASKS_GET, {
      id: taskId,
      historyLength: historyLength ?? 10,
    });

    const response = await this.sendRequest(agent, request);
    
    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`);
    }

    return response.result as A2ATask;
  }

  /**
   * Cancel a task
   */
  async cancelTask(agent: RemoteAgent, taskId: string): Promise<A2ATask> {
    const request = this.createRequest(A2A_METHODS.TASKS_CANCEL, {
      id: taskId,
    });

    const response = await this.sendRequest(agent, request);
    
    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`);
    }

    return response.result as A2ATask;
  }

  /**
   * Subscribe to task updates (SSE)
   */
  async subscribeToTask(
    agent: RemoteAgent,
    taskId: string,
    onUpdate: TaskUpdateCallback,
    signal?: AbortSignal
  ): Promise<void> {
    const request = this.createRequest(A2A_METHODS.TASKS_SUBSCRIBE, {
      id: taskId,
    });

    return new Promise((resolve, reject) => {
      const abortController = new AbortController();
      
      if (signal) {
        signal.addEventListener("abort", () => {
          abortController.abort();
          resolve();
        });
      }

      this.sendStreamingRequest(agent, request, abortController.signal, (update) => {
        if (update.type === "status_update") {
          onUpdate({
            id: update.taskId,
            contextId: update.contextId,
            status: update.status,
          });
          
          // Resolve on terminal state
          const state = update.status.state;
          if (["completed", "failed", "canceled", "rejected"].includes(state)) {
            resolve();
          }
        } else if (update.type === "artifact_update") {
          onUpdate({
            id: update.taskId,
            contextId: update.contextId,
            artifacts: [update.artifact],
          });
        }
      }).catch(reject);
    });
  }

  /**
   * Resubscribe to task updates after connection loss (A2A v1.0 spec)
   */
  async resubscribeToTask(
    agent: RemoteAgent,
    taskId: string,
    onUpdate: TaskUpdateCallback,
    signal?: AbortSignal
  ): Promise<void> {
    const request = this.createRequest(A2A_METHODS.TASKS_RESUBSCRIBE, {
      id: taskId,
    });

    return new Promise((resolve, reject) => {
      const abortController = new AbortController();
      
      if (signal) {
        signal.addEventListener("abort", () => {
          abortController.abort();
          resolve();
        });
      }

      this.sendStreamingRequest(agent, request, abortController.signal, (update) => {
        if (update.type === "status_update") {
          onUpdate({
            id: update.taskId,
            contextId: update.contextId,
            status: update.status,
          });
          
          const state = update.status.state;
          if (["completed", "failed", "canceled", "rejected"].includes(state)) {
            resolve();
          }
        } else if (update.type === "artifact_update") {
          onUpdate({
            id: update.taskId,
            contextId: update.contextId,
            artifacts: [update.artifact],
          });
        }
      }).catch(reject);
    });
  }

  /**
   * Set push notification config for a task (A2A v1.0 spec)
   */
  async setPushNotificationConfig(
    agent: RemoteAgent,
    taskId: string,
    config: PushNotificationConfig
  ): Promise<PushNotificationConfig> {
    const request = this.createRequest(A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_SET, {
      id: taskId,
      pushNotificationConfig: config,
    });

    const response = await this.sendRequest(agent, request);
    
    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`);
    }

    return (response.result as { pushNotificationConfig: PushNotificationConfig }).pushNotificationConfig;
  }

  /**
   * Get push notification config for a task (A2A v1.0 spec)
   */
  async getPushNotificationConfig(
    agent: RemoteAgent,
    taskId: string
  ): Promise<PushNotificationConfig> {
    const request = this.createRequest(A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_GET, {
      id: taskId,
    });

    const response = await this.sendRequest(agent, request);
    
    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`);
    }

    return (response.result as { pushNotificationConfig: PushNotificationConfig }).pushNotificationConfig;
  }

  /**
   * Delete push notification config for a task (A2A v1.0 spec)
   */
  async deletePushNotificationConfig(
    agent: RemoteAgent,
    taskId: string
  ): Promise<void> {
    const request = this.createRequest(A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_DELETE, {
      id: taskId,
    });

    const response = await this.sendRequest(agent, request);
    
    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`);
    }
  }

  /**
   * Get authenticated extended agent card (A2A v1.0 spec)
   */
  async getAuthenticatedExtendedCard(agent: RemoteAgent): Promise<AgentCard> {
    const request = this.createRequest(A2A_METHODS.AGENT_AUTHENTICATED_EXTENDED_CARD, {});

    const response = await this.sendRequest(agent, request);
    
    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`);
    }

    return response.result as AgentCard;
  }

  /**
   * Discover agent at URL (fetch Agent Card)
   * Tries discovery paths in order: agent-card.json, agent.json, agent-card
   */
  async discoverAgent(url: string): Promise<AgentCard & { url: string }> {
    const agentUrl = new URL(url);
    const discoveryPaths = [...AGENT_CARD_DISCOVERY_PATHS];
    let lastError: Error | null = null;

    for (const cardPath of discoveryPaths) {
      const fullUrl = `${agentUrl.origin}${cardPath}`;
      try {
        const response = await this.httpGet(fullUrl);
        if (response.ok) {
          const card = await response.json();
          return { ...card, url };
        }
        // 404 — try next path
        if (response.status === 404) {
          lastError = new Error(`Agent Card not found at ${cardPath} (404)`);
          continue;
        }
        // Non-404 error (auth, server error) — don't try fallbacks
        throw new Error(`Failed to discover agent: ${response.status} ${response.statusText}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Failed to discover agent')) {
          throw error; // Re-throw non-404 errors
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    throw lastError || new Error(`Agent Card not found at any discovery path for ${url}`);
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    for (const [id, controller] of this.pendingStreams) {
      controller.abort();
      this.pendingStreams.delete(id);
    }
  }

  /**
   * Get health status of an agent
   */
  async checkHealth(agent: RemoteAgent): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Try to get the agent card (lightweight health check)
      await this.discoverAgent(agent.url);
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: String(error),
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a JSON-RPC request
   */
  private createRequest(method: string, params: Record<string, unknown>): JSONRPCRequest {
    return {
      jsonrpc: "2.0",
      id: this.generateId(),
      method,
      params,
    };
  }

  /**
   * Generate a unique request ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Send a JSON-RPC request (non-streaming)
   */
  private async sendRequest(
    agent: RemoteAgent,
    request: JSONRPCRequest,
    options: TaskOptions = {},
    attempt = 0
  ): Promise<JSONRPCResponse> {
    const url = this.getA2AEndpoint(agent);
    const body = JSON.stringify(request);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Add authentication
    const authHeader = this.getAuthHeader(agent);
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    try {
      const response = await this.httpPost(url, body, headers, options.timeout || this.config.timeout, options.signal);
      
      if (!response.ok) {
        // Retry on 5xx errors
        if (response.status >= 500 && attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          return this.sendRequest(agent, request, options, attempt + 1);
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Fail fast on caller abort — do NOT retry an aborted request.
      if (options.signal?.aborted || (error instanceof Error && error.message === "Aborted")) {
        throw error;
      }
      // Retry on network errors
      if (attempt < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        return this.sendRequest(agent, request, options, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Send a streaming JSON-RPC request (SSE)
   */
  private async sendStreamingRequest(
    agent: RemoteAgent,
    request: JSONRPCRequest,
    signal: AbortSignal,
    onUpdate: (update: StreamResponse) => void
  ): Promise<void> {
    const url = this.getA2AEndpoint(agent);
    const body = JSON.stringify(request);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    };

    const authHeader = this.getAuthHeader(agent);
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;
      
      const req = client.request(
        url,
        {
          method: "POST",
          headers,
          timeout: this.config.timeout,
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          let buffer = "";
          
          res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            
            // Process SSE events
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.substring(6);
                if (data === "[DONE]") {
                  resolve();
                  return;
                }
                
                try {
                  const update = JSON.parse(data) as StreamResponse;
                  onUpdate(update);
                } catch (e) {
                  // Ignore parse errors for partial data
                }
              }
            }
          });
          
          res.on("end", () => resolve());
          res.on("error", reject);
        }
      );

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      // Handle abort
      signal.addEventListener("abort", () => {
        req.destroy();
        reject(new Error("Aborted"));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Get the A2A endpoint URL from agent card
   */
  private getA2AEndpoint(agent: RemoteAgent): string {
    // Use the agent's URL directly or look for interface in capabilities
    return agent.url;
  }

  /**
   * Get authentication header
   */
  private getAuthHeader(agent: RemoteAgent): string | null {
    // Check agent-specific security requirements
    if (agent.securitySchemes && agent.securityRequirements) {
      for (const req of agent.securityRequirements) {
        for (const [schemeName, _] of Object.entries(req.schemes)) {
          const scheme = agent.securitySchemes[schemeName];
          if (scheme) {
            return this.buildAuthHeader(scheme);
          }
        }
      }
    }
    
    // Fall back to global security config
    return this.buildGlobalAuthHeader();
  }

  /**
   * Build authentication header from scheme
   */
  private buildAuthHeader(scheme: { type: string; scheme?: string; name?: string; location?: string }): string | null {
    switch (scheme.type) {
      case "http":
        if (scheme.scheme?.toLowerCase() === "bearer") {
          return `Bearer ${this.security.bearerToken || ""}`;
        }
        break;
      case "apiKey":
        if (scheme.location === "header") {
          return `${scheme.name} ${this.security.apiKey || ""}`;
        }
        break;
    }
    return null;
  }

  /**
   * Build authentication header from global config
   */
  private buildGlobalAuthHeader(): string | null {
    switch (this.security.defaultScheme) {
      case "bearer":
        return this.security.bearerToken ? `Bearer ${this.security.bearerToken}` : null;
      case "apiKey":
        return this.security.apiKey ? `ApiKey ${this.security.apiKey}` : null;
      default:
        return null;
    }
  }

  /**
   * HTTP POST helper
   */
  private httpPost(
    url: string,
    body: string,
    headers: Record<string, string>,
    timeout: number,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<any> }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers,
        timeout,
        rejectUnauthorized: this.security.verifySsl,
      };

      const req = client.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            statusText: res.statusMessage || "",
            json: async () => JSON.parse(data),
          });
        });
      });

      // Forward AbortSignal: abort the in-flight request when the caller cancels.
      const onAbort = () => req.destroy(new Error("Aborted"));
      if (signal) {
        if (signal.aborted) {
          req.destroy(new Error("Aborted"));
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      req.on("error", reject);
      req.on("close", () => {
        if (signal) signal.removeEventListener("abort", onAbort);
      });
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * HTTP GET helper
   */
  private httpGet(url: string): Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<any> }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: "GET",
        timeout: 10000,
        rejectUnauthorized: this.security.verifySsl,
      };

      const req = client.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            statusText: res.statusMessage || "",
            json: async () => JSON.parse(data),
          });
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.end();
    });
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

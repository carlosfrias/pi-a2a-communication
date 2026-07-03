/**
 * A2A Server Implementation
 * 
 * Exposes pi as an A2A-compliant agent server.
 * Handles HTTP/JSON-RPC requests and manages task lifecycle.
 */

import * as http from "node:http";
import * as https from "node:https";
import * as fs from "node:fs";
import { URL } from "node:url";
import * as os from "node:os";
import * as path from "node:path";
import { timingSafeEqual } from "node:crypto";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { NoOpPiTaskBridge } from "./pi-task-bridge.js";
import type { PiTaskBridge } from "./pi-task-bridge.js";
import type { 
  ServerConfig, 
  SecurityConfig, 
  AgentCard,
  A2ATask,
  Message,
  JSONRPCRequest,
  JSONRPCResponse,
  TaskState,
  StreamResponse,
} from "./types.js";
import { A2A_METHODS, AGENT_CARD_PATH } from "./types.js";

/**
 * Task handler function type
 */
type TaskHandler = (task: A2ATask, onUpdate: (update: Partial<A2ATask>) => void, signal?: AbortSignal) => Promise<A2ATask>;

/**
 * A2A Server class
 */
/** Constant-time string comparison to avoid timing side-channels on token checks. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export class A2AServer {
  private config: ServerConfig;
  private security: SecurityConfig;
  private ctx: ExtensionContext;
  private piTaskBridge: PiTaskBridge;
  private server: http.Server | https.Server | null = null;
  private agentCard: AgentCard;
  private agentCardPath: string | null = null;
  private tasks: Map<string, A2ATask> = new Map();
  private taskHandlers: Map<string, TaskHandler> = new Map();
  private subscribers: Map<string, Set<http.ServerResponse>> = new Map();
  private running = false;

  constructor(config: ServerConfig, security: SecurityConfig, ctx: ExtensionContext, piTaskBridge?: PiTaskBridge) {
    this.config = config;
    this.security = security;
    this.ctx = ctx;
    this.piTaskBridge = piTaskBridge || new NoOpPiTaskBridge();
    
    // Try to load agent card from filesystem, fall back to hardcoded default
    this.agentCard = this.loadAgentCard();
  }

  /**
   * Start the A2A server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Server already running");
    }

    return new Promise((resolve, reject) => {
      const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
        this.handleRequest(req, res);
      };

      if (this.config.ssl) {
        // HTTPS server
        const options = {
          key: fs.readFileSync(this.config.ssl.key),
          cert: fs.readFileSync(this.config.ssl.cert),
          ca: this.config.ssl.ca ? fs.readFileSync(this.config.ssl.ca) : undefined,
        };
        this.server = https.createServer(options, requestHandler);
      } else {
        // HTTP server
        this.server = http.createServer(requestHandler);
      }

      this.server.listen(this.config.port, this.config.host, () => {
        this.running = true;
        resolve();
      });

      this.server.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Stop the A2A server
   */
  async stop(): Promise<void> {
    if (!this.server || !this.running) {
      return;
    }

    return new Promise((resolve) => {
      // Close all SSE connections
      for (const [_, responses] of this.subscribers) {
        for (const res of responses) {
          res.end();
        }
      }
      this.subscribers.clear();

      this.server!.close(() => {
        this.running = false;
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Register a task handler for a specific skill
   */
  registerTaskHandler(skillId: string, handler: TaskHandler): void {
    this.taskHandlers.set(skillId, handler);
  }

  /**
   * Update the agent card
   */
  updateAgentCard(updates: Partial<AgentCard>): void {
    this.agentCard = { ...this.agentCard, ...updates };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname;

    try {
      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // A2A v1.0 spec: Public agent card endpoints do NOT require authentication.
      // Only JSON-RPC endpoints and task endpoints require auth.
      // See: https://a2a-protocol.org/v1.0.0/specification/ Section 5 & 8
      //
      // authFirst (hardened profile, opt-in): when true, the agent card ALSO
      // requires auth (401 + WWW-Authenticate without credentials). Default false =
      // spec-compliant public card so clients can discover the agent + its security
      // schemes pre-auth. Route dispatch (isCardPath) is separate from the auth
      // exemption so the card is still served when authenticated under authFirst.
      const isCardPath = path === "/.well-known/agent-card.json"
        || path === "/.well-known/agent.json"
        || path === "/.well-known/agent-card";
      const cardRequiresAuth = !!this.security.authFirst;
      // Auth required for every non-card path; for the card only when authFirst.
      if ((!isCardPath || cardRequiresAuth) && !this.isAuthenticated(req)) {
        res.setHeader("WWW-Authenticate", "Bearer");
        this.sendError(res, 401, "Unauthorized");
        return;
      }

      // Route requests
      if (isCardPath) {
        await this.handleAgentCard(req, res);
      } else if (path === "/" || path === "") {
        // A2A v1.0 spec: root endpoint with JSON-RPC method dispatch
        await this.handleJsonRPCRequest(req, res);
      } else if (path === "/rpc") {
        // A2A v1.0 §9.2: JSON-RPC binding endpoint
        await this.handleJsonRPCRequest(req, res);
      } else if (path === "/message:send") {
        // A2A v1.0 §11.3.1: HTTP/REST binding for sending messages
        await this.handleJsonRPCRequest(req, res);
      } else if (path === "/message:stream") {
        // A2A v1.0 §11.3.1: HTTP/REST binding for streaming messages
        await this.handleJsonRPCRequest(req, res);
      } else if (path === "/sendMessage" || path === "/sendStreamingMessage") {
        // Legacy path-based routes (kept for backward compat, dispatch via JSON-RPC)
        await this.handleSendMessage(req, res, path === "/sendStreamingMessage");
      } else if (path.startsWith("/tasks/")) {
        await this.handleTaskRequest(req, res, path);
      } else if (path === "/tasks") {
        await this.handleListTasks(req, res);
      } else {
        this.sendError(res, 404, "Not Found");
      }
    } catch (error) {
      console.error("A2A server error:", error);
      this.sendError(res, 500, "Internal Server Error");
    }
  }

  /**
   * Handle JSON-RPC request at the single A2A endpoint (v1.0 spec)
   */
  private async handleJsonRPCRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      this.sendError(res, 405, "Method Not Allowed");
      return;
    }

    const body = await this.readBody(req);
    let request: JSONRPCRequest;
    try {
      request = JSON.parse(body);
    } catch {
      this.sendJSONRPCError(res, null, -32700, "Parse error");
      return;
    }

    // Validate JSON-RPC 2.0
    if (request.jsonrpc !== "2.0" || !request.method) {
      this.sendJSONRPCError(res, request.id ?? null, -32600, "Invalid Request");
      return;
    }

    const rawMethod = request.method;

    // A2A v1.0 §5.3: Method names are PascalCase (SendMessage, GetTask, etc.)
    // Map PascalCase to internal slash-separated names for backward compat.
    const PASCAL_CASE_MAP: Record<string, string> = {
      'SendMessage': A2A_METHODS.MESSAGE_SEND,
      'SendStreamingMessage': A2A_METHODS.MESSAGE_STREAM,
      'GetTask': A2A_METHODS.TASKS_GET,
      'CancelTask': A2A_METHODS.TASKS_CANCEL,
      'SubscribeToTask': A2A_METHODS.TASKS_SUBSCRIBE,
      'ResubscribeToTask': A2A_METHODS.TASKS_RESUBSCRIBE,
      'SetPushNotificationConfig': A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_SET,
      'GetPushNotificationConfig': A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_GET,
      'DeletePushNotificationConfig': A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_DELETE,
      'GetAuthenticatedExtendedCard': A2A_METHODS.AGENT_AUTHENTICATED_EXTENDED_CARD,
    };
    const method = PASCAL_CASE_MAP[rawMethod] ?? rawMethod;

    switch (method) {
      case A2A_METHODS.MESSAGE_SEND:
      case A2A_METHODS.MESSAGE_STREAM: {
        const streaming = method === A2A_METHODS.MESSAGE_STREAM;
        await this.handleJsonRPCSendMessage(req, res, request, streaming);
        break;
      }
      case A2A_METHODS.TASKS_GET: {
        await this.handleJsonRPCTasksGet(req, res, request);
        break;
      }
      case A2A_METHODS.TASKS_CANCEL: {
        await this.handleJsonRPCTasksCancel(req, res, request);
        break;
      }
      case A2A_METHODS.TASKS_SUBSCRIBE: {
        await this.handleJsonRPCTasksSubscribe(req, res, request);
        break;
      }
      case A2A_METHODS.TASKS_RESUBSCRIBE: {
        await this.handleJsonRPCTasksResubscribe(req, res, request);
        break;
      }
      case A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_SET: {
        await this.handleJsonRPCPushNotificationConfigSet(req, res, request);
        break;
      }
      case A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_GET: {
        await this.handleJsonRPCPushNotificationConfigGet(req, res, request);
        break;
      }
      case A2A_METHODS.TASKS_PUSH_NOTIFICATION_CONFIG_DELETE: {
        await this.handleJsonRPCPushNotificationConfigDelete(req, res, request);
        break;
      }
      case A2A_METHODS.AGENT_AUTHENTICATED_EXTENDED_CARD: {
        await this.handleJsonRPCAuthenticatedExtendedCard(req, res, request);
        break;
      }
      default:
        this.sendJSONRPCError(res, request.id ?? null, -32601, "Method not found");
    }
  }

  /**
   * Handle message/send or message/stream via JSON-RPC dispatch
   */
  private async handleJsonRPCSendMessage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest,
    streaming: boolean
  ): Promise<void> {
    const { message, configuration, metadata } = (request.params as { message?: Message; configuration?: { returnImmediately?: boolean }; metadata?: Record<string, unknown> } || {});

    if (!message) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: message required");
      return;
    }

    const task = this.createTask(message, configuration, metadata);
    this.tasks.set(task.id, task);

    if (streaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.writeHead(200);
      this.sendSSE(res, { type: "task", task });

      this.processTaskStreaming(task, res).catch(error => {
        console.error("Task processing error:", error);
        task.status.state = "failed";
        task.status.message = {
          messageId: this.generateId(),
          role: "agent",
          parts: [{ type: "text", text: String(error) }],
        };
        this.sendSSE(res, { type: "status_update", taskId: task.id, contextId: task.contextId || "", status: task.status });
        res.end();
      });
    } else {
      if (configuration?.returnImmediately) {
        this.sendJSONRPCResponse(res, request.id ?? null, { task });
        this.processTask(task).catch(console.error);
      } else {
        const ac = new AbortController();
        const onClose = () => ac.abort();
        req.on("close", onClose);
        try {
          const completedTask = await this.processTask(task, ac.signal);
          this.sendJSONRPCResponse(res, request.id ?? null, { task: completedTask });
        } catch (error) {
          task.status.state = "failed";
          task.isError = true;
          task.error = String(error);
          this.sendJSONRPCResponse(res, request.id ?? null, { task });
        } finally {
          req.off("close", onClose);
        }
      }
    }
  }

  /**
   * Handle tasks/get via JSON-RPC dispatch
   */
  private async handleJsonRPCTasksGet(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    const params = request.params as { id?: string; historyLength?: number } || {};
    const taskId = params.id;
    if (!taskId) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: id required");
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Task not found");
      return;
    }

    const response: any = { ...task };
    if (params.historyLength && task.history) {
      response.history = task.history.slice(-params.historyLength);
    }
    this.sendJSONRPCResponse(res, request.id ?? null, response);
  }

  /**
   * Handle tasks/cancel via JSON-RPC dispatch
   */
  private async handleJsonRPCTasksCancel(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    const params = request.params as { id?: string } || {};
    const taskId = params.id;
    if (!taskId) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: id required");
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Task not found");
      return;
    }

    task.status.state = "canceled";
    this.sendJSONRPCResponse(res, request.id ?? null, task);
  }

  /**
   * Handle tasks/subscribe via JSON-RPC dispatch
   */
  private async handleJsonRPCTasksSubscribe(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    const params = request.params as { id?: string } || {};
    const taskId = params.id;
    if (!taskId) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: id required");
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Task not found");
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.writeHead(200);

    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(res);

    this.sendSSE(res, { type: "task", task });

    req.on("close", () => {
      this.subscribers.get(taskId)?.delete(res);
    });
  }

  /**
   * Handle tasks/resubscribe via JSON-RPC dispatch (A2A v1.0 spec)
   * Reconnects to an existing SSE stream for a task.
   */
  private async handleJsonRPCTasksResubscribe(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    const params = request.params as { id?: string } || {};
    const taskId = params.id;
    if (!taskId) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: id required");
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Task not found");
      return;
    }

    // Check if task is in a terminal state
    const terminalStates: TaskState[] = ["completed", "failed", "canceled", "rejected"];
    if (terminalStates.includes(task.status.state)) {
      // Task already completed — return the final state
      this.sendJSONRPCResponse(res, request.id ?? null, { task });
      return;
    }

    // Reconnect to the SSE stream
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.writeHead(200);

    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(res);

    // Send current state
    this.sendSSE(res, { type: "task", task });

    req.on("close", () => {
      this.subscribers.get(taskId)?.delete(res);
    });
  }

  /**
   * Handle tasks/pushNotificationConfig/set via JSON-RPC dispatch (A2A v1.0 spec)
   */
  private async handleJsonRPCPushNotificationConfigSet(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    const params = request.params as { id?: string; pushNotificationConfig?: { url: string; token?: string; authentication?: { scheme: string; credentials: string } } } || {};
    const taskId = params.id;
    if (!taskId) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: id required");
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Task not found");
      return;
    }

    if (!params.pushNotificationConfig) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: pushNotificationConfig required");
      return;
    }

    // Store push notification config on the task metadata
    if (!task.metadata) {
      task.metadata = {};
    }
    task.metadata.pushNotificationConfig = params.pushNotificationConfig;

    this.sendJSONRPCResponse(res, request.id ?? null, { pushNotificationConfig: params.pushNotificationConfig });
  }

  /**
   * Handle tasks/pushNotificationConfig/get via JSON-RPC dispatch (A2A v1.0 spec)
   */
  private async handleJsonRPCPushNotificationConfigGet(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    const params = request.params as { id?: string } || {};
    const taskId = params.id;
    if (!taskId) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: id required");
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Task not found");
      return;
    }

    const config = task.metadata?.pushNotificationConfig;
    if (!config) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Push notification config not found");
      return;
    }

    this.sendJSONRPCResponse(res, request.id ?? null, { pushNotificationConfig: config });
  }

  /**
   * Handle tasks/pushNotificationConfig/delete via JSON-RPC dispatch (A2A v1.0 spec)
   */
  private async handleJsonRPCPushNotificationConfigDelete(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    const params = request.params as { id?: string } || {};
    const taskId = params.id;
    if (!taskId) {
      this.sendJSONRPCError(res, request.id ?? null, -32602, "Invalid params: id required");
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      this.sendJSONRPCError(res, request.id ?? null, -32001, "Task not found");
      return;
    }

    if (task.metadata?.pushNotificationConfig) {
      delete task.metadata.pushNotificationConfig;
    }

    this.sendJSONRPCResponse(res, request.id ?? null, null);
  }

  /**
   * Handle agent/authenticatedExtendedCard via JSON-RPC dispatch (A2A v1.0 spec)
   */
  private async handleJsonRPCAuthenticatedExtendedCard(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    request: JSONRPCRequest
  ): Promise<void> {
    // Verify authentication — this endpoint requires auth
    if (!this.isAuthenticated(req)) {
      res.setHeader("WWW-Authenticate", "Bearer");
      this.sendJSONRPCError(res, request.id ?? null, -32002, "Authentication required");
      return;
    }

    // Return extended agent card with additional details
    const extendedCard = {
      ...this.agentCard,
      // Add extended/authenticated details
      capabilities: {
        ...this.agentCard.capabilities,
      },
    };

    this.sendJSONRPCResponse(res, request.id ?? null, extendedCard);
  }

  /**
   * Handle agent card request
   */
  private async handleAgentCard(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== "GET") {
      this.sendError(res, 405, "Method Not Allowed");
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(this.agentCard));
  }

  /**
   * Handle send message request
   */
  private async handleSendMessage(
    req: http.IncomingMessage, 
    res: http.ServerResponse,
    streaming: boolean
  ): Promise<void> {
    if (req.method !== "POST") {
      this.sendError(res, 405, "Method Not Allowed");
      return;
    }

    const body = await this.readBody(req);
    let request: JSONRPCRequest;
    try {
      request = JSON.parse(body);
    } catch {
      this.sendJSONRPCError(res, null, -32700, "Parse error");
      return;
    }

    // Validate request
    if (request.jsonrpc !== "2.0" || !request.method) {
      this.sendJSONRPCError(res, request.id, -32600, "Invalid Request");
      return;
    }

    const { message, configuration, metadata } = request.params as { message?: Message; configuration?: { returnImmediately?: boolean }; metadata?: Record<string, unknown> } || {};
    
    if (!message) {
      this.sendJSONRPCError(res, request.id, -32602, "Invalid params: message required");
      return;
    }

    // Create task
    const task = this.createTask(message, configuration, metadata);
    this.tasks.set(task.id, task);

    if (streaming) {
      // Setup SSE response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.writeHead(200);

      // Send initial task state
      this.sendSSE(res, { type: "task", task });

      // Process task asynchronously
      this.processTaskStreaming(task, res).catch(error => {
        console.error("Task processing error:", error);
        task.status.state = "failed";
        task.status.message = {
          messageId: this.generateId(),
          role: "agent",
          parts: [{ type: "text", text: String(error) }],
        };
        this.sendSSE(res, { 
          type: "status_update", 
          taskId: task.id, 
          contextId: task.contextId || "", 
          status: task.status 
        });
        res.end();
      });
    } else {
      // Non-streaming: process and respond
      if (configuration?.returnImmediately) {
        // Return immediately with submitted state
        this.sendJSONRPCResponse(res, request.id, { task });
        
        // Process task in background
        this.processTask(task).catch(console.error);
      } else {
        // Wait for task completion
        const ac = new AbortController();
        const onClose = () => ac.abort();
        req.on("close", onClose);
        try {
          const completedTask = await this.processTask(task, ac.signal);
          this.sendJSONRPCResponse(res, request.id, { task: completedTask });
        } catch (error) {
          task.status.state = "failed";
          task.isError = true;
          task.error = String(error);
          this.sendJSONRPCResponse(res, request.id, { task });
        } finally {
          req.off("close", onClose);
        }
      }
    }
  }

  /**
   * Handle task-specific requests (get, cancel, subscribe)
   */
  private async handleTaskRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    path: string
  ): Promise<void> {
    const match = path.match(/^\/tasks\/([^\/]+)(?:\/(\w+))?/);
    if (!match) {
      this.sendError(res, 404, "Not Found");
      return;
    }

    const taskId = match[1];
    const action = match[2];
    const task = this.tasks.get(taskId);

    if (!task) {
      this.sendJSONRPCError(res, null, -32001, "Task not found");
      return;
    }

    if (req.method === "GET" && !action) {
      // Get task
      const query = new URL(req.url || "/", `http://${req.headers.host}`).searchParams;
      const historyLength = query.get("historyLength");
      
      const response: any = { ...task };
      if (historyLength) {
        const limit = parseInt(historyLength, 10);
        if (task.history) {
          response.history = task.history.slice(-limit);
        }
      }

      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify(response));
    } else if (req.method === "POST" && action === "cancel") {
      // Cancel task
      task.status.state = "canceled";
      this.sendJSONRPCResponse(res, null, task);
    } else if (req.method === "GET" && action === "subscribe") {
      // Subscribe to task updates (SSE)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.writeHead(200);

      // Add to subscribers
      if (!this.subscribers.has(taskId)) {
        this.subscribers.set(taskId, new Set());
      }
      this.subscribers.get(taskId)!.add(res);

      // Send current state
      this.sendSSE(res, { type: "task", task });

      // Clean up on client disconnect
      req.on("close", () => {
        this.subscribers.get(taskId)?.delete(res);
      });
    } else {
      this.sendError(res, 405, "Method Not Allowed");
    }
  }

  /**
   * Handle list tasks request
   */
  private async handleListTasks(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== "GET") {
      this.sendError(res, 405, "Method Not Allowed");
      return;
    }

    const query = new URL(req.url || "/", `http://${req.headers.host}`).searchParams;
    const contextId = query.get("contextId");
    const status = query.get("status");
    const pageSize = parseInt(query.get("pageSize") || "50", 10);

    let tasks = Array.from(this.tasks.values());

    if (contextId) {
      tasks = tasks.filter(t => t.contextId === contextId);
    }

    if (status) {
      tasks = tasks.filter(t => t.status.state === status);
    }

    // Sort by most recent first
    tasks.sort((a, b) => {
      const aTime = new Date(a.status.timestamp || 0).getTime();
      const bTime = new Date(b.status.timestamp || 0).getTime();
      return bTime - aTime;
    });

    const response = {
      tasks: tasks.slice(0, pageSize),
      nextPageToken: tasks.length > pageSize ? "more" : "",
      pageSize,
      totalSize: tasks.length,
    };

    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  /**
   * Process a task (non-streaming)
   */
  private async processTask(task: A2ATask, signal?: AbortSignal): Promise<A2ATask> {
    // Update state to working
    task.status.state = "working";
    task.status.timestamp = new Date().toISOString();

    try {
      // Check for a registered task handler first.
      // Phase EXEC Tier C: explicit metadata.skills are checked BEFORE the catch-all
      // "a2a-task-execution" session handler, so a tagged deterministic handler
      // (shell-exec) takes priority and the session handler's parseMemoryRequest
      // cannot hijack it. A handler that throws PI_SESSION_UNAVAILABLE CONTINUES to
      // the next handler instead of jumping to the bridge.
      const skillIds = [...(task.metadata?.skills as string[] || []), "a2a-task-execution"];
      for (const skillId of skillIds) {
        const handler = this.taskHandlers.get(skillId);
        if (handler) {
          try {
            const result = await handler(task, (update: Partial<A2ATask>) => {
              Object.assign(task, update);
              this.notifySubscribers(task);
            }, signal);
            return result;
          } catch (handlerError) {
            // If the handler signals that the session is unavailable,
            // continue to the next handler; if none match, fall through to bridge.
            if (handlerError instanceof Error && handlerError.message.startsWith("PI_SESSION_UNAVAILABLE")) {
              continue; // Fall through to next handler / bridge
            }
            throw handlerError;
          }
        }
      }

      // No handler matched — fall back to PiTaskBridge
      // Get the message content
      const message = task.status.message;
      if (!message) {
        throw new Error("No message in task");
      }

      // Convert to pi task format and execute
      const textContent = message.parts
        .filter(p => p.type === "text")
        .map(p => p.text)
        .join("\n");

      // Execute using pi's capabilities
      const result = await this.executePiTask(textContent, signal);

      // Update task with result
      task.status.state = "completed";
      task.status.timestamp = new Date().toISOString();
      
      if (!task.artifacts) {
        task.artifacts = [];
      }
      
      task.artifacts.push({
        artifactId: this.generateId(),
        name: "result",
        parts: [{ type: "text", text: result }],
      });

      // Notify subscribers
      this.notifySubscribers(task);

      return task;
    } catch (error) {
      task.status.state = "failed";
      task.isError = true;
      task.error = String(error);
      task.status.timestamp = new Date().toISOString();
      this.notifySubscribers(task);
      throw error;
    }
  }

  /**
   * Process a task with streaming
   */
  private async processTaskStreaming(task: A2ATask, res: http.ServerResponse): Promise<void> {
    // Update state to working
    task.status.state = "working";
    task.status.timestamp = new Date().toISOString();

    // Phase EXEC Tier C: abort handlers (e.g. the shell-exec child) if the client
    // disconnects the SSE stream. The non-streaming path receives its signal from
    // the caller; the streaming path synthesizes one from res 'close'.
    const ac = new AbortController();
    const onClientClose = () => ac.abort();
    res.on("close", onClientClose);

    this.sendSSE(res, {
      type: "status_update",
      taskId: task.id,
      contextId: task.contextId || "",
      status: task.status,
    });

    try {
      // Check for a registered task handler first (same as processTask).
      // Phase EXEC Tier C: explicit metadata.skills are checked BEFORE the catch-all
      // "a2a-task-execution" session handler, so a tagged deterministic handler
      // (shell-exec) takes priority and the session handler's parseMemoryRequest
      // cannot hijack it. continue (not break) on PI_SESSION_UNAVAILABLE.
      const skillIds = [...(task.metadata?.skills as string[] || []), "a2a-task-execution"];
      for (const skillId of skillIds) {
        const handler = this.taskHandlers.get(skillId);
        if (handler) {
          try {
            const result = await handler(task, (update: Partial<A2ATask>) => {
              Object.assign(task, update);
              // Send SSE progress update for each handler progress callback
              this.sendSSE(res, {
                type: "status_update",
                taskId: task.id,
                contextId: task.contextId || "",
                status: task.status,
              });
            }, ac.signal);
            // Handler completed — send final result via SSE
            task.status.state = "completed";
            task.status.timestamp = new Date().toISOString();
            if (!task.artifacts) {
              task.artifacts = [];
            }
            if (result.artifacts) {
              task.artifacts = result.artifacts;
            }
            this.sendSSE(res, {
              type: "status_update",
              taskId: task.id,
              contextId: task.contextId || "",
              status: task.status,
            });
            return;
          } catch (handlerError) {
            // If the handler signals session unavailable, continue to next handler / bridge.
            if (handlerError instanceof Error && handlerError.message.startsWith("PI_SESSION_UNAVAILABLE")) {
              continue; // Fall through to next handler / bridge
            }
            throw handlerError;
          }
        }
      }

      // No handler matched or PI_SESSION_UNAVAILABLE — fall back to PiTaskBridge
      const message = task.status.message;
      if (!message) {
        throw new Error("No message in task");
      }

      const textContent = message.parts
        .filter(p => p.type === "text")
        .map(p => p.text)
        .join("\n");

      // Execute with progress updates
      const result = await this.executePiTaskWithProgress(
        textContent,
        (progress) => {
          // Send progress update
          const statusUpdate = {
            type: "status_update" as const,
            taskId: task.id,
            contextId: task.contextId || "",
            status: {
              state: "working" as TaskState,
              message: {
                messageId: this.generateId(),
                role: "agent" as const,
                parts: [{ type: "text" as const, text: progress }],
              },
              timestamp: new Date().toISOString(),
            },
          };
          this.sendSSE(res, statusUpdate);
        },
        ac.signal
      );

      // Mark as completed
      task.status.state = "completed";
      task.status.timestamp = new Date().toISOString();

      if (!task.artifacts) {
        task.artifacts = [];
      }

      const artifact = {
        artifactId: this.generateId(),
        name: "result",
        parts: [{ type: "text" as const, text: result }],
      };
      
      task.artifacts.push(artifact);

      // Send final updates
      this.sendSSE(res, {
        type: "artifact_update",
        taskId: task.id,
        contextId: task.contextId || "",
        artifact,
        lastChunk: true,
      });

      this.sendSSE(res, {
        type: "status_update",
        taskId: task.id,
        contextId: task.contextId || "",
        status: task.status,
      });

      this.sendSSE(res, "[DONE]");
      res.end();
    } catch (error) {
      task.status.state = "failed";
      task.isError = true;
      task.error = String(error);
      task.status.timestamp = new Date().toISOString();

      this.sendSSE(res, {
        type: "status_update",
        taskId: task.id,
        contextId: task.contextId || "",
        status: task.status,
      });

      res.end();
    }
  }

  /**
   * Execute a task using pi's capabilities
   */
  private async executePiTask(message: string, signal?: AbortSignal): Promise<string> {
    return this.piTaskBridge.executeTask(message, signal);
  }

  /**
   * Execute a task with progress updates
   */
  private async executePiTaskWithProgress(
    message: string,
    onProgress: (progress: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    return this.piTaskBridge.executeTaskWithProgress(message, onProgress, signal);
  }

  /**
   * Check if request is authenticated
   */
  private isAuthenticated(req: http.IncomingMessage): boolean {
    // scheme "none": allow all ONLY when not in authFirst (hardened) mode.
    // authFirst + none is a misconfiguration that would silently void hardening,
    // so fail closed (forces a real scheme).
    if (this.security.defaultScheme === "none") {
      return !this.security.authFirst;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return false;
    }

    switch (this.security.defaultScheme) {
      case "bearer": {
        // Empty/missing configured token -> fail closed (never authenticate),
        // so an unconfigured bearer scheme can't be bypassed with "Bearer ".
        const expected = this.security.bearerToken;
        if (!expected) return false;
        return safeEqual(authHeader, `Bearer ${expected}`);
      }
      case "apiKey": {
        const expected = this.security.apiKey;
        if (!expected) return false;
        return safeEqual(authHeader, `ApiKey ${expected}`);
      }
      default:
        // oauth2/mtls not implemented -> fail closed (do not authenticate).
        return false;
    }
  }

  /**
   * Send SSE event
   */
  private sendSSE(res: http.ServerResponse, data: StreamResponse | string): void {
    if (typeof data === "string") {
      res.write(`data: ${data}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  /**
   * Notify all subscribers of a task update
   */
  private notifySubscribers(task: A2ATask): void {
    const subscribers = this.subscribers.get(task.id);
    if (!subscribers) return;

    const update: StreamResponse = {
      type: "task",
      task,
    };

    for (const res of subscribers) {
      this.sendSSE(res, update);
    }
  }

  /**
   * Send JSON-RPC response
   */
  private sendJSONRPCResponse(res: http.ServerResponse, id: string | number | null, result: unknown): void {
    const response: JSONRPCResponse = {
      jsonrpc: "2.0",
      id: id ?? null,
      result,
    };
    
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  /**
   * Send JSON-RPC error
   */
  private sendJSONRPCError(
    res: http.ServerResponse, 
    id: string | number | null, 
    code: number, 
    message: string,
    data?: unknown
  ): void {
    const response: JSONRPCResponse = {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message, data },
    };
    
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(response));
  }

  /**
   * Send HTTP error
   */
  private sendError(res: http.ServerResponse, status: number, message: string): void {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(status);
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  }

  /**
   * Create a new task
   */
  private createTask(message: Message, config?: unknown, metadata?: unknown): A2ATask {
    const now = new Date().toISOString();
    
    return {
      id: this.generateId(),
      contextId: message.contextId || this.generateId(),
      status: {
        state: "submitted",
        message,
        timestamp: now,
      },
      artifacts: [],
      history: [],
      metadata: metadata as Record<string, unknown> || {},
    };
  }

  /**
   * Load agent card from filesystem (config/agents/ directory).
   * Tries {hostname}-agent.json first, then agent.json, then falls back to hardcoded default.
   */
  private loadAgentCard(): AgentCard {
    const hostname = os.hostname();
    
    // Search paths for agent card, in priority order:
    // 1. ~/.pi/agent/a2a/agents/{hostname}-agent.json  (fleet-specific)
    // 2. ~/.pi/agent/a2a/agents/agent.json              (generic fallback)
    const homeDir = os.homedir();
    const searchPaths = [
      path.join(homeDir, '.pi', 'agent', 'a2a', 'agents', `${hostname}-agent.json`),
      path.join(homeDir, '.pi', 'agent', 'a2a', 'agents', 'agent.json'),
    ];

    for (const cardPath of searchPaths) {
      try {
        if (fs.existsSync(cardPath)) {
          const cardData = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
          // Keep the URL from the file (which has the correct node IP)
          // Only override if the file has no URL or an invalid one
          if (!cardData.url || cardData.url.includes('0.0.0.0')) {
            cardData.url = `http://${os.hostname()}:${this.config.port}`;
          }
          console.log(`[A2A] Loaded agent card from ${cardPath}`);
          this.agentCardPath = cardPath;
          return cardData as AgentCard;
        }
      } catch (err) {
        console.warn(`[A2A] Failed to load agent card from ${cardPath}:`, err);
      }
    }

    // Fall back to hardcoded default
    console.log('[A2A] No agent card file found, using default card');
    return this.createAgentCard();
  }

  /**
   * Create default agent card for this pi instance (fallback only)
   */
  private createAgentCard(): AgentCard {
    return {
      name: "pi-coding-agent",
      description: "pi coding agent exposed via A2A protocol",
      url: `http://${this.config.host}:${this.config.port}`,
      version: "1.0.0",
      provider: {
        organization: "pi",
        url: "https://pi.dev",
      },
      capabilities: {
        streaming: true,
        pushNotifications: true,
        extendedAgentCard: true,
      },
      skills: [
        {
          id: "code-generation",
          name: "Code Generation",
          description: "Generate code from natural language descriptions",
          tags: ["code", "generation", "programming"],
          examples: ["Write a Python function to sort a list", "Create a React component"],
        },
        {
          id: "code-analysis",
          name: "Code Analysis",
          description: "Analyze and review code for issues and improvements",
          tags: ["code", "analysis", "review"],
          examples: ["Review this function for bugs", "Explain what this code does"],
        },
        {
          id: "refactoring",
          name: "Refactoring",
          description: "Refactor code to improve structure and readability",
          tags: ["code", "refactoring", "improvement"],
          examples: ["Refactor this to use async/await", "Simplify this code"],
        },
      ],
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["text/plain", "application/json", "text/markdown", "text/code"],
      securitySchemes: {
        bearer: {
          type: "http",
          scheme: "bearer",
          description: "Bearer token authentication",
        },
      },
      securityRequirements: [{ schemes: { bearer: [] } }],
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

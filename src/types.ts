/**
 * Type definitions for pi-a2a-gateway extension
 * 
 * Based on A2A Protocol v1.0.0 Specification (a2a-protocol.org)
 */

// ═══════════════════════════════════════════════════════════════════════════
// A2A v1.0.0 SPEC CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A2A v1.0.0 JSON-RPC method names
 * See: https://a2a-protocol.org/v1.0.0/specification/ Section 7
 */
export const A2A_METHODS = {
  /** Send a message to an agent (non-streaming) */
  MESSAGE_SEND: 'message/send',
  /** Send a message to an agent (streaming SSE) */
  MESSAGE_STREAM: 'message/stream',
  /** Get task status */
  TASKS_GET: 'tasks/get',
  /** Cancel a task */
  TASKS_CANCEL: 'tasks/cancel',
  /** Subscribe to task updates (SSE) */
  TASKS_SUBSCRIBE: 'tasks/subscribe',
  /** Resubscribe to task updates after connection loss */
  TASKS_RESUBSCRIBE: 'tasks/resubscribe',
  /** Set push notification config for a task */
  TASKS_PUSH_NOTIFICATION_CONFIG_SET: 'tasks/pushNotificationConfig/set',
  /** Get push notification config for a task */
  TASKS_PUSH_NOTIFICATION_CONFIG_GET: 'tasks/pushNotificationConfig/get',
  /** Delete push notification config for a task */
  TASKS_PUSH_NOTIFICATION_CONFIG_DELETE: 'tasks/pushNotificationConfig/delete',
  /** Get authenticated extended agent card */
  AGENT_AUTHENTICATED_EXTENDED_CARD: 'agent/authenticatedExtendedCard',
} as const;

/** Type for A2A method name strings */
export type A2AMethodName = typeof A2A_METHODS[keyof typeof A2A_METHODS];

/**
 * A2A v1.0 Agent Card discovery path
 * See: https://a2a-protocol.org/v1.0.0/specification/ Section 5
 *
 * Per A2A v1.0 §8.2 and RFC 8615, the spec-compliant path is
 * /.well-known/agent-card.json (with .json suffix).
 * The local fork path /.well-known/agent.json is kept for backward compat.
 */
export const AGENT_CARD_PATH = '/.well-known/agent-card.json';

/**
 * @deprecated Use AGENT_CARD_PATH instead. Kept for backward compat.
 * This was the local fork path, not the spec path.
 */
export const LEGACY_AGENT_CARD_PATH_LOCAL = '/.well-known/agent.json';

/**
 * @deprecated Use AGENT_CARD_PATH instead. Kept for backward compat.
 * This was the npm v1.0.1 path, also not spec-compliant.
 */
export const LEGACY_AGENT_CARD_PATH_NPM = '/.well-known/agent-card';

/**
 * Discovery fallback paths — tried in order when the primary path fails.
 * Includes the spec path and both legacy paths for maximum compatibility.
 */
export const AGENT_CARD_DISCOVERY_PATHS = [
  AGENT_CARD_PATH,
  LEGACY_AGENT_CARD_PATH_LOCAL,
  LEGACY_AGENT_CARD_PATH_NPM,
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// A2A PROTOCOL TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agent Card - Self-describing manifest for an A2A agent
 */
export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  provider?: {
    organization: string;
    url?: string;
  };
  capabilities: AgentCapabilities;
  skills: AgentSkill[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  securitySchemes?: Record<string, SecurityScheme>;
  securityRequirements?: SecurityRequirement[];
  documentationUrl?: string;
  iconUrl?: string;
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  extendedAgentCard?: boolean;
  extensions?: AgentExtension[];
}

/**
 * Agent extension declaration
 */
export interface AgentExtension {
  uri: string;
  description?: string;
  required?: boolean;
  params?: Record<string, unknown>;
}

/**
 * Agent skill definition
 */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

/**
 * Security scheme (discriminated union based on OpenAPI 3.2)
 */
export type SecurityScheme =
  | { type: "apiKey"; location: "query" | "header" | "cookie"; name: string; description?: string }
  | { type: "http"; scheme: string; bearerFormat?: string; description?: string }
  | { type: "oauth2"; flows: OAuthFlows; description?: string }
  | { type: "openIdConnect"; openIdConnectUrl: string; description?: string }
  | { type: "mutualTLS"; description?: string };

/**
 * OAuth flows configuration
 */
export interface OAuthFlows {
  authorizationCode?: {
    authorizationUrl: string;
    tokenUrl: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
    pkceRequired?: boolean;
  };
  clientCredentials?: {
    tokenUrl: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
  };
  deviceCode?: {
    deviceAuthorizationUrl: string;
    tokenUrl: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
  };
}

/**
 * Security requirement
 */
export interface SecurityRequirement {
  schemes: Record<string, string[]>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Task state enumeration
 */
export type TaskState =
  | "submitted"
  | "working"
  | "input_required"
  | "auth_required"
  | "completed"
  | "failed"
  | "canceled"
  | "rejected";

/**
 * Task status
 */
export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string;
}

/**
 * A2A Task
 */
export interface A2ATask {
  id: string;
  contextId?: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: Message[];
  metadata?: Record<string, unknown>;
  isError?: boolean;
  error?: string;
}

/**
 * Message in A2A protocol
 */
export interface Message {
  messageId: string;
  contextId?: string;
  taskId?: string;
  role: "user" | "agent";
  parts: Part[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
  referenceTaskIds?: string[];
}

/**
 * Message part (content container)
 */
export type Part =
  | { type: "text"; text: string; metadata?: Record<string, unknown> }
  | { type: "file"; filename?: string; mediaType?: string; raw?: Uint8Array; url?: string; metadata?: Record<string, unknown> }
  | { type: "data"; data: unknown; metadata?: Record<string, unknown> };

/**
 * Artifact (task output)
 */
export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Client configuration
 */
export interface ClientConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  maxConcurrentTasks: number;
  streamingEnabled: boolean;
  http2?: boolean;
  keepAlive?: boolean;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  enabled: boolean;
  port: number;
  host: string;
  basePath: string;
  ssl?: {
    cert: string;
    key: string;
    ca?: string;
  };
  cors?: {
    origins: string[];
    methods: string[];
  };
}

/**
 * Discovery configuration
 */
export interface DiscoveryConfig {
  cacheEnabled: boolean;
  cacheTtl: number;
  agentCardPath: string;
  timeout?: number;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  defaultScheme: "bearer" | "apiKey" | "oauth2" | "mtls" | "none";
  verifySsl: boolean;
  /** When true, the public agent-card endpoint ALSO requires auth (hardened profile).
   *  Default false = A2A v1.0 spec-compliant public card (discoverable pre-auth). */
  authFirst?: boolean;
  apiKey?: string;
  bearerToken?: string;
  oauth2Config?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scopes: string[];
  };
  mtlsConfig?: {
    cert: string;
    key: string;
    ca?: string;
  };
}

/**
 * Complete A2A configuration
 */
/**
 * Bridge configuration for task execution
 */
export interface BridgeConfig {
  /** Bridge type: 'noop' for placeholder, 'subprocess' for pi CLI */
  type: "noop" | "subprocess";
  /** Command to invoke (subprocess only, default: 'pi') */
  command?: string;
  /** Timeout in ms (subprocess only, default: 120000; fleet uses 300000) */
  timeout?: number;
  /** Provider for pi --print (optional; opt-in — bypasses the model-router when set) */
  provider?: string;
  /** Model for pi --print (optional; opt-in — pins to a specific local model when set) */
  model?: string;
  /** Tools to enable (optional; opt-in — passed via --tools when set) */
  tools?: string;
  /** Disable extension discovery in the subprocess (optional; opt-in, default false) */
  noExtensions?: boolean;
  /**
   * System prompt for the subprocess (optional; opt-in — passed via --system-prompt when set).
   * Fleet use: a fleet-executor prompt that steers the weak local model to actually invoke
   * tools and paste real stdout instead of narrating command plans (Phase EXEC Tier A).
   */
  systemPrompt?: string;
  /** Text appended to the subprocess system prompt (optional; opt-in — passed via --append-system-prompt when set) */
  appendSystemPrompt?: string;
  /** Max concurrent subprocess executions (default 2; protects CPU/RAM on small nodes) */
  maxConcurrent?: number;
  /** Max bytes captured per stream before killing the child (default 10 MB) */
  maxBufferBytes?: number;
  /** Narration-detection guard (Phase EXEC Tier B; opt-in, default false). */
  narrationGuardEnabled?: boolean;
  /** Max narration-guard re-runs (default 1; 0 disables even when guard enabled). */
  narrationMaxRetries?: number;
}

export interface A2AConfig {
  client: ClientConfig;
  server: ServerConfig;
  discovery: DiscoveryConfig;
  security: SecurityConfig;
  bridge?: BridgeConfig;
}

// ═══════════════════════════════════════════════════════════════════════════
// REMOTE AGENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Remote agent with cached metadata
 */
export interface RemoteAgent extends AgentCard {
  url: string;
  discoveredAt: number;
  lastUsedAt?: number;
  healthStatus?: "healthy" | "unhealthy" | "unknown";
  healthCheckedAt?: number;
}

/**
 * Task options
 */
export interface TaskOptions {
  streaming?: boolean;
  timeout?: number;
  signal?: AbortSignal;
  historyLength?: number;
  returnImmediately?: boolean;
  pushNotificationConfig?: PushNotificationConfig;
  metadata?: Record<string, unknown>;
}

/**
 * Push notification configuration
 */
export interface PushNotificationConfig {
  url: string;
  token?: string;
  authentication?: {
    scheme: string;
    credentials: string;
  };
}

/**
 * Parameters for setting push notification config
 */
export interface PushNotificationConfigSetParams {
  id: string;
  pushNotificationConfig: PushNotificationConfig;
}

/**
 * Parameters for getting push notification config
 */
export interface PushNotificationConfigGetParams {
  id: string;
}

/**
 * Parameters for deleting push notification config
 */
export interface PushNotificationConfigDeleteParams {
  id: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// JSON-RPC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * JSON-RPC 2.0 request
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 response
 */
export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 error codes
 */
export enum JSONRPCErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,
  TaskNotFound = -32001,
  TaskAlreadyExists = -32002,
  UnsupportedOperation = -32003,
}

// ═══════════════════════════════════════════════════════════════════════════
// STREAMING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stream response wrapper
 */
export type StreamResponse =
  | { type: "task"; task: A2ATask }
  | { type: "message"; message: Message }
  | { type: "status_update"; taskId: string; contextId: string; status: TaskStatus }
  | { type: "artifact_update"; taskId: string; contextId: string; artifact: Artifact; append?: boolean; lastChunk?: boolean };

/**
 * Task update callback
 */
export type TaskUpdateCallback = (update: Partial<A2ATask>) => void;

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cached agent entry
 */
export interface CachedAgent {
  agent: RemoteAgent;
  cachedAt: number;
  etag?: string;
}

/**
 * Pending task entry
 */
export interface PendingTask {
  taskId: string;
  agentUrl: string;
  promise: Promise<A2ATask>;
  abortController: AbortController;
  startTime: number;
  options: TaskOptions;
}

/**
 * Task chain configuration
 */
export interface TaskChainConfig {
  steps: Array<{
    agent: RemoteAgent;
    message: string;
    options?: TaskOptions;
  }>;
  continueOnError?: boolean;
}

/**
 * Parallel task configuration
 */
export interface ParallelTaskConfig {
  agent: RemoteAgent;
  message: string;
  options?: TaskOptions;
}

/**
 * Agent health check result
 */
export interface AgentHealth {
  url: string;
  status: "healthy" | "unhealthy" | "unknown";
  latency: number;
  error?: string;
  checkedAt: number;
}

/**
 * Load balancing strategy
 */
export type LoadBalanceStrategy = "round_robin" | "least_connections" | "random" | "weighted";

/**
 * Agent pool configuration
 */
export interface AgentPool {
  name: string;
  agents: RemoteAgent[];
  strategy: LoadBalanceStrategy;
  healthCheck?: boolean;
  healthCheckInterval?: number;
}

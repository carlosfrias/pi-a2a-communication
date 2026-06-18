import { describe, it, expect } from 'vitest';

/**
 * Characterization Tests — Type Definitions
 *
 * These tests lock down the EXISTING type shapes from types.ts.
 * If these pass, the type contract hasn't changed.
 *
 * Priority: P0 — types are the foundation for everything else.
 * Must be characterized before adding spec-compliant types.
 */

import type {
  AgentCard,
  AgentCapabilities,
  AgentSkill,
  AgentExtension,
  TaskState,
  A2ATask,
  Message,
  Part,
  Artifact,
  ClientConfig,
  ServerConfig,
  DiscoveryConfig,
  SecurityConfig,
  A2AConfig,
  RemoteAgent,
  TaskOptions,
  PushNotificationConfig,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCErrorCode,
  StreamResponse,
  TaskUpdateCallback,
  CachedAgent,
  PendingTask,
  TaskChainConfig,
  ParallelTaskConfig,
  AgentHealth,
  LoadBalanceStrategy,
  AgentPool
} from '../../types';

describe('Type Definitions — Characterization', () => {
  describe('AgentCard', () => {
    it('should allow creating a valid AgentCard', () => {
      const card: AgentCard = {
        name: 'test-agent',
        description: 'A test agent',
        url: 'http://localhost:8080',
        version: '1.0.0',
        capabilities: {
          streaming: true,
          pushNotifications: false,
          extendedAgentCard: false
        },
        skills: [
          {
            id: 'skill-1',
            name: 'Test Skill',
            description: 'A test skill'
          }
        ],
        securitySchemes: {},
        security: []
      };
      expect(card.name).toBe('test-agent');
      expect(card.capabilities.streaming).toBe(true);
      expect(card.skills).toHaveLength(1);
    });
  });

  describe('TaskState', () => {
    it('should include all defined states', () => {
      // These are the states defined in the current types
      const states: TaskState[] = [
        'submitted',
        'working',
        'completed',
        'failed',
        'canceled',
        'input_required',
        'auth_required',
        'rejected'
      ];
      expect(states).toHaveLength(8);
      // Verify each state is a valid string
      states.forEach(state => {
        expect(state).toBeTypeOf('string');
      });
    });
  });

  describe('A2ATask', () => {
    it('should allow creating a task with all fields', () => {
      const task: A2ATask = {
        id: 'task-123',
        status: {
          state: 'working' as TaskState,
          timestamp: new Date().toISOString()
        },
        messages: [],
        artifacts: [],
        metadata: { source: 'test' }
      };
      expect(task.id).toBe('task-123');
      expect(task.status.state).toBe('working');
    });
  });

  describe('Part (discriminated union)', () => {
    it('should create TextPart', () => {
      const part: Part = {
        type: 'text',
        text: 'Hello, world!'
      };
      expect(part.type).toBe('text');
      if (part.type === 'text') {
        expect(part.text).toBe('Hello, world!');
      }
    });

    it('should create DataPart', () => {
      const part: Part = {
        type: 'data',
        data: { key: 'value' }
      };
      expect(part.type).toBe('data');
      if (part.type === 'data') {
        expect(part.data).toEqual({ key: 'value' });
      }
    });

    it('should create FilePart', () => {
      const part: Part = {
        type: 'file',
        file: {
          url: 'http://example.com/file.pdf',
          mimeType: 'application/pdf'
        }
      };
      expect(part.type).toBe('file');
      if (part.type === 'file') {
        expect(part.file.url).toBe('http://example.com/file.pdf');
      }
    });
  });

  describe('JSONRPCRequest', () => {
    it('should create a valid JSON-RPC request', () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'sendMessage',
        params: {
          message: {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }]
          }
        }
      };
      expect(request.jsonrpc).toBe('2.0');
      expect(request.method).toBe('sendMessage');
    });
  });

  describe('JSONRPCResponse', () => {
    it('should create a success response', () => {
      const response: JSONRPCResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { id: 'task-123', status: { state: 'completed' } }
      };
      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
    });

    it('should create an error response', () => {
      const response: JSONRPCResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32600);
    });
  });

  describe('PushNotificationConfig', () => {
    it('should create a push notification config', () => {
      const config: PushNotificationConfig = {
        url: 'https://example.com/webhook',
        token: 'secret-token'
      };
      expect(config.url).toBe('https://example.com/webhook');
    });
  });

  describe('StreamResponse (discriminated union)', () => {
    it('should create a task update', () => {
      const update: StreamResponse = {
        type: 'task',
        task: {
          id: 'task-123',
          status: { state: 'working', timestamp: new Date().toISOString() }
        }
      };
      expect(update.type).toBe('task');
    });

    it('should create a status update', () => {
      const update: StreamResponse = {
        type: 'status_update',
        task_id: 'task-123',
        status: { state: 'completed', timestamp: new Date().toISOString() }
      };
      expect(update.type).toBe('status_update');
    });

    it('should create an artifact update', () => {
      const update: StreamResponse = {
        type: 'artifact',
        task_id: 'task-123',
        artifact: {
          parts: [{ type: 'text', text: 'result' }]
        }
      };
      expect(update.type).toBe('artifact');
    });
  });

  describe('SecurityConfig', () => {
    it('should create a bearer token security config', () => {
      const config: SecurityConfig = {
        type: 'bearer',
        token: 'my-secret-token'
      };
      expect(config.type).toBe('bearer');
    });

    it('should create an API key security config', () => {
      const config: SecurityConfig = {
        type: 'apiKey',
        token: 'my-api-key',
        headerName: 'X-API-Key'
      };
      expect(config.type).toBe('apiKey');
    });
  });

  describe('ClientConfig', () => {
    it('should create a client config with defaults', () => {
      const config: ClientConfig = {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      };
      expect(config.timeout).toBe(30000);
    });
  });

  describe('ServerConfig', () => {
    it('should create a server config', () => {
      const config: ServerConfig = {
        port: 10000,
        host: '0.0.0.0',
        enabled: true
      };
      expect(config.port).toBe(10000);
    });
  });
});
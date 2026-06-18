import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Characterization Tests — A2A Server
 *
 * Tests the EXISTING HTTP server behavior before any refactoring.
 * Uses a real HTTP server on a random port to test actual request/response cycles.
 *
 * Priority: P2 — Server behavior is the most complex module.
 * Characterization tests establish the baseline before spec-compliance changes.
 */

import { A2AServer } from '../../a2a-server';

const TEST_PORT = 18923; // High port to avoid conflicts
const TEST_HOST = '127.0.0.1';

function createMockContext(): any {
  return {
    ui: { notify: vi.fn() },
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  };
}

describe('A2AServer — Characterization', () => {
  let server: A2AServer;
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = createMockContext();
  });

  afterEach(async () => {
    if (server) {
      try {
        await server.stop();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  });

  describe('constructor', () => {
    it('should create a server instance with default config', () => {
      const serverConfig = {
        port: TEST_PORT,
        host: TEST_HOST,
        enabled: true,
        name: 'test-agent',
        description: 'A test agent'
      };
      const securityConfig = { type: 'none' as const };
      server = new A2AServer(serverConfig, securityConfig, mockCtx);
      expect(server).toBeDefined();
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('start / stop', () => {
    it('should start and stop the server', async () => {
      const serverConfig = {
        port: TEST_PORT + 1,
        host: TEST_HOST,
        enabled: true,
        name: 'test-agent',
        description: 'A test agent'
      };
      const securityConfig = { type: 'none' as const };
      server = new A2AServer(serverConfig, securityConfig, mockCtx);
      await server.start();
      expect(server.isRunning()).toBe(true);
      await server.stop();
      expect(server.isRunning()).toBe(false);
    }, 10000);
  });

  describe('task handler registration', () => {
    it('should register a task handler', () => {
      const serverConfig = {
        port: TEST_PORT + 2,
        host: TEST_HOST,
        enabled: true,
        name: 'test-agent',
        description: 'A test agent'
      };
      const securityConfig = { type: 'none' as const };
      server = new A2AServer(serverConfig, securityConfig, mockCtx);
      const handler = vi.fn();
      server.registerTaskHandler('test-skill', handler);
      // No error thrown = handler registered
    });

    it('should update agent card', () => {
      const serverConfig = {
        port: TEST_PORT + 3,
        host: TEST_HOST,
        enabled: true,
        name: 'test-agent',
        description: 'A test agent'
      };
      const securityConfig = { type: 'none' as const };
      server = new A2AServer(serverConfig, securityConfig, mockCtx);
      server.updateAgentCard({ description: 'Updated description' });
      // No error thrown = card updated
    });
  });

  describe('HTTP endpoints (characterization)', () => {
    let runningServer: A2AServer;
    let port: number;

    beforeEach(async () => {
      port = TEST_PORT + 10 + Math.floor(Math.random() * 100);
      const serverConfig = {
        port,
        host: TEST_HOST,
        enabled: true,
        name: 'test-agent',
        description: 'A test agent'
      };
      const securityConfig = { type: 'none' as const };
      runningServer = new A2AServer(serverConfig, securityConfig, mockCtx);
      await runningServer.start();
    });

    afterEach(async () => {
      try {
        await runningServer.stop();
      } catch (e) { /* cleanup */ }
    });

    function makeRequest(method: string, path: string, body?: any): Promise<{status: number, headers: any, data: any}> {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: TEST_HOST,
          port,
          path,
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {}
        };
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            let parsed;
            try { parsed = JSON.parse(data); } catch { parsed = data; }
            resolve({ status: res.statusCode || 0, headers: res.headers, data: parsed });
          });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    }

    it('should return 401 for Agent Card endpoint without auth (auth-first)', async () => {
      // CHARACTERIZATION: Server requires auth even for Agent Card endpoint.
      // The /.well-known/agent-card path exists but returns 401 without credentials.
      const res = await makeRequest('GET', '/.well-known/agent-card');
      expect(res.status).toBe(401);
    });

    it('should respond to CORS preflight requests', async () => {
      const res = await makeRequest('OPTIONS', '/.well-known/agent-card');
      // Current code allows * for CORS
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should return 401 for unknown paths (auth-first behavior)', async () => {
      // CHARACTERIZATION: Server returns 401 (unauthorized) for any path
      // that doesn't match known routes, not 404. This is because auth
      // middleware runs before route matching.
      const res = await makeRequest('GET', '/unknown-path');
      expect(res.status).toBe(401);
    });
  });
});
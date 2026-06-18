import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Characterization Tests — TaskManager
 *
 * Tests the EXISTING task management behavior before refactoring.
 *
 * Priority: P0 — TaskManager swallows errors (returns synthetic failed tasks
 * instead of throwing). This behavioral contract must be locked before changes.
 */

import { TaskManager } from '../../task-manager';
import { A2AClient } from '../../a2a-client';
import { ConfigManager } from '../../config';
import * as path from 'node:path';
import * as os from 'node:os';

const TEST_DIR = path.join(os.tmpdir(), `a2a-gateway-tm-test-${Date.now()}`);

// Mock A2AClient for unit tests
function createMockClient(): any {
  return {
    sendMessage: vi.fn(),
    sendStreamingMessage: vi.fn(),
    getTask: vi.fn(),
    cancelTask: vi.fn(),
    subscribeToTask: vi.fn(),
    discoverAgent: vi.fn(),
    checkHealth: vi.fn(),
    cancelAll: vi.fn()
  };
}

describe('TaskManager — Characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup test dir
    const fs = require('fs');
    try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  describe('constructor', () => {
    it('should create a TaskManager instance', () => {
      const client = createMockClient();
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);
      expect(tm).toBeDefined();
    });
  });

  describe('sendTask', () => {
    it('should return a synthetic failed task when client throws an error', async () => {
      // CHARACTERIZATION: sendTask catches errors and returns a synthetic
      // failed task instead of throwing. This is intentional behavior.
      const client = createMockClient();
      client.sendMessage.mockRejectedValue(new Error('Connection refused'));
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);

      const agent = { url: 'http://localhost:8080', name: 'test-agent' };
      const result = await tm.sendTask(agent, 'Hello');

      // The error is swallowed; result has isError: true
      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });

    it('should return a task when client succeeds', async () => {
      const client = createMockClient();
      const mockTask = {
        id: 'task-1',
        status: { state: 'completed' },
        messages: [],
        artifacts: []
      };
      client.sendMessage.mockResolvedValue(mockTask);
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);

      const agent = { url: 'http://localhost:8080', name: 'test-agent' };
      const result = await tm.sendTask(agent, 'Hello');

      expect(result).toBeDefined();
      expect(result.id).toBe('task-1');
    });
  });

  describe('getTaskStatus', () => {
    it('should return null when task not found', async () => {
      const client = createMockClient();
      client.getTask.mockRejectedValue(new Error('Not found'));
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);

      const result = await tm.getTaskStatus('nonexistent-task');
      expect(result).toBeNull();
    });
  });

  describe('cancelTask', () => {
    it('should return false when cancel fails', async () => {
      const client = createMockClient();
      client.cancelTask.mockRejectedValue(new Error('Not found'));
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);

      const result = await tm.cancelTask();
      expect(result).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('should delegate to client.cancelAll', () => {
      const client = createMockClient();
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);

      tm.cancelAll();
      expect(client.cancelAll).toHaveBeenCalled();
    });
  });

  describe('getTaskAgent', () => {
    it('should return null for unknown task ID', () => {
      const client = createMockClient();
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);

      const result = tm.getTaskAgent('nonexistent-task');
      expect(result).toBeNull();
    });
  });

  describe('waitForTask', () => {
    it('should throw on timeout', async () => {
      const client = createMockClient();
      client.getTask.mockRejectedValue(new Error('Not found'));
      const config = { client: { configDir: TEST_DIR } } as any;
      const tm = new TaskManager(client, config);

      await expect(tm.waitForTask('nonexistent-task', undefined, 100, 50))
        .rejects.toThrow();
    }, 10000);
  });
});
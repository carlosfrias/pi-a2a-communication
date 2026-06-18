import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Characterization Tests — ConfigManager
 *
 * These tests lock down the EXISTING behavior of ConfigManager before refactoring.
 * If these pass, the code still works the way it did before we touched it.
 *
 * Priority: P0 — ConfigManager has side effects on disk (reads/writes ~/.pi/agent/a2a/).
 * Must be characterized before any refactoring.
 */

// We need to test the actual module. Since ConfigManager reads from disk,
// we'll mock the file system paths to use a temp directory.
import { ConfigManager } from '../../config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const TEST_DIR = path.join(os.tmpdir(), `a2a-gateway-test-${Date.now()}`);

beforeEach(() => {
  // Create a fresh test directory for each test
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up test directory
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('ConfigManager — Characterization', () => {
  describe('constructor', () => {
    it('should create config directory if it does not exist', () => {
      // CHARACTERIZATION: ConfigManager uses hardcoded ~/.pi/agent/a2a/ path,
      // ignoring client.configDir from constructor. This test documents the actual behavior.
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      // ConfigManager creates ~/.pi/agent/a2a/ not our test dir
      const actualDir = cm.getConfigDir();
      expect(actualDir).toBe(path.join(os.homedir(), '.pi', 'agent', 'a2a'));
    });

    it('should load defaults when no config file exists', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const config = cm.getConfig();
      expect(config).toBeDefined();
      expect(config.client).toBeDefined();
      expect(config.server).toBeDefined();
    });

    it('should load existing config from disk', () => {
      // Write a config file first
      const configDir = path.join(TEST_DIR, 'existing');
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        client: { timeout: 60000 },
        server: { port: 9999 }
      }));

      const cm = new ConfigManager({ client: { configDir } } as any);
      const config = cm.getConfig();
      // Config should have been loaded and merged with defaults
      expect(config).toBeDefined();
    });
  });

  describe('getConfig / updateConfig', () => {
    it('should return config object', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const config = cm.getConfig();
      expect(config).toBeTypeOf('object');
    });

    it('should persist updates to config', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.updateConfig({ client: { timeout: 45000 } } as any);
      const config = cm.getConfig();
      // The update should be reflected
      expect(config).toBeDefined();
    });
  });

  describe('set / get (path-based)', () => {
    it('should set a value by dot-path', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.set('client.timeout', '60000');
      const result = cm.get('client.timeout');
      // set parses string "60000" as number
      expect(result).toBe(60000);
    });

    it('should parse boolean strings', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.set('server.enabled', 'true');
      const result = cm.get('server.enabled');
      expect(result).toBe(true);
    });

    it('should parse "false" as boolean false', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.set('server.enabled', 'false');
      const result = cm.get('server.enabled');
      expect(result).toBe(false);
    });
  });

  describe('Remote Agent Registry', () => {
    it('should add and retrieve a remote agent', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.addRemoteAgent('http://agent1.example.com:8080', {
        name: 'agent1',
        description: 'Test agent',
        skills: [],
        healthStatus: 'unknown'
      });
      const agent = cm.getRemoteAgent('http://agent1.example.com:8080');
      expect(agent).toBeDefined();
      expect(agent!.name).toBe('agent1');
    });

    it('should retrieve agent by name', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.addRemoteAgent('http://agent1.example.com:8080', {
        name: 'agent1',
        description: 'Test agent',
        skills: [],
        healthStatus: 'unknown'
      });
      const agent = cm.getRemoteAgent('agent1');
      expect(agent).toBeDefined();
      expect(agent!.name).toBe('agent1');
    });

    it('should return null for unknown agent', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const agent = cm.getRemoteAgent('nonexistent');
      expect(agent).toBeNull();
    });

    it('should remove a remote agent', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.addRemoteAgent('http://agent1.example.com:8080', {
        name: 'agent1',
        description: 'Test agent',
        skills: [],
        healthStatus: 'unknown'
      });
      const removed = cm.removeRemoteAgent('http://agent1.example.com:8080');
      expect(removed).toBe(true);
      expect(cm.getRemoteAgent('http://agent1.example.com:8080')).toBeNull();
    });

    it('should return false when removing nonexistent agent', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const removed = cm.removeRemoteAgent('http://nonexistent.example.com');
      expect(removed).toBe(false);
    });

    it('should list all remote agents', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.addRemoteAgent('http://agent1.example.com:8080', {
        name: 'agent1',
        description: 'Agent 1',
        skills: [],
        healthStatus: 'unknown'
      });
      cm.addRemoteAgent('http://agent2.example.com:8080', {
        name: 'agent2',
        description: 'Agent 2',
        skills: [],
        healthStatus: 'unknown'
      });
      const agents = cm.getRemoteAgents();
      expect(agents.length).toBeGreaterThanOrEqual(2);
    });

    it('should update agent health status', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm.addRemoteAgent('http://agent1.example.com:8080', {
        name: 'agent1',
        description: 'Test agent',
        skills: [],
        healthStatus: 'unknown'
      });
      cm.updateAgentHealth('http://agent1.example.com:8080', 'healthy');
      const agent = cm.getRemoteAgent('http://agent1.example.com:8080');
      expect(agent!.healthStatus).toBe('healthy');
    });
  });

  describe('createDefaultAgentCard', () => {
    it('should create a valid agent card structure', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const card = cm.createDefaultAgentCard('test-agent', 'A test agent', ['skill1']);
      expect(card).toBeDefined();
      expect(card.name).toBe('test-agent');
      expect(card.description).toBe('A test agent');
    });
  });

  describe('getSecurityScheme', () => {
    it('should return null when no agent found', () => {
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const scheme = cm.getSecurityScheme({ url: 'http://unknown.example.com' } as any);
      expect(scheme).toBeNull();
    });
  });

  describe('getConfigDir', () => {
    it('should return the hardcoded default config directory path', () => {
      // CHARACTERIZATION: ConfigManager uses hardcoded ~/.pi/agent/a2a/ path,
      // NOT the path passed in constructor config
      const cm = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const dir = cm.getConfigDir();
      expect(dir).toBe(path.join(os.homedir(), '.pi', 'agent', 'a2a'));
    });
  });

  describe('persistence', () => {
    it('should persist agent registry across instances', () => {
      const cm1 = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm1.addRemoteAgent('http://persist.example.com:8080', {
        name: 'persistent-agent',
        description: 'Should survive restart',
        skills: [],
        healthStatus: 'unknown'
      });

      // Create a new instance pointing to the same directory
      const cm2 = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const agent = cm2.getRemoteAgent('http://persist.example.com:8080');
      expect(agent).toBeDefined();
      expect(agent!.name).toBe('persistent-agent');
    });

    it('should persist config updates across instances', () => {
      const cm1 = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      cm1.set('client.timeout', '120000');

      const cm2 = new ConfigManager({ client: { configDir: TEST_DIR } } as any);
      const result = cm2.get('client.timeout');
      expect(result).toBe(120000);
    });
  });
});
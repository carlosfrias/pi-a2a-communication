#!/usr/bin/env node
/**
 * generate-agent-cards.ts
 *
 * Generates A2A Agent Cards for each fleet node based on Ansible inventory
 * and model-router configuration. Outputs JSON files to ~/.pi/agent/a2a/agents/
 *
 * Usage: bun run generate-agent-cards.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Fleet node definitions from inventory.yml
interface FleetNode {
  hostname: string;
  ip: string;
  ram: string;
  role: 'worker' | 'hub';
  models: string[];
}

// A2A v1.0 Agent Card structure
interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    extendedAgentCard: boolean;
  };
  skills: AgentSkill[];
  securitySchemes: Record<string, SecurityScheme>;
  security: SecurityRequirement[];
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
}

interface SecurityRequirement {
  [schemeId: string]: string[];
}

const A2A_DIR = path.join(os.homedir(), '.pi', 'agent', 'a2a');
const AGENTS_DIR = path.join(A2A_DIR, 'agents');

// Fleet definition (from inventory.yml + model-router configs)
const FLEET_NODES: FleetNode[] = [
  { hostname: 'fnet1', ip: '192.168.0.141', ram: '8GB', role: 'worker', models: ['qwen3.5:4b'] },
  { hostname: 'fnet2', ip: '192.168.0.142', ram: '16GB', role: 'hub', models: [] }, // Hub only, no worker models
  { hostname: 'fnet3', ip: '192.168.0.143', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
  { hostname: 'fnet4', ip: '192.168.0.144', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
  { hostname: 'fnet5', ip: '192.168.0.145', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
  { hostname: 'fnet6', ip: '192.168.0.146', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
  { hostname: 'fnet7', ip: '192.168.0.147', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
];

// Model capability tiers
const MODEL_SKILLS: Record<string, AgentSkill[]> = {
  'qwen3.5:4b': [
    {
      id: 'low-complexity-tasks',
      name: 'Low Complexity Tasks',
      description: 'Simple tasks: formatting, summarization, classification, basic extraction',
      tags: ['low-complexity', 'text-generation', 'summarization'],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['text/plain', 'application/json']
    }
  ],
  'qwen3:8b': [
    {
      id: 'medium-complexity-tasks',
      name: 'Medium Complexity Tasks',
      description: 'Multi-step reasoning, code generation, structured analysis',
      tags: ['medium-complexity', 'code-generation', 'analysis'],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['text/plain', 'application/json']
    }
  ],
  'gemma4:12b': [
    {
      id: 'high-complexity-tasks',
      name: 'High Complexity Tasks',
      description: 'Complex reasoning, multi-step problem solving, detailed analysis',
      tags: ['high-complexity', 'reasoning', 'problem-solving'],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['text/plain', 'application/json']
    }
  ]
};

function generateAgentCard(node: FleetNode, port: number = 10000): AgentCard {
  const isHub = node.role === 'hub';
  const skills: AgentSkill[] = [];

  // Add skills based on available models
  if (!isHub) {
    for (const model of node.models) {
      const modelSkills = MODEL_SKILLS[model];
      if (modelSkills) {
        skills.push(...modelSkills);
      }
    }

    // Add fleet-specific skills
    skills.push({
      id: 'coms-net-relay',
      name: 'Coms-Net Relay',
      description: 'Can relay messages to other fleet nodes via coms-net hub',
      tags: ['relay', 'fleet', 'coms-net'],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['text/plain', 'application/json']
    });
  } else {
    // Hub node skills
    skills.push({
      id: 'fleet-coordination',
      name: 'Fleet Coordination',
      description: 'Routes tasks to appropriate fleet nodes based on complexity and availability',
      tags: ['coordination', 'routing', 'fleet'],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['text/plain', 'application/json']
    });
  }

  return {
    name: node.hostname,
    description: isHub
      ? `Fleet hub node (${node.ram} RAM) — coordinates task distribution across fleet`
      : `Fleet worker node (${node.ram} RAM) — runs ${node.models.join(', ')} for distributed task execution`,
    url: `http://${node.ip}:${port}`,
    version: '0.1.0',
    capabilities: {
      streaming: true,          // We're adding SSE streaming in Phase 1 M4
      pushNotifications: false, // Not yet implemented (Phase 1 M4)
      extendedAgentCard: false  // Not yet implemented
    },
    skills,
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    },
    security: [
      { bearer: [] },
      { apiKey: [] }
    ]
  };
}

// Main
function main() {
  // Ensure output directory exists
  fs.mkdirSync(AGENTS_DIR, { recursive: true });

  console.log(`Generating A2A Agent Cards for ${FLEET_NODES.length} fleet nodes...`);
  console.log(`Output directory: ${AGENTS_DIR}\n`);

  for (const node of FLEET_NODES) {
    const card = generateAgentCard(node);
    const filename = `${node.hostname}-agent.json`;
    const filepath = path.join(AGENTS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(card, null, 2));
    console.log(`✓ ${node.hostname} (${node.ip}) → ${filename}`);
    console.log(`  Skills: ${card.skills.map(s => s.id).join(', ')}`);
    console.log(`  URL: ${card.url}`);
    console.log(`  Security: ${Object.keys(card.securitySchemes).join(', ')}\n`);
  }

  // Generate orchestrator card (carlos-desktop)
  const orchestratorCard: AgentCard = {
    name: 'carlos-desktop',
    description: 'Orchestrator node — dispatches tasks to fleet, manages D-E-V pipeline, hosts A2A gateway',
    url: 'http://192.168.0.100:10000', // Orchestrator IP on LAN
    version: '0.1.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      extendedAgentCard: false
    },
    skills: [
      {
        id: 'decompose-execute-verify',
        name: 'D-E-V Pipeline',
        description: 'Decompose-Execute-Verify pipeline: decomposes complex tasks, dispatches sub-tasks to fleet, verifies results',
        tags: ['orchestration', 'decompose', 'verify', 'fleet'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json']
      },
      {
        id: 'fleet-dispatcher',
        name: 'Fleet Dispatcher',
        description: 'Routes tasks to fleet nodes via coms-net or A2A, with three-tier cascade (fleet → intercom → subagent)',
        tags: ['dispatch', 'routing', 'cascade'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json']
      }
    ],
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    security: [
      { bearer: [] }
    ]
  };

  const orchestratorFile = path.join(AGENTS_DIR, 'carlos-desktop-agent.json');
  fs.writeFileSync(orchestratorFile, JSON.stringify(orchestratorCard, null, 2));
  console.log(`✓ carlos-desktop (orchestrator) → carlos-desktop-agent.json`);
  console.log(`  Skills: ${orchestratorCard.skills.map(s => s.id).join(', ')}`);
  console.log(`  URL: ${orchestratorCard.url}\n`);

  // Generate combined fleet registry
  const registry = {
    version: '0.1.0',
    generated: new Date().toISOString(),
    hub: {
      hostname: 'fnet2',
      ip: '192.168.0.142',
      comsNetPort: 8080,
      a2aPort: 10000
    },
    nodes: FLEET_NODES.map(node => ({
      hostname: node.hostname,
      ip: node.ip,
      ram: node.ram,
      role: node.role,
      models: node.models,
      agentCardFile: `${node.hostname}-agent.json`,
      a2aUrl: `http://${node.ip}:10000`
    }))
  };

  const registryFile = path.join(AGENTS_DIR, 'fleet-registry.json');
  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));
  console.log(`✓ Fleet registry → fleet-registry.json`);
  console.log(`  Total nodes: ${FLEET_NODES.length}`);
  console.log(`  Workers: ${FLEET_NODES.filter(n => n.role === 'worker').length}`);
  console.log(`  Hub: ${FLEET_NODES.filter(n => n.role === 'hub').length}`);
}

main();
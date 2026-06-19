#!/usr/bin/env node
"use strict";
/**
 * generate-agent-cards.ts
 *
 * Generates A2A Agent Cards for each fleet node based on Ansible inventory
 * and model-router configuration. Outputs JSON files to ~/.pi/agent/a2a/agents/
 *
 * Usage: bun run generate-agent-cards.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("node:fs");
var path = require("node:path");
var os = require("node:os");
var A2A_DIR = path.join(os.homedir(), '.pi', 'agent', 'a2a');
var AGENTS_DIR = path.join(A2A_DIR, 'agents');
// Fleet definition (from inventory.yml + model-router configs)
var FLEET_NODES = [
    { hostname: 'fnet1', ip: '192.168.0.141', ram: '8GB', role: 'worker', models: ['qwen3.5:4b'] },
    { hostname: 'fnet2', ip: '192.168.0.142', ram: '16GB', role: 'hub', models: [] }, // Hub only, no worker models
    { hostname: 'fnet3', ip: '192.168.0.143', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
    { hostname: 'fnet4', ip: '192.168.0.144', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
    { hostname: 'fnet5', ip: '192.168.0.145', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
    { hostname: 'fnet6', ip: '192.168.0.146', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
    { hostname: 'fnet7', ip: '192.168.0.147', ram: '16GB', role: 'worker', models: ['qwen3.5:4b'] },
];
// Model capability tiers
var MODEL_SKILLS = {
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
function generateAgentCard(node, port) {
    if (port === void 0) { port = 10000; }
    var isHub = node.role === 'hub';
    var skills = [];
    // Add skills based on available models
    if (!isHub) {
        for (var _i = 0, _a = node.models; _i < _a.length; _i++) {
            var model = _a[_i];
            var modelSkills = MODEL_SKILLS[model];
            if (modelSkills) {
                skills.push.apply(skills, modelSkills);
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
    }
    else {
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
            ? "Fleet hub node (".concat(node.ram, " RAM) \u2014 coordinates task distribution across fleet")
            : "Fleet worker node (".concat(node.ram, " RAM) \u2014 runs ").concat(node.models.join(', '), " for distributed task execution"),
        url: "http://".concat(node.ip, ":").concat(port),
        version: '0.1.0',
        capabilities: {
            streaming: true, // We're adding SSE streaming in Phase 1 M4
            pushNotifications: false, // Not yet implemented (Phase 1 M4)
            extendedAgentCard: false // Not yet implemented
        },
        skills: skills,
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
    console.log("Generating A2A Agent Cards for ".concat(FLEET_NODES.length, " fleet nodes..."));
    console.log("Output directory: ".concat(AGENTS_DIR, "\n"));
    for (var _i = 0, FLEET_NODES_1 = FLEET_NODES; _i < FLEET_NODES_1.length; _i++) {
        var node = FLEET_NODES_1[_i];
        var card = generateAgentCard(node);
        var filename = "".concat(node.hostname, "-agent.json");
        var filepath = path.join(AGENTS_DIR, filename);
        fs.writeFileSync(filepath, JSON.stringify(card, null, 2));
        console.log("\u2713 ".concat(node.hostname, " (").concat(node.ip, ") \u2192 ").concat(filename));
        console.log("  Skills: ".concat(card.skills.map(function (s) { return s.id; }).join(', ')));
        console.log("  URL: ".concat(card.url));
        console.log("  Security: ".concat(Object.keys(card.securitySchemes).join(', '), "\n"));
    }
    // Generate orchestrator card (carlos-desktop)
    var orchestratorCard = {
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
    var orchestratorFile = path.join(AGENTS_DIR, 'carlos-desktop-agent.json');
    fs.writeFileSync(orchestratorFile, JSON.stringify(orchestratorCard, null, 2));
    console.log("\u2713 carlos-desktop (orchestrator) \u2192 carlos-desktop-agent.json");
    console.log("  Skills: ".concat(orchestratorCard.skills.map(function (s) { return s.id; }).join(', ')));
    console.log("  URL: ".concat(orchestratorCard.url, "\n"));
    // Generate combined fleet registry
    var registry = {
        version: '0.1.0',
        generated: new Date().toISOString(),
        hub: {
            hostname: 'fnet2',
            ip: '192.168.0.142',
            comsNetPort: 8080,
            a2aPort: 10000
        },
        nodes: FLEET_NODES.map(function (node) { return ({
            hostname: node.hostname,
            ip: node.ip,
            ram: node.ram,
            role: node.role,
            models: node.models,
            agentCardFile: "".concat(node.hostname, "-agent.json"),
            a2aUrl: "http://".concat(node.ip, ":10000")
        }); })
    };
    var registryFile = path.join(AGENTS_DIR, 'fleet-registry.json');
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));
    console.log("\u2713 Fleet registry \u2192 fleet-registry.json");
    console.log("  Total nodes: ".concat(FLEET_NODES.length));
    console.log("  Workers: ".concat(FLEET_NODES.filter(function (n) { return n.role === 'worker'; }).length));
    console.log("  Hub: ".concat(FLEET_NODES.filter(function (n) { return n.role === 'hub'; }).length));
}
main();

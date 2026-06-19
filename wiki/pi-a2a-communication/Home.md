---
name: pi-a2a-communication Wiki Home
updated: 2026-06-19
---

# pi-a2a-communication — Wiki Home

Start here. Documentation lives in the **vault** per FDP TOPOLOGY. Workshop wiki files link to vault originals.

## ⚡ Current Status

**v1.0.1 (upstream)** deployed to all 7 fleet nodes. Fork archived. A2A fully operational. Coms-net removed.

| Milestone | Status |
|-----------|--------|
| Fleet deployment | ✅ All 7 nodes, A2A on port 10000 |
| Coms-net removal | ✅ A4 complete |
| Spec compliance audit | ✅ 5 gaps found |
| Upstream spec fixes | ⏭️ Deferred |

## Key Documents

| Document | Description | Status |
|----------|-------------|--------|
| [A2A v1.0 Conformance Report](../A2A-v1-Conformance-Report.md) | Executive report with Mermaid diagrams, evidence, fixes | ✅ Complete |
| [Conformance Test Suite](../../tests/a2a-v1-conformance.test.ts) | Self-contained Vitest test suite | ✅ Complete |
| [Spec Compliance Summary](→ vault wiki/reference/a2a-v1-spec-compliance.md) | Audit results table | ✅ Complete |
| [Agent Card Schema](→ vault wiki/reference/agent-card-schema.md) | A2A Agent Card schema and fleet card | ✅ Verified |

## Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [Agent Definitions](./_meta/Agent-Definitions.md) | A2A agent types and their roles | 🟡 Draft |
| [Architecture](./_meta/Architecture.md) | System architecture overview | 🟡 Draft |
| [Coms-net Bridge](./_meta/Coms-net-Bridge.md) | ~~A2A ↔ coms-net bridge design~~ ARCHIVED | [-] Cancelled |

## Guides

| Document | Description | Status |
|----------|-------------|--------|
| [Activity Log](./guides/Activity-Log.md) | Guide domain activity log | 🟡 Active |

## Implementation

| Document | Description | Status |
|----------|-------------|--------|
| [Activity Log](./implementation/Activity-Log.md) | Implementation domain activity log | 🟡 Active |

## Protocol

| Document | Description | Status |
|----------|-------------|--------|
| [Activity Log](./protocol/Activity-Log.md) | Protocol domain activity log | 🟡 Active |

## Project Structure

```
workshop/02-Areas/Infrastructure/pi-a2a-communication/   ← Code home (this repo)
├── AGENTS.md               ← Project routing + anti-drift rules
├── FOCUS.md                ← Current state + handoff notes
├── PLAN.md                 ← Release plan with task tracking
├── WORKBENCH.md            ← Working notes + triage
├── wiki/                   ← Links to vault documentation (you are here)
│   └── pi-a2a-communication/
│       ├── Home.md          ← This file — start here
│       ├── _meta/           ← Architecture, agent definitions, bridge design
│       ├── guides/          ← How-to guides
│       ├── implementation/  ← Implementation details
│       └── protocol/        ← Protocol spec compliance
├── .frias/                 ← FDP operational files (canonical)
├── .pi/                    ← Pi configuration
├── index.ts                ← Extension entry point
├── a2a-client.ts           ← A2A client implementation
├── a2a-server.ts           ← A2A server (local testing only)
├── agent-discovery.ts      ← Agent discovery + caching
├── task-manager.ts         ← Task orchestration
├── config.ts               ← ConfigManager
├── types.ts                ← A2A v1.0 protocol types
├── config/                 ← Configuration files
├── scripts/                ← Agent card generator
├── tests/                  ← TDD test suites
└── dist/                   ← Built output

personal-vault/02-Areas/Infrastructure/pi-a2a-communication/   ← Documentation home
├── wiki/                   ← Full wiki content (vault originals)
│   ├── architecture/       ← Architecture docs
│   ├── guides/             ← How-to guides
│   └── reference/          ← API reference, spec compliance
├── .frias/                 ← FDP operational files (vault mirror)
├── FOCUS.md                ← Vault copy (synced from workshop)
├── PLAN.md                 ← Vault copy (synced from workshop)
└── WORKBENCH.md            ← Vault copy (synced from workshop)
```

## Related Projects

| Project | Description |
|---------|-------------|
| [pi-a2a-gateway](../../pi-a2a-gateway/wiki/pi-a2a-gateway/Home.md) | Standalone A2A server replacing coms-net hub |
| [pi-cross-node-comms](../../pi-cross-node-comms/wiki/Home.md) | ❌ Archived — replaced by A2A |

---

> 📋 **Checkbox states:** `[ ]` To Do | `[/]` In Progress | `[~]` Good Enough | `[x]` Done | `[>]` Deferred | `[!]` Blocked | `[-]` Cancelled

*Last updated: 2026-06-19*
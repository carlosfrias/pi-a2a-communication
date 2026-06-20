---
name: pi-a2a-communication Wiki Home
updated: 2026-06-20
---

# pi-a2a-communication — Wiki Home

> **Navigation hub.** See [AGENTS.md](../../AGENTS.md) for routing, [FOCUS.md](../../FOCUS.md) for current state.

A2A (Agent-to-Agent) protocol extension for pi. Enables multi-node fleet communication using the A2A v1.0 specification.

## ⚡ Current Status

**v0.3.0 released.** PiTaskBridge + a2a_chain tool + broadcast/chain/status improvements + PiSessionTaskHandler + fleet deployment. 206/206 tests passing. Fleet: all 7 nodes on v0.3.0.

| Milestone | Status |
|-----------|--------|
| M6: Spec compliance | ✅ All 7 gaps fixed, 69 conformance tests |
| M9: Client features | ✅ broadcast, chain, status, a2a_chain tool |
| M10: Server integration | ✅ PiTaskBridge, SubprocessPiTaskBridge, session handler |
| M7: Upstream issues | ✅ 6 issues filed (#3–#8) |
| Fleet deployment | ✅ All 7 nodes, A2A on port 10000 |

## Guides

| Document | Description |
|----------|-------------|
| [Sending Work to the Fleet](./guides/sending-work-to-the-fleet.md) | Slash commands, tools, keyword triggers, and examples for distributing work across fnet1–fnet7 |
| [Learning & Resources](./guides/learning-and-resources.md) | A2A protocol fundamentals, tutorials, best practices, deployment patterns |
| [Decommissioned Skills Migration](./guides/decommissioned-skills-migration.md) | D-E-V + fleet-dispatcher + coms-net → A2A migration guide |
| [Expertise Development](./guides/expertise-development-curriculum.md) | A2A learning curriculum |
| [Node.js SDK Development](./guides/nodejs-sdk-development.md) | Node.js SDK development guide |

## Reference

| Document | Description |
|----------|-------------|
| [Spec Compliance Summary](./reference/a2a-v1-spec-compliance.md) | A2A v1.0 spec compliance audit results |
| [Conformance Report](./reference/A2A-v1-Conformance-Report.md) | Full executive report with Mermaid diagrams and reproduction steps |
| [Conformance Audit](./reference/A2A-v1-Conformance-Audit.md) | Raw audit findings with deepseek/kimi validation |
| [Agent Card Schema](./reference/agent-card-schema.md) | A2A Agent Card schema reference and fleet card |

## Related Projects

| Project | Description | Status |
|---------|-------------|--------|
| pi-a2a-gateway | A2A fleet integration & testing | ❌ Archived |
| pi-cross-node-comms | Replaced by A2A | ❌ Archived |

---

*Last updated: 2026-06-20*
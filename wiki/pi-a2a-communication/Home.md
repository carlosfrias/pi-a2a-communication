---
name: pi-a2a-communication Wiki Home
updated: 2026-06-19
---

# pi-a2a-communication — Wiki Home (Workshop)

A2A (Agent-to-Agent) protocol extension for pi. Enables multi-node fleet communication using the A2A v1.0 specification.

## ⚡ Current Status

**v0.3.0 released.** PiTaskBridge + a2a_chain tool + broadcast/chain/status improvements + PiSessionTaskHandler + fleet deployment. 206/206 tests passing. Fleet: all 7 nodes on v0.3.0.

| Milestone | Status |
|-----------|--------|
| Fleet deployment | ✅ All 7 nodes, A2A on port 10000 |
| Coms-net removal | ✅ A4 complete — fully removed from fleet |
| Spec compliance audit | ✅ Audited — 7 gaps found (S1–S6b) |
| M6 P0 fixes (S2/S3/S5) | ✅ Fixed |
| M6 P1 fixes (S1/S6/S6b) | ✅ Fixed |
| M6 P2 fixes (S4) | ✅ Fixed |

## Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [Architecture](./architecture/overview.md) | System architecture, components, data flow | 🟡 Planned |

## Guides

| Document | Description | Status |
|----------|-------------|--------|
| [Sending Work to the Fleet](./guides/sending-work-to-the-fleet.md) | Slash commands, tools, keyword triggers, and examples for distributing work across fnet1–fnet7 | ✅ Complete |
| [Learning & Resources](./guides/learning-and-resources.md) | A2A protocol fundamentals, tutorials, best practices, deployment patterns | ✅ Complete |
| [Installation](./guides/installation.md) | How to install and configure the extension | 🟡 Planned |
| [Gallery Submission](./guides/gallery-submission.md) | pi.dev/packages gallery submission details | ✅ Complete |
| [Gallery Visibility Status](./guides/gallery-visibility-status.md) | Gallery listing visibility check | ✅ Complete |
| [Listing Complete](./guides/listing-complete.md) | Package listing confirmation | ✅ Complete |
| [Decommissioned Skills Migration](./guides/decommissioned-skills-migration.md) | D-E-V + fleet-dispatcher + coms-net → A2A migration guide | ✅ Complete |

## Reference

| Document | Description | Status |
|----------|-------------|--------|
| [Spec Compliance Summary](./reference/a2a-v1-spec-compliance.md) | Spec compliance audit results | ✅ Audited |
| [Conformance Report](./reference/A2A-v1-Conformance-Report.md) | Full executive report with Mermaid diagrams and reproduction steps | ✅ Complete |
| [Conformance Audit](./reference/A2A-v1-Conformance-Audit.md) | Raw audit findings with deepseek/kimi validation | ✅ Complete |
| [Agent Card Schema](./reference/agent-card-schema.md) | A2A Agent Card schema reference and fleet card | ✅ Verified |
| `tests/a2a-v1-conformance.test.ts` | Self-contained Vitest conformance test suite (in code repo) | ✅ Complete |

## Related Projects

| Project | Description | Status |
|---------|-------------|--------|
| pi-a2a-gateway | A2A fleet integration & testing | ❌ Archived → [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | Replaced by A2A | ❌ Archived → [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |

---

*Last updated: 2026-06-19*
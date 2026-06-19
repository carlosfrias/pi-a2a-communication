---
name: pi-a2a-communication Wiki Home
updated: 2026-06-19
---

# pi-a2a-communication — Wiki Home (Workshop)

A2A (Agent-to-Agent) protocol extension for pi. Enables multi-node fleet communication using the A2A v1.0 specification.

## ⚡ Current Status

**v1.0.1 (upstream)** deployed to all 7 fleet nodes. Fork archived. A2A fully operational. Coms-net removed.

| Milestone | Status |
|-----------|--------|
| Fleet deployment | ✅ All 7 nodes, A2A on port 10000 |
| Coms-net removal | ✅ A4 complete — fully removed from fleet |
| Spec compliance audit | ✅ Audited — 7 gaps found (S1–S6b) |
| Upstream spec fixes | ⏭️ Deferred |

## Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [Architecture](./architecture/overview.md) | System architecture, components, data flow | 🟡 Planned |

## Guides

| Document | Description | Status |
|----------|-------------|--------|
| [Learning & Resources](./guides/learning-and-resources.md) | A2A protocol fundamentals, tutorials, best practices, deployment patterns | ✅ Complete |
| [Installation](./guides/installation.md) | How to install and configure the extension | 🟡 Planned |

## Reference

| Document | Description | Status |
|----------|-------------|--------|
| [Spec Compliance Summary](./a2a-v1-spec-compliance.md) | Spec compliance audit results | ✅ Audited |
| [Conformance Report](./A2A-v1-Conformance-Report.md) | Full executive report with Mermaid diagrams and reproduction steps | ✅ Complete |
| [Agent Card Schema](./agent-card-schema.md) | A2A Agent Card schema reference and fleet card | ✅ Verified |
| `tests/a2a-v1-conformance.test.ts` | Self-contained Vitest conformance test suite (in code repo) | ✅ Complete |

## Related Projects

| Project | Description | Status |
|---------|-------------|--------|
| pi-a2a-gateway | A2A fleet integration & testing | ❌ Archived → [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | Replaced by A2A | ❌ Archived → [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |

---

*Last updated: 2026-06-19*
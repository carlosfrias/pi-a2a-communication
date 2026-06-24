---
name: pi-a2a-communication Wiki Home
updated: 2026-06-23
---

# pi-a2a-communication — Wiki Home

> **Navigation hub.** See [AGENTS.md](../../AGENTS.md) for routing, [FOCUS.md](../../FOCUS.md) for current state.

A2A (Agent-to-Agent) protocol extension for pi. Enables multi-node fleet communication using the A2A v1.0 specification.

## ⚡ Current Status

**v0.4.0 released and deployed.** 215/215 tests passing. All 5 gaps resolved. Fleet auto-starts on reboot. qwen3.5:35b-a3b (MoE 36B/3B) flagship on 32GB nodes at 10.4 tok/s CPU.

| Milestone | Status |
|-----------|--------|
| M6: Spec compliance | ✅ All 7 gaps fixed, 51 conformance tests |
| M7: Upstream issues | ✅ 6 issues filed (#3–#8) |
| M8: Stable release | ✅ v0.2.0 |
| M9: Client features | ✅ broadcast, chain, status, a2a_chain tool |
| M10: Server integration | ✅ PiTaskBridge, SubprocessPiTaskBridge, session handler |
| Fleet deployment | ✅ All 7 nodes on v0.4.0, A2A on port 10000 |

### Resolved Gaps

| ID | Severity | Gap | Resolution |
|----|----------|-----|------------|
| GAP-1 | 🔴 High | node-router coms-net archived | ✅ Migrated to fleet-resource-manager + A2A |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler | ✅ ctx.newSession + adaptive polling |
| GAP-3 | 🟡 Medium | Fleet model profiles | ✅ linux-31gi + linux-15gi + Ansible |
| GAP-3.5 | 🟡 Medium | Fleet model upgrade | ✅ qwen3.5:35b-a3b flagship on 32GB nodes |
| GAP-4 | 🟡 Medium | capacity_score for CPU-only | ✅ Fixed in fleet-resource-manager v0.1.0 |
| GAP-5 | 🟢 Low | Stale playbook references | ✅ A2A playbooks, coms-net files removed |

### Pending Decision

- **M7.2:** Offer PR to upstream? See [M7.2 Assessment](./reference/M7.2-upstream-pr-assessment.md). Recommendation: narrow PR with S1–S6b spec fixes only.

## Guides

| Document | Description |
|----------|-------------|
| [Sending Work to the Fleet](./guides/sending-work-to-the-fleet.md) | Slash commands, tools, keyword triggers, and examples for distributing work across fnet1–fnet7 |

## Reference

| Document | Description |
|----------|-------------|
| [Architecture & Executive Report](./reference/architecture-and-executive-report.md) | System architecture, mermaid diagrams, gap analysis, fleet availability |
| [Conformance Report](./reference/A2A-v1-Conformance-Report.md) | Executive report with Mermaid diagrams and reproduction steps |
| [Conformance Audit](./reference/A2A-v1-Conformance-Audit.md) | Raw audit findings with deepseek/kimi validation |
| [Agent Card Schema](./reference/agent-card-schema.md) | A2A Agent Card schema reference and fleet card |
| [M7.2 Upstream PR Assessment](./reference/M7.2-upstream-pr-assessment.md) | Analysis of whether to offer PR to DrOlu/pi-a2a-communication |

## Related Projects

| Project | Description | Status |
|---------|-------------|--------|
| fleet-resource-manager | Fleet node scoring, routing, benchmarking | ✅ Active (absorbed node-router capabilities) |
| pi-a2a-gateway | A2A fleet integration & testing | ❌ Archived |
| pi-cross-node-comms | Replaced by A2A | ❌ Archived |
| node-router | Replaced by A2A + fleet-resource-manager | ❌ Archived |

---

*Last updated: 2026-06-23*
---
name: pi-a2a-communication
summary: "v0.3.0 released. 206/206 tests. 5 known gaps. node-router inert (targets coms-net). PiSessionTaskHandler blocked on pi API. Fleet auto-starts on reboot."
status: active
phase: "Post-M10: Gap Remediation + Integration"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-06-20
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**v0.3.0 deployed. M6–M10 complete. 206/206 tests. 5 known gaps identified. Fleet auto-starts on reboot — no stand-up-fleet command needed. See [Architecture & Executive Report](./wiki/pi-a2a-communication/reference/architecture-and-executive-report.md).**

## What's Done

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7: 6 upstream issues filed (#3–#8)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features — broadcast, chain, status, a2a_chain tool
- ✅ M10: Server integration — PiTaskBridge, SubprocessPiTaskBridge, session handler
- ✅ M10.5: Fleet deployment (all 7 nodes on v0.3.0)
- ✅ M10.6: PiSessionTaskHandler with fallback
- ✅ Wiki remediation — Rule 25/27 compliant, stale files removed, vault synced
- ✅ Fleet hardware audit — node-pool.json v2.0.0 with actual specs
- ✅ 206/206 tests passing

## Known Gaps

| ID | Severity | Gap | Status |
|----|----------|-----|--------|
| GAP-1 | 🔴 High | node-router targets coms-net (deprecated), not A2A | Not started |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler blocked — `ctx.newSession()` unavailable (pi v0.79.4) | Blocked on upstream |
| GAP-3 | 🟡 Medium | local-model-pilot profiles empty on all fleet nodes | Not started |
| GAP-4 | 🟡 Medium | capacity_score=0 for all CPU-only nodes (VRAM=0 bottleneck) | Not started |
| GAP-5 | 🟢 Low | Stale playbook-executor references to archived coms-net | Not started |

## Active Work

- [ ] GAP-1.1: Replace coms-net dispatch with A2A tools
- [ ] GAP-2.3: Configure SubprocessPiTaskBridge as interim solution
- [ ] GAP-3.1: Configure local-model-pilot on 32GB nodes
- [ ] GAP-4.1: Fix capacity_score formula for CPU-only nodes
- [ ] GAP-5.1: Update playbook-executor index
- [ ] M7.2: Offer PR to upstream if maintainer responds

## Fleet Availability Bottom Line

Fleet nodes **auto-start via systemd** on reboot. No "stand up fleet" command needed for routine reboots.

| Scenario | Playbook |
|----------|----------|
| First-time setup | `bootstrap-pi.sh --profile linux-31gi` |
| A2A update | `deploy-a2a.yml` |
| Health monitor update | `deploy-fleet.yml` |
| Model config changes | `bootstrap-pi.sh --profile linux-31gi` |

→ Full details: [Architecture & Executive Report](./wiki/pi-a2a-communication/reference/architecture-and-executive-report.md)

## Spec Compliance Status

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| S1 | 🟡 Medium | JSON-RPC errors return HTTP 400 | ✅ Fixed |
| S2 | 🔴 High | 401 responses lack `WWW-Authenticate` | ✅ Fixed |
| S3 | 🔴 High | Wrong Agent Card discovery path | ✅ Fixed |
| S4 | 🔴 High | Missing `/rpc`, `/message:send`, `/message:stream` | ✅ Fixed |
| S5 | 🔴 High | `/sendMessage` uncaught parse error → HTTP 500 | ✅ Fixed |
| S6 | 🔴 High | Method names slash-separated, not PascalCase | ✅ Fixed |
| S6b | 🟢 Low | `id: 0` instead of `id: null` in parse errors | ✅ Fixed |

→ Full report: [A2A-v1-Conformance-Report](./wiki/pi-a2a-communication/reference/A2A-v1-Conformance-Report.md)
→ Audit report: [A2A-v1-Conformance-Audit](./wiki/pi-a2a-communication/reference/A2A-v1-Conformance-Audit.md)

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |
| node-router | ⚠️ Not integrated | [node-router](../../node-router/) — targets coms-net, not A2A |
| health-monitor | ⚠️ Deployed but stale | [health-monitor](../../health-monitor/) — health data 3+ weeks old |

---

*Last updated: 2026-06-20*
---
name: pi-a2a-communication
summary: "v0.4.0. All 5 gaps resolved. PiSessionTaskHandler implemented. Node-router archived. Fleet profiles created. 215 tests."
status: active
phase: "Post-M10: Gap Remediation Complete — v0.4.0 released"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-06-23
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**v0.4.0 deployed to fleet. All 5 gaps resolved. PiSessionTaskHandler implemented. Node-router archived. Fleet profiles deployed. 215 tests. A2A running on all 7 nodes.**

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
- ✅ 215/215 tests passing (9 new from GAP-2 PiSessionTaskHandler)
- ✅ Fleet hardware audit — node-pool.json v2.0.0 with actual specs

## Known Gaps (Reassessed 2026-06-23)

| ID | Severity | Gap | Status | Change |
|----|----------|-----|--------|--------|
| GAP-1 | 🔴 High | node-router coms-net components archived — superseded by fleet-resource-manager + A2A | ✅ Archived | **orchestrator_client.py and fleet_agent.py archived, scoring/routing migrated to fleet-resource-manager** |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler using ctx.newSession() | ✅ Implemented | **Polling-based response reader, streaming handler support** |
| GAP-3 | 🟡 Medium | local-model-pilot profiles for fleet nodes | ✅ Created | **linux-31gi + linux-15gi profiles + Ansible deploy playbook** |
| GAP-4 | 🟡 Medium | capacity_score formula for CPU-only nodes | ✅ Closed | **Fixed in fleet-resource-manager v0.1.0** |
| GAP-5 | 🟢 Low | Stale playbook-executor references to coms-net | ✅ Cleaned | **New A2A playbooks, old files removed, index updated** |

## Active Work

All 5 gaps resolved and deployed. Remaining strategic items:

- [ ] GAP-3.5: Consider adding `qwen3:8b` to linux-31gi for local reasoning/coding (reduces A2A latency)
- [ ] M7.2: Offer PR to upstream if maintainer responds
- [x] Version bump to v0.4.0 ✅
- [x] GAP-3.3: Model profiles deployed to all 7 fleet nodes ✅
- [x] GAP-2.2: v0.4.0 deployed to all 7 fleet nodes ✅
- [x] GAP-3.4: Model routing verified on all nodes ✅

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
| node-router | ✅ Archived | Archived to `04-Archive/Infrastructure/node-router/` — scoring/routing/benchmarking migrated to fleet-resource-manager |
| health-monitor | ⚠️ Deployed but stale | [health-monitor](../../health-monitor/) — health data 3+ weeks old |

---

*Last updated: 2026-06-23*
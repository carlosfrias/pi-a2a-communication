---
name: pi-a2a-communication
summary: "v0.4.0 deployed. All gaps resolved. qwen3.5:35b-a3b flagship on 32GB nodes (10.4 tok/s). pi-model-router removed from fleet. 215 tests."
status: active
phase: "Post-M10: Gap Remediation Complete — v0.4.0 released"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-06-23
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**v0.4.0 deployed to fleet. All gaps resolved. qwen3.5:35b-a3b (MoE 36B/3B active) is the flagship model on 32GB nodes — 10.4 tok/s CPU, tools+thinking+vision. pi-model-router removed from fleet (Ansible manages routing). 23 local + 10 cloud-via-A2A routes on 32GB nodes. Only M7.2 (upstream PR) remains for user decision.**

## What's Done

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7: 6 upstream issues filed (#3–#8)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features — broadcast, chain, status, a2a_chain tool
- ✅ M10: Server integration — PiTaskBridge, SubprocessPiTaskBridge, session handler
- ✅ M10.5: Fleet deployment (all 7 nodes on v0.3.0)
- ✅ M10.6: PiSessionTaskHandler with fallback
- ✅ GAP-1: node-router archived, migrated to fleet-resource-manager
- ✅ GAP-2: PiSessionTaskHandler implemented (ctx.newSession, adaptive polling)
- ✅ GAP-3: Fleet model profiles created and deployed
- ✅ GAP-4: capacity_score fix confirmed in fleet-resource-manager v0.1.0
- ✅ GAP-5: A2A playbooks, coms-net references cleaned
- ✅ GAP-3.5: qwen3.5:35b-a3b deployed as flagship on 32GB nodes
- ✅ Fleet routing verified: 23 local + 10 cloud-via-A2A on 32GB, 6 local + 18 cloud-via-A2A on 16GB
- ✅ pi-model-router removed from fleet (was overwriting Ansible-deployed config)
- ✅ Wiki remediation — Rule 25/27 compliant
- ✅ 215/215 tests passing

## Known Gaps (All Resolved)

| ID | Severity | Gap | Status |
|----|----------|-----|--------|
| GAP-1 | 🔴 High | node-router archived — superseded by fleet-resource-manager + A2A | ✅ |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler using ctx.newSession() | ✅ |
| GAP-3 | 🟡 Medium | local-model-pilot profiles for fleet nodes | ✅ |
| GAP-3.5 | 🟡 Medium | Fleet model upgrade (35b-a3b flagship) | ✅ |
| GAP-4 | 🟡 Medium | capacity_score formula for CPU-only nodes | ✅ |
| GAP-5 | 🟢 Low | Stale playbook-executor references to coms-net | ✅ |

## Remaining Items (User Decision)

- [~] minicmp-o2.6:8b: Kept as fallback on 32GB nodes (5.5GB each, superseded by 35b-a3b)
- [ ] M7.2: Offer PR to upstream (DrOlu/pi-a2a-communication) — upstream inactive 3+ months, 6 issues unanswered. **Recommendation: narrow PR with S1-S6b spec fixes only.**

## Fleet Status

| Node | RAM | Profile | Flagship Model | Routes | A2A |
|------|-----|---------|---------------|--------|-----|
| fnet1 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.4.0 ✅ |
| fnet2 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.4.0 ✅ |
| fnet3 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet4 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet5 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet6 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | v0.4.0 ✅ |
| fnet7 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | v0.4.0 ✅ |

**32GB flagship: qwen3.5:35b-a3b** — MoE 36B total, 3B active per token, 10.4 tok/s on CPU, tools+thinking+vision. Handles `reasoning/medium+low`, `coding/medium`, `local/high+medium`, `vision/medium+low`, `auto/medium` locally instead of routing through A2A bridge.

**Routing managed by Ansible** — pi-model-router removed from fleet nodes to prevent config overwrite. `deploy-model-profiles.yml` handles deployment and restart.

| Scenario | Playbook |
|----------|----------|
| First-time setup | `bootstrap-pi.sh --profile linux-31gi` |
| A2A update | `deploy-a2a.yml` |
| Model config changes | `deploy-model-profiles.yml` |
| Health monitor update | `deploy-fleet.yml` |

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

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |
| node-router | ✅ Archived | Archived to `04-Archive/Infrastructure/node-router/` |
| health-monitor | ⚠️ Deployed but stale | [health-monitor](../../health-monitor/) |
| fleet-resource-manager | ✅ Active | [fleet-resource-manager](../../fleet-resource-manager/) — includes benchmark subcommand |

---

*Last updated: 2026-06-23*
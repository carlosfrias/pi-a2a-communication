---
name: pi-a2a-communication
summary: "A2A bridge + autonomous fleet health monitoring v0.7.0. Pi PATH fix + OLLAMA_KEEP_ALIVE=10m + Option B + node reporter + Mac orchestrator remediation loop + boot guard. All 7 fleet nodes verified."
status: active
phase: "v0.7.0 — Autonomous Fleet Health Monitoring released"
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-07-11
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**v0.7.0 released (2026-07-11).** Autonomous fleet health monitoring is now deployed:

1. ✅ **Node reporter** — `fleet-health-reporter.sh` runs every 2 min on all 7 nodes, writes status JSON to shared NFS.
2. ✅ **Mac orchestrator monitor** — `orchestrator-fleet-monitor.py` runs every 2 min via LaunchAgent, polls status files, and drives Ansible remediation until success.
3. ✅ **Boot guard** — `fleet-a2a-boot-guard.timer` ensures `pi-agent` is enabled and running after every reboot.
4. ✅ **Source-of-truth systemd unit** — `pi-agent@.service.template` lives in this active repo, installed by `deploy-a2a.yml`.
5. ✅ **Playbook guard** — `validate-fleet-a2a-playbooks.sh` prevents `enabled: no` and archive references.
6. ✅ **All 7 A2A agents online** — verified v0.7.0 with health reporter status mirroring.

## Completed Work

### v0.7.0 — Autonomous Fleet Health Monitoring ✅

| Component | Status |
|-----------|--------|
| `fleet-health-reporter.sh` deployed to fnet1-7 | ✅ |
| `fleet-a2a-health-reporter.timer` enabled/active | ✅ |
| `fleet-a2a-boot-guard.timer` enabled/active | ✅ |
| Status files written to `/mnt/carlos-desktop/.fleet-status/` | ✅ |
| Orchestrator monitor LaunchAgent loaded on Mac | ✅ |
| Orchestrator auto-remediated fnet3/fnet7 NFS autofs issues | ✅ |
| `validate-fleet-a2a-playbooks.sh` passes | ✅ |
| Agent cards report v0.7.0 on all nodes | ✅ |
| Git tag `v0.7.0` + GitHub release published | ✅ |

### Fleet Bridge Remediation (2026-07-10) ✅

| Step | Status |
|------|--------|
| Root cause: `pi` not in root's PATH | ✅ Identified |
| Root cause: OLLAMA_KEEP_ALIVE=0 in systemd | ✅ Identified |
| Root cause: ollamaKeepAlive not mapped in bridge code | ✅ Identified |
| `/usr/local/bin/pi` wrapper deployed to all 7 nodes | ✅ Verified |
| OLLAMA_KEEP_ALIVE=10m in all systemd units | ✅ Verified |
| OLLAMA_KEEP_ALIVE=10m in all standalone scripts | ✅ Verified |
| config.json bridge_command → `/usr/local/bin/pi` | ✅ All 7 nodes |
| config.json ollamaKeepAlive → "10m" | ✅ All 7 nodes |
| Option B: code + 7 unit tests (360/360 total) | ✅ |
| A2A servers responding on all 7 nodes | ✅ Verified |

### Phase AUTO-ROUTE + Option B — Tier Hints + OLLAMA_KEEP_ALIVE ✅

| Step | Status |
|------|--------|
| Auto-route: `src/auto-route.ts` + tool updates | ✅ |
| Auto-route: 18 unit tests passing | ✅ |
| Auto-route: RULE 34 added to universal-rules | ✅ |
| Option B: `ollamaKeepAlive` in `BridgeConfig` | ✅ |
| Option B: `buildBridgeOptions` maps to env | ✅ |
| Option B: fleet-wide deployment verified | ✅ |

### Phase EXEC — Executor-Tier Gap Remediation ✅

| Tier | Status |
|------|--------|
| A — Executor-role system prompt | ✅ Deployed all 7 |
| C — Deterministic `shell-exec` short-circuit | ✅ Deployed all 7 |
| B — Narration-detection guard | ✅ Deployed all 7 |
| D — Agent-exec strong-model escalation (35b-a3b) | ✅ Deployed on 32GB; 16GB explicit-fail |

### M6–M10 — Spec Compliance, Client, Server ✅

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7.1: 6 upstream issues filed
- ✅ M7.2: Upstream PRs submitted
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features (broadcast, chain, status, a2a_chain tool)
- ✅ M10: Server integration (PiTaskBridge, SubprocessPiTaskBridge, handler routing)

## Fleet Status

> A2A server v0.7.0 with auto-route + Option B + health monitoring on all 7 nodes. Health reporter status mirrored to Mac. Orchestrator monitor auto-remediates failures.

| Node | RAM | Profile | A2A | Health Reporter | Boot Guard | Last Status |
|------|-----|---------|-----|-----------------|------------|-------------|
| fnet1 | 16GB | linux-15gi | ✅ | ✅ | ✅ | healthy |
| fnet2 | 16GB | linux-15gi | ✅ | ✅ | ✅ | healthy |
| fnet3 | 32GB | linux-31gi | ✅ | ✅ | ✅ | healthy |
| fnet4 | 32GB | linux-31gi | ✅ | ✅ | ✅ | healthy |
| fnet5 | 32GB | linux-31gi | ✅ | ✅ | ✅ | healthy |
| fnet6 | 32GB | linux-31gi | ✅ | ✅ | ✅ | healthy |
| fnet7 | 16GB | linux-15gi | ✅ | ✅ | ✅ | ollama_container_down ⚠️ |

## Known Gaps

| ID | Severity | Gap | Status |
|----|----------|-----|--------|
| FLEET-STACK | 🟡 Medium | Docker Swarm manager not on fnet3; Ollama container missing on fnet7 | Monitor detects; manual stack redeploy needed |

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |
| node-router | ✅ Archived | `04-Archive/Infrastructure/node-router/` |
| health-monitor | ⚠️ Stale | [health-monitor](../../health-monitor/) |
| fleet-resource-manager | ✅ Active | [fleet-resource-manager](../../fleet-resource-manager/) |

---

*Last updated: 2026-07-11 (v0.7.0 autonomous fleet health monitoring released)*

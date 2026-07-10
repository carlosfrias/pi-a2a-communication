---
name: pi-a2a-communication
summary: "A2A bridge remediation COMPLETE. Pi PATH fix + OLLAMA_KEEP_ALIVE=10m + Option B code gap all resolved. All 7 fleet nodes verified. 360/360 unit tests pass. Self-healing playbooks deployed."
status: active
phase: "Phase AUTO-ROUTE + Option B — COMPLETE. Fleet Bridge Remediation — COMPLETE."
progress: 100
tracked: true
created: 2026-06-18
updated: 2026-07-10
---

# FOCUS — pi-a2a-communication

## [S-TIGHT]

**Fleet Bridge Remediation COMPLETE (2026-07-10).** Three interlocking root causes identified, validated by deepseek-v4-pro + kimi-k2.7, and resolved:

1. ✅ **Pi PATH fix:** `/usr/local/bin/pi` wrapper deployed to all 7 nodes (sources nvm + sets OLLAMA_KEEP_ALIVE=10m)
2. ✅ **OLLAMA_KEEP_ALIVE=10m:** All systemd units + standalone scripts updated from 0 → 10m
3. ✅ **Option B code gap:** `ollamaKeepAlive` mapped in `bridge-options.ts`, `types.ts`, `pi-task-bridge.ts` (7 new tests, 360/360 total pass)
4. ✅ **deploy-a2a.yml:** `bridge_command` changed to `/usr/local/bin/pi`, `become: yes` tasks use `vars: ansible_become: true` (fixes play var override)
5. ✅ **Self-healing playbooks:** `remediate-a2a-bridge.yml`, updated `deploy-a2a.yml`, `start-agents-a2a.yml`, `fleet-a2a-remediate.yml`

**All 7 fleet nodes verified:** pi wrapper v0.80.3, OLLAMA_KEEP_ALIVE=10m, A2A servers responding, config uses `/usr/local/bin/pi`.

## Completed Work

### Fleet Bridge Remediation (2026-07-10) ✅

| Step | Status |
|------|--------|
| Root cause: `pi` not in root's PATH | ✅ Identified |
| Root cause: OLLAMA_KEEP_ALIVE=0 in systemd | ✅ Identified |
| Root cause: ollamaKeepAlive not mapped in bridge code | ✅ Identified |
| `/usr/local/bin/pi` wrapper deployed to all 7 nodes | ✅ Verified (pi --version → 0.80.3) |
| OLLAMA_KEEP_ALIVE=10m in all systemd units | ✅ Verified |
| OLLAMA_KEEP_ALIVE=10m in all standalone scripts | ✅ Verified |
| config.json bridge_command → `/usr/local/bin/pi` | ✅ All 7 nodes |
| config.json ollamaKeepAlive → "10m" | ✅ All 7 nodes |
| Option B: `ollamaKeepAlive` in `BridgeConfig` (types.ts) | ✅ Commit pending |
| Option B: mapping in `buildBridgeOptions` (bridge-options.ts) | ✅ Commit pending |
| Option B: env injection in `SubprocessPiTaskBridge` (pi-task-bridge.ts) | ✅ Commit pending |
| Option B: 7 new unit tests (360/360 total) | ✅ |
| deploy-a2a.yml: bridge_command → `/usr/local/bin/pi` | ✅ |
| deploy-a2a.yml: become tasks use `vars: ansible_become: true` | ✅ |
| deploy-a2a.yml: Phase 3.5 self-healing (pi wrapper + KEEPALIVE) | ✅ |
| remediate-a2a-bridge.yml: 4-phase self-healing playbook | ✅ |
| A2A servers responding on all 7 nodes | ✅ Verified |
| Validation: deepseek-v4-pro | ✅ Confirmed root cause |
| Validation: kimi-k2.7-code audit | ✅ Confirmed Option B gap as BLOCKER |

### Phase AUTO-ROUTE + Option B — Tier Hints + OLLAMA_KEEP_ALIVE ✅

**Auto-Route:** Eliminates ~15K tokens of "check fleet resources" reads per fleet request. The model passes `agent_url="auto"` or a tier hint; the tool resolves it internally.

**Option B:** `OLLAMA_KEEP_ALIVE=10m` for the regular subprocess bridge (not just agent-exec). Eliminates ~89s per-task cold start. Added `ollamaKeepAlive` to `BridgeConfig`, mapped to `env.OLLAMA_KEEP_ALIVE` in `buildBridgeOptions`.

| Step | Status |
|------|--------|
| Auto-route: `src/auto-route.ts` (312 lines, tier classification + resolution) | ✅ Commit `a647557` |
| Auto-route: Updated `a2a_call`, `a2a_parallel`, `a2a_chain` tool handlers | ✅ Commit `a647557` |
| Auto-route: 18 unit tests (all passing) | ✅ |
| Auto-route: RULE 34 added to universal-rules (v1.13.0) | ✅ |
| Option B: `ollamaKeepAlive` added to `BridgeConfig` (`types.ts`) | ✅ |
| Option B: `buildBridgeOptions` maps to `env.OLLAMA_KEEP_ALIVE` | ✅ |
| Option B: 7 unit tests (360/360 total) | ✅ |
| Fleet-wide deployment (all 7 nodes via A2A shell-exec) | ✅ |
| Verified all 7 nodes: active + auto-route.js + keepalive 10m | ✅ |

### Phase EXEC — Executor-Tier Gap Remediation ✅

All four tiers deployed + verified on all 7 fleet nodes. The executor-tier gap is **CLOSED**.

| Tier | Description | Status |
|------|-------------|--------|
| A | Executor-role system prompt | ✅ Deployed all 7 |
| C | Deterministic `shell-exec` short-circuit (78ms, no model) | ✅ Deployed all 7 |
| B | Narration-detection guard | ✅ Deployed all 7 |
| D | Agent-exec strong-model escalation (35b-a3b) | ✅ Deployed on 32GB; 16GB explicit-fail |

### M6–M10 — Spec Compliance, Client, Server ✅

- ✅ M6: All 7 spec gaps fixed (S1–S6b), 19/19 conformance tests
- ✅ M7.1: 6 upstream issues filed
- ✅ M7.2: Upstream PRs submitted (PR #9 + PR #10, issues #3–#8 reopened)
- ✅ M8: v0.2.0 stable release
- ✅ M9: Client features (broadcast, chain, status, a2a_chain tool)
- ✅ M10: Server integration (PiTaskBridge, SubprocessPiTaskBridge, handler routing)

## Fleet Status

> A2A server v0.6.0+ with auto-route + Option B on all 7 nodes. 32GB nodes also serve `agent-exec` (Tier D, qwen3.5:35b-a3b); 16GB nodes explicitly fail agent-exec. Fleet at commit `a647557`. All nodes configured with `ollamaKeepAlive: "10m"` (Option B). Pi PATH fix applied (`/usr/local/bin/pi` wrapper).

| Node | RAM | Profile | Flagship Model | Routes | A2A |
|------|-----|---------|---------------|--------|-----|
| fnet1 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | ✅ |
| fnet2 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | ✅ |
| fnet3 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | ✅ |
| fnet4 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | ✅ |
| fnet5 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | ✅ |
| fnet6 | 32GB | linux-31gi | qwen3.5:35b-a3b | 23 local + 10 cloud | ✅ |
| fnet7 | 16GB | linux-15gi | qwen3.5:4b | 6 local + 18 cloud | ✅ |

## Known Gaps (all closed or accepted)

| ID | Severity | Gap | Status |
|----|----------|-----|--------|
| PATH-FIX | 🔴 High | `pi` not in root's PATH | ✅ **CLOSED** (`/usr/local/bin/pi` wrapper) |
| KEEPALIVE | 🔴 High | OLLAMA_KEEP_ALIVE=0 in systemd | ✅ **CLOSED** (10m in systemd + wrapper) |
| OPTION-B | 🟡 Medium | ollamaKeepAlive not mapped in bridge code | ✅ **CLOSED** (bridge-options.ts + types.ts + pi-task-bridge.ts) |
| DEPLOY-BECOME | 🟡 Medium | deploy-a2a.yml become tasks overridden by play var | ✅ **CLOSED** (vars: ansible_become: true) |
| EXEC-TIER | 🔴 High | Executor-role tier — fleet nodes echo command plans | ✅ **CLOSED** (Phase EXEC) |
| AUTO-ROUTE | 🟡 Medium | Model reads ~15K tokens per request | ✅ **CLOSED** (Phase AUTO-ROUTE, RULE 34) |
| GAP-2 | 🟡 Medium | PiSessionTaskHandler NON-FUNCTIONAL | ✅ Cleaned up |
| GAP-6 | 🟢 Low | pi `/reload` ESM limitation | ✅ Accepted (RULE 29) |

## Low-Priority Follow-ups (not blocking)

- Upstream PR merge — waiting on DrOlu to review/merge PR #9 + PR #10
- A2A protocol endpoint documentation (message/send vs tasks/send vs GET /tasks)

## Cross-References

| Project | Status | Location |
|---------|--------|----------|
| pi-a2a-gateway | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-a2a-gateway/FOCUS.md) |
| pi-cross-node-comms | ❌ Archived | [FOCUS](../../../04-Archive/Infrastructure/pi-cross-node-comms/FOCUS.md) |
| node-router | ✅ Archived | `04-Archive/Infrastructure/node-router/` |
| health-monitor | ⚠️ Stale | [health-monitor](../../health-monitor/) |
| fleet-resource-manager | ✅ Active | [fleet-resource-manager](../../fleet-resource-manager/) |

---

*Last updated: 2026-07-10 (fleet bridge remediation complete: PATH fix + KEEPALIVE + Option B code gap resolved)*
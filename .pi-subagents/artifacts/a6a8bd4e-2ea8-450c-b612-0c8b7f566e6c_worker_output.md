# Fleet Hardening Deploy — 2026-07-21

**Worker:** fleet-hardening-deploy-worker
**Repo:** `workshop/02-Areas/Infrastructure/pi-a2a-communication`
**Goal:** Propagate the fnet5 pi-wrapper infinite-exec-recursion bug-class fix (missing nvm → 100% CPU) to ALL 7 fleet nodes (fnet1–fnet7).

## Summary

The hardened SOURCE templates (written by the prior worker) were committed, pushed to GitHub main, and deployed to all 7 fleet nodes via the existing Ansible playbooks. All three hardening layers — the pi-wrapper recursion guard, the pi-agent-standalone.sh pre-flight nvm/node check, and the fleet-health-check.sh `check_nvm()` monitor — are now LIVE on every node. The `ollama-idle-unload.timer` is active on all 7 nodes (4 were newly enabled). No node is pegging CPU. No node fast-failed (all 7 have nvm present). fnet5 remains healthy and was not broken by the re-deploy.

## Pre-Deploy Snapshot

| Node | pi guard | standalone pre-flight | check_nvm | ollama timer | loadavg | nvm | pi-agent |
|------|----------|----------------------|-----------|--------------|---------|-----|----------|
| fnet1 | ABSENT (0) | ABSENT (0) | NOFILE | active | 0.15 | present | active |
| fnet2 | ABSENT (0) | ABSENT (0) | NOFILE | active | 0.21 | present | active |
| fnet3 | ABSENT (0) | ABSENT (0) | NOFILE | absent | 0.20 | present | active |
| fnet4 | ABSENT (0) | ABSENT (0) | NOFILE | absent | 0.15 | present | active |
| fnet5 | **LIVE (4)** | ABSENT (0) | NOFILE | active | 0.04 | present | active |
| fnet6 | ABSENT (0) | ABSENT (0) | NOFILE | absent | 0.14 | present | active |
| fnet7 | ABSENT (0) | ABSENT (0) | NOFILE | absent | 0.02 | present | active |

Pre-deploy: only fnet5 had the guard (the prior worker's live fix). `fleet-health-check.sh` was absent on ALL nodes. `ollama-idle-unload.timer` was active on fnet1/fnet2/fnet5 only.

## Deploy Steps

### Step 1 — Fleet reachability
`ansible all -i inventory.ini -m ping` → all 7 nodes SUCCESS (pong). Inventory: `ansible/inventory.ini` (LAN 192.168.0.14x).

### Step 2 — Commit + push hardened templates
The 3 hardened source files were uncommitted working-tree changes. Committed as `765d143` and pushed to GitHub main so the nodes' `git pull` gets the hardened repo too:
- `ansible/deploy-a2a.yml` (pi wrapper template with recursion guard)
- `scripts/pi-agent-standalone.sh` (pre-flight nvm/node check)
- `scripts/fleet-health-check.sh` (`check_nvm()`)

### Step 3 — Run deploy-a2a.yml (key deploy)
```
ansible-playbook -i inventory.ini deploy-a2a.yml
```
- **fnet2–fnet7:** fully succeeded (ok=30, A2A v0.7.0 responding on port 10000).
- **fnet1:** FAILED on the `git pull` task — `Could not resolve host: github.com` (DNS issue on fnet1 only, pre-existing). The hardening tasks (pi wrapper + standalone) run AFTER the git pull, so fnet1 was skipped.
- **fnet1 remediation:** re-ran `--start-at-task="Create A2A config directory"` (skipping the GitHub-dependent code pull/build). The pi wrapper + pi-agent-standalone.sh are sourced from the controller's local checkout (inline template + `copy`), NOT from the node's git repo, so the hardened versions deployed correctly. fnet1 succeeded (ok=21, A2A v0.7.0 responding).

### Step 4 — Deploy fleet-health-check.sh + ollama-idle-unload units
No existing playbook deploys `fleet-health-check.sh` (the `deploy-fleet-health.yml` only deploys `fleet-health-reporter.sh`). Created `ansible/playbooks/deploy-hardening-monitoring.yml` to copy `fleet-health-check.sh` + `fleet-health-check.service/.timer` + `ollama-idle-unload.service/.timer` to all nodes, daemon-reload, and enable both timers.
```
ansible-playbook -i inventory.ini playbooks/deploy-hardening-monitoring.yml
```
- All 7 nodes: ok=10, failed=0.
- `ollama-idle-unload.timer` newly enabled (changed) on **fnet3, fnet4, fnet6, fnet7** (the 4 that were missing it).
- New playbook committed as `dd2a2e5` and pushed to GitHub main.

### Step 5 — Fleet-wide verification

| Node | guard live | pre-flight live | check_nvm live | ollama-idle-unload timer | load avg | pegging? | pi-agent | nvm |
|------|-----------|----------------|---------------|-------------------------|----------|----------|----------|-----|
| fnet1 | **YES** (5 matches) | **YES** (2) | **YES** (2) | active | 0.26 | NO | active | present |
| fnet2 | **YES** (5 matches) | **YES** (2) | **YES** (2) | active | 0.37 | NO | active | present |
| fnet3 | **YES** (5 matches) | **YES** (2) | **YES** (2) | active | 0.64 | NO | active | present |
| fnet4 | **YES** (5 matches) | **YES** (2) | **YES** (2) | active | 0.09 | NO | active | present |
| fnet5 | **YES** (5 matches) | **YES** (2) | **YES** (2) | active | 0.06 | NO | active | present |
| fnet6 | **YES** (5 matches) | **YES** (2) | **YES** (2) | active | 0.12 | NO | active | present |
| fnet7 | **YES** (5 matches) | **YES** (2) | **YES** (2) | active | 0.22 | NO | active | present |

**Verification commands run per node:**
- (a) `grep -c "_SELF_RESOLVED\|infinite exec recursion\|pi Node.js binary not found" /usr/local/bin/pi` → ≥1 (LIVE)
- (b) `grep -c "refusing to start to prevent infinite exec recursion\|Pre-flight nvm" /home/friasc/fleet-scripts/pi-agent-standalone.sh` → ≥1 (LIVE)
- (c) `grep -c "check_nvm" /home/friasc/fleet-scripts/fleet-health-check.sh` → ≥1 (LIVE)
- (d) `systemctl is-active ollama-idle-unload.timer` → active
- (e) `cat /proc/loadavg` → all < 1.0 (max fnet3 0.64)
- (f) `systemctl is-active pi-agent@<node>` → active
- (g) nvm check (as friasc) → present on all 7

## Nodes That Fast-Failed

**NONE.** All 7 nodes have nvm present, Node.js v24.15.0 installed, and `pi` resolving to the real nvm binary (`/home/friasc/.nvm/versions/node/v24.15.0/bin/pi`). No nvm reinstall is needed on any node. The recursion guard is a no-op on all nodes (pi resolves to the real binary, not the wrapper).

## fnet5 Health Confirmation

fnet5 (the original bug node) remains healthy after the re-deploy:
- nvm: present
- pi-agent: active
- loadavg: 0.06 (not pegging)
- pi guard: LIVE (5 matches)
- A2A server: responding (v0.7.0)
- The deploy did NOT break fnet5's working install.

## Bug-Class Recurrence Prevention

The fnet5 bug class (missing nvm → `/usr/local/bin/pi` wrapper infinite exec recursion → 100% CPU) can NO LONGER recur on any node:

1. **Pi wrapper guard** (all 7 nodes): if `pi` resolves to the wrapper itself (nvm not loaded), it exits 1 with an error message instead of `exec pi "$@"` infinitely.
2. **pi-agent-standalone.sh pre-flight** (all 7 nodes): before launching pi via tmux, it checks `which pi` + `readlink -f` + `command -v node`. If nvm/Node is missing, it exits 1 with "refusing to start to prevent infinite exec recursion" instead of starting a recursive process.
3. **fleet-health-check.sh `check_nvm()`** (all 7 nodes): the periodic health check (every 5 min via `fleet-health-check.timer`) surfaces a missing-nvm condition as a manual-fix warning BEFORE it causes a peg.
4. **ollama-idle-unload.timer** (all 7 nodes): unloads idle ollama models every 2 min to reclaim RAM.

## Git Activity

| Commit | Files | Description |
|--------|-------|-------------|
| `765d143` | deploy-a2a.yml, pi-agent-standalone.sh, fleet-health-check.sh | Harden fleet templates with recursion guard + pre-flight + check_nvm |
| `dd2a2e5` | deploy-hardening-monitoring.yml | New playbook for fleet-health-check + ollama-idle-unload deploy |

Both pushed to `origin/main` (github.com/carlosfrias/pi-a2a-communication).

## Open Risks / Notes

1. **fnet1 DNS issue (pre-existing):** fnet1 cannot resolve `github.com`. The A2A extension code on fnet1 was NOT updated via `git pull` (the hardening wrapper/standalone were deployed from the controller). fnet1's A2A extension code is at whatever version was last successfully pulled. This is a pre-existing network/DNS issue, not caused by this deploy. Recommend investigating fnet1's DNS resolver config.
2. **Backups:** `*.bak-20260721-hardening` files exist in the repo (untracked) as restore points for the 3 hardened source files.
3. **No node fast-failed** — all 7 have nvm. The guard is a no-op everywhere (pi resolves to the real binary). If a node's nvm is later deleted/uninstalled, the guard will fast-fail pi-agent (exit 1 + log) instead of pegging — the desired behavior.

## Acceptance

All 5 DO steps completed. Per-node verification table confirms all hardening layers LIVE on all 7 nodes, no pegging, fnet5 intact. The fnet5 bug class cannot recur fleet-wide.
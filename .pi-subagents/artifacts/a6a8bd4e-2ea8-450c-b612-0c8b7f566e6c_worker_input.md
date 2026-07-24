# Task for worker

You are deploying the fleet-wide HARDENING (propagate the fnet5 bug-class fix to all 7 nodes) so the pi-wrapper infinite-exec-recursion (missing nvm → 100% CPU) can NEVER recur on any node. The hardened SOURCE templates are already written (by the prior worker) in this repo (`pi-a2a-communication/`):
- `ansible/deploy-a2a.yml` — the pi wrapper template now has the recursion guard (detect `pi` resolving to the wrapper itself → exit 1 instead of infinite exec).
- `scripts/pi-agent-standalone.sh` — now has a pre-flight nvm/node check (fails fast + logs "nvm missing" instead of starting a recursive process).
- `scripts/fleet-health-check.sh` — now has `check_nvm()` (surfaces a missing-nvm condition before it pegs).
Backups exist as `*.bak-20260721-hardening`. The guard is LIVE on fnet5 only; the other 6 nodes have the OLD un-guarded wrapper. Goal: propagate to ALL 7 nodes.

DO (autonomous; this is a fleet deploy via the existing playbooks — low risk, the hardened templates are additive guards):
1. Find the fleet inventory (try `ansible/inventory.yml` LAN 192.168.0.14x, or the self-hosted-stack tailscale inventory at `../../01-Projects/self-hosted-stack/infrastructure/ansible/playbooks/inventory.tailscale.yml`). Use whichever parses + reaches all 7 nodes (fnet1-fnet7). Verify reachability (ansible ping / a `ansible all -m ping`).
2. Run `ansible-playbook -i <inventory> ansible/deploy-a2a.yml` (deploys the hardened pi wrapper + the hardened pi-agent-standalone.sh to all nodes). This is the key deploy — it overwrites /usr/local/bin/pi (with the guard) + /home/friasc/fleet-scripts/pi-agent-standalone.sh (with the pre-flight) on every node. NOTE: deploy-a2a.yml may restart pi-agent@<node> — watch that no node pegs after restart (the guard prevents recursion; if a node's nvm is MISSING, the pi-agent will fast-fail + log "nvm missing" instead of pegging — that's the desired behavior, but note any node that fast-fails so its nvm can be reinstalled like fnet5's was).
3. Run the fleet-health-check deploy (find the playbook that deploys `scripts/fleet-health-check.sh` — likely `ansible/playbooks/deploy-fleet-health.yml` or similar) to propagate the `check_nvm()` monitoring to all nodes.
4. Install/enable the `ollama-idle-unload.timer` on the nodes missing it (it's LIVE on fnet5; the unit files are in `ansible/systemd/`). Deploy to fnet1-fnet4,fnet6,fnet7 (the 6 that don't have it) — find the playbook that installs these systemd units, or install via a small ad-hoc ansible task (copy the .service + .timer, daemon-reload, enable --now).
5. VERIFY fleet-wide: on EACH of the 7 nodes, confirm (a) `/usr/local/bin/pi` contains the recursion guard (grep for the guard marker), (b) `pi-agent-standalone.sh` has the pre-flight check, (c) `fleet-health-check.sh` has `check_nvm`, (d) `ollama-idle-unload.timer` active. Confirm NO node is pegging CPU after the deploy (quick `cat /proc/loadavg` per node; flag any > 1.0). Confirm fnet5 still healthy (nvm present, pi-agent active, not pegging — the deploy should NOT break fnet5's working install).

SAFETY: the deploy redeploys the pi wrapper — on nodes with nvm present (all except possibly none now — fnet5 was the only missing one + it's fixed), `pi` resolves to the Node binary + the guard is a no-op (good). On a node WITHOUT nvm (none expected now), the guard makes pi-agent fast-fail — note it. Do NOT leave any node pegging. If a node pegs after the deploy, stop its pi-agent + report (don't leave it hot).

REPORT: per-node table (node | guard live | pre-flight live | check_nvm live | ollama-idle-unload timer | load avg | pegging?), the deploy results, any node that fast-failed (needs nvm reinstall like fnet5), + confirmation the fnet5 bug class can't recur fleet-wide. Write the full report to your output file.

---
**Output:**
Write your findings to exactly this path: /Users/friasc/Cloud/carlos-desktop/workshop/01-Projects/self-hosted-stack/.frias/journal/2026-07-21-fleet-hardening-deploy-worker.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: reviewed
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope
- criterion-2: Return evidence sufficient for an independent acceptance review

Required evidence: changed-files, tests-added, commands-run, validation-output, residual-risks, no-staged-files

Review gate: optional by reviewer.

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
`criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
`commandsRun[].result` must be exactly one of: passed, failed, not-run.
`manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```
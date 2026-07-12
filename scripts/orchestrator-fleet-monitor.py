#!/usr/bin/env python3
"""
orchestrator-fleet-monitor.py — Mac/orchestrator fleet A2A remediation loop

Polls the shared NFS status directory written by each node's
fleet-health-reporter.sh. If any node reports remediation.required=true,
missing status, or stale status, runs the appropriate Ansible playbook
against that node and loops until success.

Status dir: /mnt/carlos-desktop/.fleet-status/
Orchestrator status: /mnt/carlos-desktop/.fleet-status/orchestrator.json
"""
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

STATUS_DIR = Path("/mnt/carlos-desktop/.fleet-status")
ORCHESTRATOR_STATUS = STATUS_DIR / "orchestrator.json"
INVENTORY = "/Users/friasc/Cloud/carlos-desktop/workshop/02-Areas/Infrastructure/pi-a2a-communication/ansible/inventory.ini"
PLAYBOOKS_DIR = "/Users/friasc/Cloud/carlos-desktop/workshop/02-Areas/Infrastructure/playbook-executor/playbooks"
A2A_PLAYBOOKS_DIR = "/Users/friasc/Cloud/carlos-desktop/workshop/02-Areas/Infrastructure/pi-a2a-communication/ansible"

NODES = [f"fnet{i}" for i in range(1, 8)]
STALE_THRESHOLD_MINUTES = 10
REMEDIATION_BACKOFF_SECONDS = [30, 60, 120]
MAX_RETRIES = len(REMEDIATION_BACKOFF_SECONDS)


def log(msg):
    print(f"{datetime.now(timezone.utc).isoformat()} [orchestrator-fleet-monitor] {msg}", flush=True)


def load_status(path: Path) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        log(f"WARN: cannot read {path}: {e}")
        return {}


def is_stale(status: dict) -> bool:
    ts_str = status.get("timestamp", "")
    if not ts_str:
        return True
    try:
        # Handle both ISO formats with/without explicit tz
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        ts = datetime.fromisoformat(ts_str)
        return datetime.now(timezone.utc) - ts > timedelta(minutes=STALE_THRESHOLD_MINUTES)
    except Exception:
        return True


def run_playbook(playbook: str, target: str) -> bool:
    cmd = [
        "ansible-playbook",
        "-i", INVENTORY,
        "-e", f"target={target}",
        playbook,
    ]
    log(f"Running: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=300,
            env={**os.environ, "ANSIBLE_VAULT_PASSWORD_FILE": ""},
        )
        if result.returncode == 0:
            log(f"Playbook succeeded for {target}")
            return True
        else:
            log(f"Playbook failed for {target} (exit {result.returncode}):")
            # Print last 20 lines for diagnosis
            for line in result.stdout.splitlines()[-20:]:
                log(f"  | {line}")
            return False
    except subprocess.TimeoutExpired:
        log(f"Playbook timed out for {target}")
        return False
    except Exception as e:
        log(f"Playbook exception for {target}: {e}")
        return False


def remediate_node(node: str, reasons: list[str]) -> bool:
    """Attempt remediation for a node, retrying with backoff."""
    # Use the comprehensive remediate playbook for most failures.
    # start-agents-a2a is a lighter fallback if the issue is only agent stopped.
    playbook = f"{PLAYBOOKS_DIR}/fleet-a2a-remediate.yml"

    for attempt, backoff in enumerate(REMEDIATION_BACKOFF_SECONDS, start=1):
        log(f"Remediation attempt {attempt}/{MAX_RETRIES} for {node}: reasons={reasons}")
        if run_playbook(playbook, node):
            return True
        if attempt < MAX_RETRIES:
            log(f"Waiting {backoff}s before retry for {node}")
            time.sleep(backoff)

    return False


def check_nodes():
    results = {}
    for node in NODES:
        status_path = STATUS_DIR / f"{node}.json"
        status = load_status(status_path)

        if not status:
            results[node] = {
                "state": "missing_status",
                "remediation_required": True,
                "reasons": ["status_file_missing"],
            }
            continue

        if is_stale(status):
            results[node] = {
                "state": "stale_status",
                "remediation_required": True,
                "reasons": ["status_stale"],
            }
            continue

        remediation = status.get("remediation", {})
        required = remediation.get("required", False)
        reasons = remediation.get("reasons", [])
        consecutive = remediation.get("consecutive_failures", 0)

        if required:
            results[node] = {
                "state": "remediation_required",
                "remediation_required": True,
                "reasons": reasons,
                "consecutive_failures": consecutive,
            }
        else:
            results[node] = {
                "state": "healthy",
                "remediation_required": False,
            }

    return results


def write_orchestrator_status(results: dict):
    STATUS_DIR.mkdir(parents=True, exist_ok=True)
    status = {
        "hostname": "orchestrator",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "nodes": results,
        "manual_intervention_required": [
            node for node, r in results.items()
            if r.get("manual_intervention_required")
        ],
    }
    tmp = ORCHESTRATOR_STATUS.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(status, f, indent=2)
    tmp.replace(ORCHESTRATOR_STATUS)


def main():
    log("Orchestrator fleet monitor starting")
    results = check_nodes()

    for node, result in results.items():
        if result.get("remediation_required"):
            reasons = result.get("reasons", [])
            success = remediate_node(node, reasons)
            if success:
                results[node]["state"] = "remediation_succeeded"
                results[node]["remediation_required"] = False
                # Re-check status file after remediation
                status_path = STATUS_DIR / f"{node}.json"
                time.sleep(5)  # Give reporter time to refresh
                new_status = load_status(status_path)
                if new_status.get("remediation", {}).get("required", False):
                    results[node]["state"] = "remediation_succeeded_but_still_reporting_issues"
            else:
                results[node]["state"] = "remediation_failed"
                results[node]["manual_intervention_required"] = True
                log(f"❌ {node} requires manual intervention after {MAX_RETRIES} remediation attempts")

    write_orchestrator_status(results)
    log(f"Orchestrator status written to {ORCHESTRATOR_STATUS}")

    manual = [n for n, r in results.items() if r.get("manual_intervention_required")]
    if manual:
        log(f"MANUAL INTERVENTION REQUIRED for: {', '.join(manual)}")
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()

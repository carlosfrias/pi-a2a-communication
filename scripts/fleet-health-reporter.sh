#!/usr/bin/env bash
# fleet-health-reporter.sh — Node-side A2A fleet health reporter
#
# Run via systemd timer every 2 minutes on each fleet node.
# Writes a JSON status file to the shared NFS status directory so the Mac
# orchestrator can detect failures and drive remediation until success.
#
# Status path: /mnt/carlos-desktop/.fleet-status/<hostname>.json
# Fallback path (if NFS unavailable): /opt/fleet-status/<hostname>.json

set -euo pipefail

HOSTNAME=$(hostname)
STATUS_DIR_NFS="/mnt/carlos-desktop/.fleet-status"
STATUS_DIR_LOCAL="/opt/fleet-status"
STATUS_FILE="${HOSTNAME}.json"
LOG_PREFIX="[fleet-health-reporter]"
A2A_PORT=10000
A2A_CARD="http://localhost:${A2A_PORT}/.well-known/agent-card.json"
NFS_MOUNT="/mnt/carlos-desktop"

log()  { echo "$(date -Iseconds) ${LOG_PREFIX} $*"; }
warn() { echo "$(date -Iseconds) ${LOG_PREFIX} ⚠️  $*"; }

# ── Ensure local status dir exists ─────────────────────────────────────────
mkdir -p "$STATUS_DIR_LOCAL"

# ── Helpers ──────────────────────────────────────────────────────────────
run_with_timeout() {
    timeout "$@" 2>/dev/null || return 124
}

# ── Check 1: pi-agent systemd state ───────────────────────────────────────
PI_ENABLED=false
PI_ACTIVE=false
if run_with_timeout 5 systemctl is-enabled "pi-agent@${HOSTNAME}" >/dev/null 2>&1; then
    PI_ENABLED=true
fi
if [ "$(run_with_timeout 5 systemctl is-active "pi-agent@${HOSTNAME}" 2>/dev/null || echo inactive)" = "active" ]; then
    PI_ACTIVE=true
fi

# ── Check 2: A2A agent-card endpoint ──────────────────────────────────────
A2A_OK=false
A2A_VERSION=""
A2A_NAME=""
A2A_RESPONSE=$(run_with_timeout 5 curl -fsS -H "Authorization: Bearer lab-fleet-2026" "$A2A_CARD" 2>/dev/null || true)
if [ -n "$A2A_RESPONSE" ]; then
    A2A_OK=true
    A2A_VERSION=$(echo "$A2A_RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)
    A2A_NAME=$(echo "$A2A_RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("name",""))' 2>/dev/null || true)
fi

# ── Check 3: Ollama Docker container ──────────────────────────────────────
OLLAMA_OK=false
if command -v docker &>/dev/null; then
    DOCKER_NAMES=$(docker ps --filter name=ollama --format '{{.Names}}' 2>/dev/null || true)
    if [ -n "$DOCKER_NAMES" ]; then
        OLLAMA_OK=true
    fi
fi

# ── Check 4: NFS mount ────────────────────────────────────────────────────
NFS_MOUNTED=false
NFS_RESPONSIVE=false
if run_with_timeout 5 mountpoint -q "$NFS_MOUNT" 2>/dev/null; then
    NFS_MOUNTED=true
    if run_with_timeout 5 ls "$NFS_MOUNT" >/dev/null 2>&1; then
        NFS_RESPONSIVE=true
    fi
fi

# ── Determine remediation requirement ──────────────────────────────────────
REMEDIATION_REQUIRED=false
REMEDIATION_REASONS=()

if [ "$PI_ENABLED" != true ]; then
    REMEDIATION_REQUIRED=true
    REMEDIATION_REASONS+=("pi-agent_not_enabled")
fi
if [ "$PI_ACTIVE" != true ]; then
    REMEDIATION_REQUIRED=true
    REMEDIATION_REASONS+=("pi-agent_not_active")
fi
if [ "$A2A_OK" != true ]; then
    REMEDIATION_REQUIRED=true
    REMEDIATION_REASONS+=("a2a_endpoint_down")
fi
if [ "$OLLAMA_OK" != true ]; then
    REMEDIATION_REQUIRED=true
    REMEDIATION_REASONS+=("ollama_container_down")
fi
if [ "$NFS_MOUNTED" != true ] || [ "$NFS_RESPONSIVE" != true ]; then
    REMEDIATION_REQUIRED=true
    REMEDIATION_REASONS+=("nfs_unhealthy")
fi

# ── Read previous status for consecutive-failure tracking ────────────────
CONSECUTIVE_FAILURES=0
PREV_FILE="${STATUS_DIR_LOCAL}/${STATUS_FILE}"
if [ -f "$PREV_FILE" ]; then
    PREV_REQUIRED=$(python3 -c "import json,sys; d=json.load(open('$PREV_FILE')); print(d.get('remediation',{}).get('required',False))" 2>/dev/null || echo False)
    PREV_FAILURES=$(python3 -c "import json,sys; d=json.load(open('$PREV_FILE')); print(d.get('remediation',{}).get('consecutive_failures',0))" 2>/dev/null || echo 0)
    if [ "$PREV_REQUIRED" = "True" ] && [ "$REMEDIATION_REQUIRED" = true ]; then
        CONSECUTIVE_FAILURES=$((PREV_FAILURES + 1))
    fi
fi

# ── Build status JSON ────────────────────────────────────────────────────
STATUS_JSON=$(python3 -c "
import json, datetime
status = {
    'hostname': '$HOSTNAME',
    'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'checks': {
        'pi_agent_enabled': $PI_ENABLED,
        'pi_agent_active': $PI_ACTIVE,
        'a2a_endpoint_ok': $A2A_OK,
        'a2a_version': '$A2A_VERSION',
        'a2a_name': '$A2A_NAME',
        'ollama_container_ok': $OLLAMA_OK,
        'nfs_mounted': $NFS_MOUNTED,
        'nfs_responsive': $NFS_RESPONSIVE,
    },
    'remediation': {
        'required': $REMEDIATION_REQUIRED,
        'reasons': $(printf '%s\n' "${REMEDIATION_REASONS[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))'),
        'consecutive_failures': $CONSECUTIVE_FAILURES,
    }
}
print(json.dumps(status, indent=2))
")

# ── Write local status ───────────────────────────────────────────────────
echo "$STATUS_JSON" > "$STATUS_DIR_LOCAL/$STATUS_FILE"

# ── Try to mirror to NFS status dir ──────────────────────────────────────
NFS_WRITTEN=false
if [ "$NFS_RESPONSIVE" = true ]; then
    if mkdir -p "$STATUS_DIR_NFS" 2>/dev/null && echo "$STATUS_JSON" > "$STATUS_DIR_NFS/$STATUS_FILE" 2>/dev/null; then
        NFS_WRITTEN=true
    fi
fi

if [ "$REMEDIATION_REQUIRED" = true ]; then
    warn "Remediation required: ${REMEDIATION_REASONS[*]} (consecutive_failures=$CONSECUTIVE_FAILURES)"
else
    log "Healthy — NFS mirror: $NFS_WRITTEN"
fi

exit 0

#!/usr/bin/env bash
# fleet-health-reporter.sh — Node-side A2A fleet health reporter
#
# Run via systemd timer every 2 minutes on each fleet node.
# Writes a JSON status file to the shared NFS status directory so the Mac
# orchestrator can detect failures and drive remediation until success.
#
# Status path: /mnt/carlos-desktop/.fleet-status/<hostname>.json
# Fallback path (if NFS unavailable): /opt/fleet-status/<hostname>.json

set -uo pipefail

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
# Dokploy-managed Ollama uses container_name: ollama on every fleet node.
OLLAMA_OK=false
if command -v docker &>/dev/null; then
    if docker ps --filter name=ollama --filter status=running --format '{{.Names}}' 2>/dev/null | grep -qxF 'ollama'; then
        OLLAMA_OK=true
    fi
fi

# ── Check 4: NFS mount ────────────────────────────────────────────────────
# Detect both real NFS mounts and autofs placeholders. A mountpoint is only
# considered healthy if the actual server export is visible in the mount table
# AND we can write a probe file through it.
NFS_MOUNTED=false
NFS_RESPONSIVE=false
NFS_SERVER_EXPORT="192.168.0.154:/Users/friasc/Cloud/carlos-desktop"

if run_with_timeout 5 mount | grep -qF "$NFS_SERVER_EXPORT" 2>/dev/null; then
    NFS_MOUNTED=true
    if run_with_timeout 5 ls "$NFS_MOUNT" >/dev/null 2>&1; then
        NFS_RESPONSIVE=true
    fi
fi

# Defensive write probe: create status dir and a small probe file to confirm
# the mount is writable and not just an autofs placeholder.
if [ "$NFS_MOUNTED" = true ] && [ "$NFS_RESPONSIVE" = true ]; then
    if mkdir -p "$STATUS_DIR_NFS" 2>/dev/null; then
        probe_file="$STATUS_DIR_NFS/.probe-$(hostname)"
        if echo "probe $(date -Iseconds)" > "$probe_file" 2>/dev/null; then
            if [ -s "$probe_file" ]; then
                rm -f "$probe_file" 2>/dev/null || true
            else
                NFS_RESPONSIVE=false
            fi
        else
            NFS_RESPONSIVE=false
        fi
    else
        NFS_RESPONSIVE=false
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

# Prefer the last successfully-written location (NFS if available, else local).
PREV_FILE="${STATUS_DIR_LOCAL}/${STATUS_FILE}"
if [ -f "${STATUS_DIR_NFS}/${STATUS_FILE}" ]; then
    PREV_FILE="${STATUS_DIR_NFS}/${STATUS_FILE}"
fi
if [ -f "$PREV_FILE" ]; then
    PREV_REQUIRED=$(python3 -c "import json,sys; d=json.load(open('$PREV_FILE')); print(d.get('remediation',{}).get('required',False))" 2>/dev/null || echo False)
    PREV_FAILURES=$(python3 -c "import json,sys; d=json.load(open('$PREV_FILE')); print(d.get('remediation',{}).get('consecutive_failures',0))" 2>/dev/null || echo 0)
    if [ "$PREV_REQUIRED" = "True" ] && [ "$REMEDIATION_REQUIRED" = true ]; then
        CONSECUTIVE_FAILURES=$((PREV_FAILURES + 1))
    fi
fi

# ── Build status JSON ────────────────────────────────────────────────────
# Convert bash booleans to JSON literals safely
PI_ENABLED_JSON=$( [ "$PI_ENABLED" = true ] && echo "True" || echo "False" )
PI_ACTIVE_JSON=$( [ "$PI_ACTIVE" = true ] && echo "True" || echo "False" )
A2A_OK_JSON=$( [ "$A2A_OK" = true ] && echo "True" || echo "False" )
OLLAMA_OK_JSON=$( [ "$OLLAMA_OK" = true ] && echo "True" || echo "False" )
NFS_MOUNTED_JSON=$( [ "$NFS_MOUNTED" = true ] && echo "True" || echo "False" )
NFS_RESPONSIVE_JSON=$( [ "$NFS_RESPONSIVE" = true ] && echo "True" || echo "False" )
REMEDIATION_REQUIRED_JSON=$( [ "$REMEDIATION_REQUIRED" = true ] && echo "True" || echo "False" )

REASONS_JSON='[]'
if [ ${#REMEDIATION_REASONS[@]} -gt 0 ]; then
    REASONS_JSON=$(printf '%s\n' "${REMEDIATION_REASONS[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
fi

STATUS_JSON=$(python3 -c "
import json, datetime
status = {
    'hostname': '$HOSTNAME',
    'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'checks': {
        'pi_agent_enabled': $PI_ENABLED_JSON,
        'pi_agent_active': $PI_ACTIVE_JSON,
        'a2a_endpoint_ok': $A2A_OK_JSON,
        'a2a_version': '$A2A_VERSION',
        'a2a_name': '$A2A_NAME',
        'ollama_container_ok': $OLLAMA_OK_JSON,
        'nfs_mounted': $NFS_MOUNTED_JSON,
        'nfs_responsive': $NFS_RESPONSIVE_JSON,
    },
    'remediation': {
        'required': $REMEDIATION_REQUIRED_JSON,
        'reasons': $REASONS_JSON,
        'consecutive_failures': $CONSECUTIVE_FAILURES,
    }
}
print(json.dumps(status, indent=2))
")

# ── Write status ─────────────────────────────────────────────────────────
# NFS is the source of truth for the orchestrator; the local file is only a
# cache for consecutive-failure tracking when NFS is unavailable.
NFS_WRITTEN=false
LOCAL_WRITTEN=false

# 1. Try to write to NFS (always attempt, even if unresponsive flag is set,
#    because a transient recovery may have happened since the check).
if mkdir -p "$STATUS_DIR_NFS" 2>/dev/null; then
    if echo "$STATUS_JSON" > "$STATUS_DIR_NFS/$STATUS_FILE" 2>/dev/null; then
        NFS_WRITTEN=true
    fi
fi

# 2. Fallback to local cache if NFS write failed.
if [ "$NFS_WRITTEN" != true ]; then
    if mkdir -p "$STATUS_DIR_LOCAL" 2>/dev/null && echo "$STATUS_JSON" > "$STATUS_DIR_LOCAL/$STATUS_FILE" 2>/dev/null; then
        LOCAL_WRITTEN=true
    fi
fi

if [ "$REMEDIATION_REQUIRED" = true ]; then
    warn "Remediation required: ${REMEDIATION_REASONS[*]} (consecutive_failures=$CONSECUTIVE_FAILURES)"
else
    log "Healthy — NFS mirror: $NFS_WRITTEN, local cache: $LOCAL_WRITTEN"
fi

# Never fail the service just because the local fallback is unwritable.
exit 0

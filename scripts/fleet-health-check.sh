#!/usr/bin/env bash
#
# fleet-health-check.sh — Self-healing health monitor for fleet (A2A protocol)
#
# Run via systemd timer every 5 minutes on each fleet node:
#   fleet-health-check.timer → fleet-health-check.service
#
# Can also run with --ollama-only flag for the ollama-idle-unload timer.
#
# Checks and auto-fixes:
#   1. NFS mount options (rsize/wsize must be 32KB, not 1MB)
#   2. A2A config file exists and valid
#   3. systemd daemon responsiveness
#   4. Agent systemd service running
#   4b. Agent registered with hub (C2: auto-restart if not registered)
#   5. Hub health (on fnet2 only)
#   5. Orphaned processes on hub port (on fnet2 only)
#   6. systemd daemon responsiveness (daemon-reexec if stuck)
#   7. Stuck Ollama runners (kill llama-server, restart ollama)
#
# Exit codes: 0 = healthy, 1 = issues found and auto-fixed, 2 = issues require manual intervention

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────
A2A_AGENT_CARD="http://localhost:10000/.well-known/agent-card.json"
NFS_MOUNT="/mnt/carlos-desktop"
EXPECTED_NFS_OPTS="rsize=32768,wsize=32768"
HOSTNAME=$(hostname)
AGENT_SERVICE="pi-agent@${HOSTNAME}"
LOG_PREFIX="[fleet-health]"
NFS_TIMEOUT=10  # seconds for timeout wrapper on NFS commands

# ── Mode: --ollama-only skips all checks except Ollama ──
OLLAMA_ONLY=false
if [[ "${1:-}" == "--ollama-only" ]]; then
    OLLAMA_ONLY=true
fi

# ── Colors / Logging ─────────────────────────────────────────────────────
log()  { echo "$(date -Iseconds) $LOG_PREFIX $*"; }
warn() { echo "$(date -Iseconds) $LOG_PREFIX ⚠️  $*"; }
fix()  { echo "$(date -Iseconds) $LOG_PREFIX 🔧 $*"; }
fail() { echo "$(date -Iseconds) $LOG_PREFIX ❌ $*"; }

ISSUES_FOUND=0
ISSUES_FIXED=0
ISSUES_MANUAL=0

# ── NFS-safe command wrapper ──────────────────────────────────────────────
# Wraps commands that touch NFS mounts with a timeout to prevent indefinite
# hangs when the NFS server (192.168.0.154) is unresponsive with hard mounts.
nfs_cmd() {
    timeout "$NFS_TIMEOUT" "$@" 2>/dev/null || {
        local rc=$?
        if [ $rc -eq 124 ]; then
            warn "NFS command timed out: $* (timeout=${NFS_TIMEOUT}s)"
            return 124
        fi
        return $rc
    }
}

# ── Check 1: NFS mount options ───────────────────────────────────────────
check_nfs() {
    if ! nfs_cmd mountpoint -q "$NFS_MOUNT" 2>/dev/null; then
        if [ $? -eq 124 ]; then
            # mountpoint command timed out — NFS server likely unresponsive
            warn "mountpoint check timed out for $NFS_MOUNT — NFS server may be down"
            # Kill stale TCP connections to NFS server
            sudo ss -K dst 192.168.0.154 dport = 2049 2>/dev/null || true
            # Lazy umount to unblock other processes
            sudo timeout 5 umount -l "$NFS_MOUNT" 2>/dev/null || true
            ((ISSUES_MANUAL++))
            return
        fi

        warn "NFS mount $NFS_MOUNT is not mounted"
        # Kill stale TCP connections to NFS server first
        sudo ss -K dst 192.168.0.154 dport = 2049 2>/dev/null || true
        sleep 1
        # Attempt mount from fstab
        if grep -q "$NFS_MOUNT" /etc/fstab 2>/dev/null; then
            fix "Attempting to mount $NFS_MOUNT from fstab..."
            if sudo timeout "$NFS_TIMEOUT" mount "$NFS_MOUNT" 2>/dev/null; then
                fix "NFS mounted successfully"
                ((ISSUES_FIXED++))
            else
                fail "Cannot mount $NFS_MOUNT — check NFS server and network"
                ((ISSUES_MANUAL++))
            fi
        else
            fail "No fstab entry for $NFS_MOUNT"
            ((ISSUES_MANUAL++))
        fi
        return
    fi

    local mount_opts
    mount_opts=$(mount | grep "$NFS_MOUNT" | head -1)

    # Check rsize/wsize
    if echo "$mount_opts" | grep -q "rsize=1048576\|wsize=1048576"; then
        warn "NFS using 1MB rsize/wsize (causes TCP hangs), fixing to 32KB..."
        # Fix fstab first
        if grep -q "rsize=1048576" /etc/fstab; then
            fix "Updating /etc/fstab NFS options..."
            sudo sed -i 's/rsize=1048576,wsize=1048576,timeo=30,retrans=6/rsize=32768,wsize=32768,timeo=10,retrans=2/g' /etc/fstab
        fi
        # Kill stale connections then lazy umount + fresh mount
        fix "Killing stale NFS connections and remounting..."
        sudo ss -K dst 192.168.0.154 dport = 2049 2>/dev/null || true
        sleep 1
        sudo timeout 5 umount -l "$NFS_MOUNT" 2>/dev/null || true
        sleep 1
        sudo ss -K dst 192.168.0.154 dport = 2049 2>/dev/null || true
        sleep 1
        if sudo timeout "$NFS_TIMEOUT" mount "$NFS_MOUNT" 2>/dev/null; then
            fix "NFS remounted with correct options"
            ((ISSUES_FIXED++))
        else
            fail "Cannot remount NFS with correct options"
            ((ISSUES_MANUAL++))
        fi
    fi

    # Verify NFS mount is responsive (not hung) by listing directory
    if ! nfs_cmd ls "$NFS_MOUNT" >/dev/null 2>&1; then
        if [ $? -eq 124 ]; then
            warn "NFS mount $NFS_MOUNT is mounted but unresponsive (ls timed out)"
            fix "Killing stale NFS connections and lazy umounting..."
            sudo ss -K dst 192.168.0.154 dport = 2049 2>/dev/null || true
            sleep 1
            sudo timeout 5 umount -l "$NFS_MOUNT" 2>/dev/null || true
            ((ISSUES_MANUAL++))
        fi
    fi
}

# ── Check 1b: nvm + Node.js existence (2026-07-21 hardening) ────────
# Verifies that ~/.nvm/nvm.sh exists AND that `which node` succeeds after
# sourcing nvm. If nvm is missing (e.g. deleted), the /usr/local/bin/pi
# wrapper enters infinite exec recursion → 100% CPU. This check surfaces
# the missing-nvm condition BEFORE it causes a peg.
check_nvm() {
    local nvm_sh="$HOME/.nvm/nvm.sh"
    if [ ! -s "$nvm_sh" ]; then
        warn "nvm.sh not found at $nvm_sh — Node.js environment is missing! "
        warn "This will cause the pi wrapper to fail (or infinite-loop if the guard is absent)."
        warn "Fix: reinstall nvm + Node.js on this node."
        ((ISSUES_MANUAL++))
        return
    fi

    # Source nvm and verify node is on PATH
    local node_path
    node_path=$( . "$nvm_sh" 2>/dev/null && command -v node 2>/dev/null || true )
    if [ -z "$node_path" ]; then
        warn "nvm.sh exists but `node` not found after sourcing — Node.js may not be installed via nvm."
        warn "Fix: run 'nvm install 24.15.0' on this node."
        ((ISSUES_MANUAL++))
        return
    fi

    log "nvm + node OK: $node_path"
}

# ── Check 2: A2A config exists ──────────────────────────────────────────
# Verifies the A2A agent config file exists and has required fields.
check_a2a_config() {
    local config_file="$HOME/.pi/agent/a2a/config.json"
    if [ ! -f "$config_file" ]; then
        warn "A2A config file not found at $config_file"
        ((ISSUES_MANUAL++))
        return
    fi

    local has_token has_port
    has_token=$(grep -c '"bearerToken"' "$config_file" 2>/dev/null || echo "0")
    has_port=$(grep -c '"port"' "$config_file" 2>/dev/null || echo "0")

    if [ "$has_token" -eq 0 ]; then
        warn "A2A config missing bearerToken"
        ((ISSUES_MANUAL++))
    fi

    if [ "$has_port" -eq 0 ]; then
        warn "A2A config missing port"
        ((ISSUES_MANUAL++))
    fi
}
# ── Check 3: systemd daemon responsiveness ───────────────────────────────
check_systemd() {
    # systemd can freeze under heavy restart loops (e.g., agent crashing repeatedly)
    # daemon-reexec restarts the manager process without rebooting
    local systemd_state
    systemd_state=$(systemctl is-system-running 2>/dev/null | head -1 || echo "unknown")

    if [ "$systemd_state" = "degraded" ] || [ "$systemd_state" = "unknown" ] || [ -z "$systemd_state" ]; then
        # Check if it's actually stuck by timing a simple command
        local timeout_result
        timeout_result=$(timeout 5 systemctl is-active "$AGENT_SERVICE" 2>/dev/null || echo "timed-out")
        if [ "$timeout_result" = "timed-out" ]; then
            warn "systemd daemon appears stuck (commands timing out)"
            fix "Attempting daemon-reexec to recover..."
            sudo systemctl daemon-reexec 2>/dev/null || true
            sleep 5
            # Verify recovery
            local recheck
            recheck=$(timeout 5 systemctl is-active "$AGENT_SERVICE" 2>/dev/null || echo "still-stuck")
            if [ "$recheck" = "still-stuck" ]; then
                fail "systemd daemon still stuck after reexec — may need reboot"
                ((ISSUES_MANUAL++))
            else
                fix "systemd daemon recovered after reexec"
                ((ISSUES_FIXED++))
            fi
        fi
    fi
}

# ── Check 4: Agent service ────────────────────────────────────────────────
check_agent() {
    local is_active
    is_active=$(timeout 5 systemctl is-active "$AGENT_SERVICE" 2>/dev/null || echo "unknown")

    if [ "$is_active" != "active" ]; then
        warn "Agent service $AGENT_SERVICE is $is_active"
        # Check if it's in restart loop
        local restart_count
        restart_count=$(timeout 5 systemctl show "$AGENT_SERVICE" -p NRestarts 2>/dev/null | awk -F= '{print $2}' || echo "0")
        if [ -n "$restart_count" ] && [ "$restart_count" -gt 50 ]; then
            warn "Critical restart loop ($restart_count restarts) — killing agent processes and recovering..."
            killall -9 pi 2>/dev/null || true
            killall -9 tmux 2>/dev/null || true
            killall -9 pi-agent-standalone.sh 2>/dev/null || true
            sudo systemctl daemon-reexec 2>/dev/null || true
            sleep 5
            sudo systemctl restart "$AGENT_SERVICE" 2>/dev/null || true
            ((ISSUES_FIXED++))
        elif [ -n "$restart_count" ] && [ "$restart_count" -gt 10 ]; then
            warn "Agent in restart loop ($restart_count restarts) — checking config..."
            # The auth token check above should have already fixed it
            fix "Restarting agent after config fix..."
            sudo systemctl restart "$AGENT_SERVICE" 2>/dev/null || true
            ((ISSUES_FIXED++))
        else
            # Just try restarting
            fix "Restarting agent service..."
            sudo systemctl restart "$AGENT_SERVICE" 2>/dev/null || true
            ((ISSUES_FIXED++))
        fi
    fi
}

# ── Check 4b: A2A agent-card accessible ─────────────────────────────────
# Verifies the A2A agent-card endpoint is responding.
check_a2a_agent_card() {
    if [ "$OLLAMA_ONLY" = true ]; then return; fi

    local card_response
    card_response=$(curl -sf -m 5 "$A2A_AGENT_CARD" 2>/dev/null || echo "")

    if [ -z "$card_response" ]; then
        warn "A2A agent-card not responding at $A2A_AGENT_CARD"
        local is_active
        is_active=$(timeout 5 systemctl is-active "$AGENT_SERVICE" 2>/dev/null || echo "unknown")
        if [ "$is_active" = "active" ]; then
            fix "Restarting agent service to restore A2A agent-card..."
            sudo systemctl restart "$AGENT_SERVICE" 2>/dev/null || true
            ((ISSUES_FIXED++))
        else
            warn "Agent service is $is_active — skipping A2A restart"
        fi
    fi
}
# ── Check 5: REMOVED (no hub in A2A architecture) ──────────────────────

# ── Check 6: REMOVED (no hub port in A2A architecture) ─────────────────

# ── Check 7a: Ollama service health ──────────────────────────────────
# Ensures Ollama is running as a Docker container with API responding.
# Handles: systemd Ollama still active (migrate to Docker), missing container,
# stopped container, port 11434 conflict, crash loop.
check_ollama_service() {
    if ! command -v docker &>/dev/null; then
        return  # Docker not installed on this node
    fi

    # Check if systemd Ollama is still active (should be masked/migrated to Docker)
    if command -v systemctl &>/dev/null; then
        local systemd_active
        systemd_active=$(systemctl is-active ollama 2>/dev/null || echo "inactive")
        if [ "$systemd_active" = "active" ]; then
            warn "Systemd Ollama is still active — should be Docker-only"
            fix "Stopping and masking systemd Ollama..."
            sudo systemctl stop ollama 2>/dev/null || true
            sudo systemctl disable ollama 2>/dev/null || true
            sudo rm -rf /etc/systemd/system/ollama.service.d 2>/dev/null || true
            sudo rm -f /etc/systemd/system/ollama.service 2>/dev/null || true
            sudo systemctl mask ollama 2>/dev/null || true
            sudo systemctl daemon-reload 2>/dev/null || true
            ((ISSUES_FIXED++))
        fi
    fi

    # Check Docker Ollama container is running
    local docker_ollama
    docker_ollama=$(docker ps --filter name=ollama --format '{{.Names}}' 2>/dev/null || true)

    if [ -z "$docker_ollama" ]; then
        # No Docker container — check if it exists but stopped
        local stopped_container
        stopped_container=$(docker ps -a --filter name=ollama --format '{{.Names}} {{.Status}}' 2>/dev/null || true)
        if [ -n "$stopped_container" ]; then
            warn "Ollama Docker container exists but is not running: $stopped_container"
            fix "Starting existing Ollama container..."
            docker start ollama 2>/dev/null || true
            sleep 5
        else
            # No container at all — start from scratch
            warn "No Ollama Docker container found"
            if [ ! -d /usr/share/ollama/.ollama ]; then
                fail "Ollama data directory /usr/share/ollama/.ollama not found"
                ((ISSUES_MANUAL++))
                return
            fi
            fix "Creating Ollama Docker container..."
            docker run -d \
                --name ollama \
                --restart unless-stopped \
                -e OLLAMA_HOST=0.0.0.0 \
                -e OLLAMA_KEEP_ALIVE=0 \
                -v /usr/share/ollama/.ollama:/root/.ollama \
                -p 11434:11434 \
                ollama/ollama:latest 2>/dev/null || true
            sleep 10
        fi
        # Recheck
        docker_ollama=$(docker ps --filter name=ollama --format '{{.Names}}' 2>/dev/null || true)
        if [ -z "$docker_ollama" ]; then
            fail "Failed to start Ollama Docker container"
            ((ISSUES_MANUAL++))
            return
        fi
        ((ISSUES_FIXED++))
    fi

    # Check if API is responding
    local api_response
    api_response=$(curl -sk -m 5 -o /dev/null -w '%{http_code}' http://localhost:11434/ 2>/dev/null || echo "000")
    if [ "$api_response" != "200" ]; then
        warn "Ollama API not responding (HTTP $api_response)"
        # Container might be starting — wait and retry
        sleep 5
        api_response=$(curl -sk -m 5 -o /dev/null -w '%{http_code}' http://localhost:11434/ 2>/dev/null || echo "000")
        if [ "$api_response" != "200" ]; then
            # Try restarting the container
            fix "Restarting Ollama container..."
            docker restart ollama 2>/dev/null || true
            sleep 10
            api_response=$(curl -sk -m 5 -o /dev/null -w '%{http_code}' http://localhost:11434/ 2>/dev/null || echo "000")
            if [ "$api_response" != "200" ]; then
                fail "Ollama API still not responding after restart (HTTP $api_response)"
                ((ISSUES_MANUAL++))
            else
                fix "Ollama API recovered after container restart"
                ((ISSUES_FIXED++))
            fi
        fi
    fi
}
# Ollama bug #7645: pi's SSE/streaming connection prevents model unloading
# even with OLLAMA_KEEP_ALIVE=0. Models get stuck in "Stopping..." state at
# 100% CPU, causing thermal throttling on Intel NUCs.
#
# This check:
# 1. Detects stuck "Stopping..." state and force-kills llama-server
# 2. Unloads idle models via ollama stop
# 3. Falls back to restarting the ollama service if kill fails
check_ollama() {
    # Check if ollama is installed and running
    if ! command -v ollama &>/dev/null; then
        return
    fi

    local ps_output
    ps_output=$(timeout 10 ollama ps 2>/dev/null || true)
    local loaded
    loaded=$(echo "$ps_output" | tail -n +2 | awk '{print $1}' | grep -v '^$' || true)

    if [ -z "$loaded" ]; then
        # No models loaded — nothing to do
        return
    fi

    # Check for stuck "Stopping..." state
    local stopping_count
    stopping_count=$(echo "$ps_output" | grep -c "Stopping" || true)

    if [ "$stopping_count" -gt 0 ]; then
        warn "Found $stopping_count stuck model(s) in Stopping state, force-killing runner"
        # Kill the llama-server process (owned by ollama user)
        sudo pkill -u ollama -f 'llama-server' 2>/dev/null || true
        sleep 2
        # If still stuck, restart ollama Docker container
        local remaining
        remaining=$(timeout 10 ollama ps 2>/dev/null | tail -n +2 | awk '{print $1}' | grep -v '^$' | wc -l || true)
        if [ "$remaining" -gt 0 ]; then
            warn "Still stuck after kill, restarting Ollama Docker container"
            docker restart ollama 2>/dev/null || true
            sleep 3
        fi
        # Final check
        remaining=$(timeout 10 ollama ps 2>/dev/null | tail -n +2 | awk '{print $1}' | grep -v '^$' | wc -l || true)
        if [ "$remaining" -eq 0 ]; then
            fix "Successfully unloaded all stuck Ollama models"
        else
            fail "$remaining Ollama model(s) still loaded after restart"
            ((ISSUES_MANUAL++))
        fi
        return
    fi

    # Check if any model is actively processing
    local active_count
    active_count=$(echo "$ps_output" | grep -v "Stopping" | grep -c "now" || true)

    if [ "$active_count" -gt 0 ]; then
        log "Ollama model(s) actively processing, skipping unload"
        return
    fi

    # Unload all idle models using ollama stop
    for model in $loaded; do
        log "Unloading idle Ollama model: $model"
        timeout 10 ollama stop "$model" 2>/dev/null || true
    done

    # Wait and verify
    sleep 3
    local remaining
    remaining=$(timeout 10 ollama ps 2>/dev/null | tail -n +2 | awk '{print $1}' | grep -v '^$' | wc -l || true)
    if [ "$remaining" -gt 0 ]; then
        # ollama stop didn't work — models are stuck, kill llama-server
        warn "ollama stop failed, force-killing llama-server process"
        sudo pkill -u ollama -f 'llama-server' 2>/dev/null || true
        sleep 2
        # If still stuck, restart ollama Docker container
        remaining=$(timeout 10 ollama ps 2>/dev/null | tail -n +2 | awk '{print $1}' | grep -v '^$' | wc -l || true)
        if [ "$remaining" -gt 0 ]; then
            warn "Still stuck after kill, restarting Ollama Docker container"
            docker restart ollama 2>/dev/null || true
        fi
        remaining=$(timeout 10 ollama ps 2>/dev/null | tail -n +2 | awk '{print $1}' | grep -v '^$' | wc -l || true)
        if [ "$remaining" -eq 0 ]; then
            fix "Successfully force-unloaded stuck Ollama models"
        else
            fail "$remaining Ollama model(s) still loaded after restart"
            ((ISSUES_MANUAL++))
        fi
    fi
}

# ── Main ──────────────────────────────────────────────────────────────────
log "Fleet health check starting for $HOSTNAME"

if [ "$OLLAMA_ONLY" = true ]; then
    log "Running in --ollama-only mode"
    check_ollama_service
    check_ollama
else
    check_nfs
    check_nvm
    check_a2a_config
    check_systemd
    check_agent
    check_a2a_agent_card
    check_ollama_service
    check_ollama
fi

if [ "$ISSUES_MANUAL" -gt 0 ]; then
    fail "$ISSUES_FOUND issues: $ISSUES_FIXED fixed, $ISSUES_MANUAL require manual intervention"
    exit 2
elif [ "$ISSUES_FIXED" -gt 0 ]; then
    fix "$ISSUES_FOUND issues found, all auto-fixed"
    exit 1
else
    log "All checks passed ✅"
    exit 0
fi
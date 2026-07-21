#!/bin/bash
# pi-agent-standalone.sh — Persistent A2A fleet agent via tmux
#
# Pi needs a TTY to stay in interactive mode with extensions active.
# This script runs pi inside a tmux session, which provides a pseudo-terminal.
# The A2A extension maintains its connection to the peer network as long as
# pi's REPL is alive. systemd manages the tmux session lifecycle.
#
# CRASH DETECTION (2026-06-16):
# Previously, when pi crashed inside tmux, the tmux session stayed alive
# (bash continued running). systemd saw "active (running)" and never
# restarted the agent. Now we track pi's PID and kill the tmux session
# when pi dies, so systemd's Restart=on-failure can restart the service.
#
# IDLE MODEL OFFLOADING (2026-05-29):
# Do NOT send an initial prompt — let pi start idle in the REPL.
# The model loads only when a A2A task arrives, and the
# ollama-idle-unload watchdog kills stuck runners.
# This prevents Ollama bug #7645 (SSE prevents model unloading → 100% CPU).

set -euo pipefail

# ── Load nvm so systemd uses the managed Node.js version ──
# Save positional params before sourcing nvm (nvm processes $@)
_saved_args=("$@")
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
set -- "${_saved_args[@]}"
unset _saved_args

SESSION_NAME="pi-agent"
TMUX_TMPDIR="$HOME/.tmux"

# OLLAMA_KEEP_ALIVE=10m keeps models resident across A2A tasks, avoiding
# ~89s cold starts on every request. The systemd unit sets the same value;
# this wrapper default is a safety fallback and can be overridden.
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-10m}"
mkdir -p "$TMUX_TMPDIR"
export TMUX_TMPDIR

# Export explicit HOSTNAME so cloud models can identify the node correctly.
# Cloud models (e.g., qwen3.5:397b-cloud) run remotely and don't know which
# physical node they're on. By exporting HOSTNAME, the model can use it
# via shell commands or the environment instead of guessing.
export HOSTNAME
HOSTNAME=$(hostname)

INITIAL_PROMPT="You are an A2A fleet agent. Your A2A extension is already loaded. Report your hostname, then wait for tasks via the A2A tools."
INITIAL_PROMPT_ENABLED=false  # Set to true only for debugging; false prevents idle model loading

# Kill any existing tmux session with this name
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

# ── Pre-flight nvm/node check (2026-07-21 hardening) ──
# Before launching pi via tmux, verify that nvm loaded and that `which pi`
# resolves to the real Node.js binary — NOT the /usr/local/bin/pi wrapper.
# If nvm is missing (e.g. ~/.nvm deleted), `which pi` resolves to the
# wrapper which would re-exec itself infinitely (100% CPU). Fail fast
# with a clear log message instead of starting a recursive process.
PI_BIN=$(which pi 2>/dev/null || true)
if [ -z "$PI_BIN" ]; then
    echo "Error: pi binary not found after sourcing nvm. nvm may be missing or Node.js not installed." >&2
    exit 1
fi
# Resolve symlinks to detect if pi resolves to the wrapper itself
_PI_REAL=$(readlink -f "$PI_BIN" 2>/dev/null || echo "$PI_BIN")
if [ "$_PI_REAL" = "/usr/local/bin/pi" ]; then
    echo "Error: pi resolves to /usr/local/bin/pi wrapper (not the real Node.js binary). nvm/Node.js is missing — refusing to start to prevent infinite exec recursion." >&2
    exit 1
fi
unset _PI_REAL
if ! command -v node &>/dev/null; then
    echo "Error: node not found on PATH after sourcing nvm. Node.js may not be installed." >&2
    exit 1
fi

# Find absolute path to pi
# (PI_BIN already set above by the pre-flight check)
if [ -z "$PI_BIN" ]; then
    echo "Error: pi binary not found" >&2
    exit 1
fi

# Build the pi command from all flags.
#
# Pi v0.76+ supports extension CLI flags (like --name, --project,
# --server-url, --auth-token, --purpose, --node) directly on the
# command line — no -- separator needed. The systemd unit template
# historically used a -- separator between native and extension flags.
# We now flatten all flags into a single command line, which works
# correctly regardless of whether -- is present.
#
# Split at -- is kept for backward compat with older systemd units,
# but the resulting PI_CMD omits the -- separator entirely.

ALL_ARGS=()
SEEN_DASH_DASH=false
for arg in "$@"; do
    if [[ "$arg" == "--" ]]; then
        SEEN_DASH_DASH=true
        continue
    fi
    ALL_ARGS+=("$arg")
done

# Build the pi command — all flags flat (no -- separator)
PI_CMD="$PI_BIN"
for arg in "${ALL_ARGS[@]}"; do
    PI_CMD="$PI_CMD $arg"
done

# Create a new tmux session running pi
# -d = detached (no terminal attached)
# The pi process inherits a proper PTY from tmux.
tmux new-session -d -s "$SESSION_NAME" -x 200 -y 50 \
    $PI_CMD

# Wait for pi to initialize and be ready for input
sleep 5

# ── Capture pi's PID for crash detection ──
# tmux stores the child process PID. We use it to detect when pi dies.
PI_PID=""
if tmux list-panes -t "$SESSION_NAME" -F '#{pane_pid}' 2>/dev/null | head -1 | grep -qE '^[0-9]+$'; then
    # The pane_pid is the shell that tmux created. pi is a child of that shell.
    PANE_PID=$(tmux list-panes -t "$SESSION_NAME" -F '#{pane_pid}' 2>/dev/null | head -1)
    # Find the pi node process (child of the pane shell)
    PI_PID=$(pgrep -P "$PANE_PID" 2>/dev/null | head -1 || true)
fi

if [ -z "$PI_PID" ]; then
    # Fallback: find pi process by command pattern
    PI_PID=$(pgrep -f "node.*pi" 2>/dev/null | head -1 || true)
fi

# Send the initial prompt ONLY if enabled (default: false)
# When disabled, pi starts idle and the model loads only on demand.
# This prevents the Ollama runner from burning 100% CPU at idle.
if [[ "$INITIAL_PROMPT_ENABLED" == "true" ]]; then
    tmux send-keys -t "$SESSION_NAME" "$INITIAL_PROMPT" Enter
else
    # For idle start: pi loads extensions but does NOT trigger model inference.
    # The A2A extension connects to the peer network and listens for tasks.
    # When a task arrives, pi will load the model on demand.
    :
fi

# ── Main monitor loop: detect pi crashes and exit cleanly ──
# When pi crashes inside tmux, the tmux session stays alive (the shell continues).
# This masked failures: systemd saw "active (running)" and never restarted.
#
# Fix: Monitor pi's PID. When pi dies, kill the tmux session so the script exits,
# and systemd's Restart=on-failure will restart the service.
#
# If we couldn't find pi's PID, fall back to checking if tmux is still alive.

if [ -n "$PI_PID" ]; then
    # Monitor pi PID directly — most reliable
    while kill -0 "$PI_PID" 2>/dev/null && tmux has-session -t "$SESSION_NAME" 2>/dev/null; do
        sleep 5
    done
    # Pi died or tmux died — clean up and exit with failure code
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
    exit 1
else
    # Fallback: just monitor tmux session existence (old behavior)
    while tmux has-session -t "$SESSION_NAME" 2>/dev/null; do
        sleep 5
    done
fi
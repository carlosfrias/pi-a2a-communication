#!/usr/bin/env bash
# apply-fnet-launchd-wrappers.sh
#
# Apply named, signed fnet- wrappers to all Python-based LaunchAgents on this Mac.
# Run this after changing any LaunchAgent command so the wrapper matches.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATOR="$SCRIPT_DIR/generate-fnet-launchd-wrapper.sh"

PYTHON_VENV="/Users/friasc/Cloud/carlos-desktop/workshop/.venv/bin/python"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"

if [[ ! -x "$GENERATOR" ]]; then
  echo "ERROR: generator not found or not executable: $GENERATOR" >&2
  exit 1
fi

# 1. Fleet orchestrator monitor
"$GENERATOR" \
  --name fnet-orchestrator-fleet-monitor \
  --program /usr/local/bin/python3 \
  --arg /Users/friasc/.pi/agent/git/github.com/carlosfrias/pi-a2a-communication/scripts/orchestrator-fleet-monitor.py \
  --plist "$LAUNCH_AGENTS_DIR/com.frias.orchestrator-fleet-monitor.plist" \
  --reload

# 2. Trading desk scheduled jobs
for task in eod morning news-check sunday monday-close; do
  "$GENERATOR" \
    --name "fnet-tradingdesk-schedule-${task}" \
    --program "$PYTHON_VENV" \
    --arg -m \
    --arg td \
    --arg schedule \
    --arg run \
    --arg "$task" \
    --plist "$LAUNCH_AGENTS_DIR/com.tradingdesk.schedule.${task}.plist" \
    --reload
done

# 3. ChromaDB fleet memory sync (shell wrapper that calls Python)
"$GENERATOR" \
  --name fnet-chromadb-sync \
  --program /Users/friasc/Cloud/carlos-desktop/workshop/02-Areas/Infrastructure/playbook-executor/scripts/fleet-memory-sync.sh \
  --arg both \
  --plist "$LAUNCH_AGENTS_DIR/com.carlosfrias.chromadb-sync.plist" \
  --reload

# 4. Schwab trades email fetcher (shell wrapper that calls Python)
"$GENERATOR" \
  --name fnet-pi-email-fetcher-schwab-trades \
  --program /Users/friasc/Cloud/carlos-desktop/workshop/02-Areas/Infrastructure/pi-email-fetcher/scripts/fetch-schwab-trades.sh \
  --arg --capture \
  --arg --positions \
  --arg --days \
  --arg 1 \
  --plist "$LAUNCH_AGENTS_DIR/com.carlosfrias.pi-email-fetcher.schwab-trades.plist" \
  --reload

echo "All fnet- LaunchAgent wrappers applied."
echo "Binaries in ${HOME}/bin:"
ls -1 "${HOME}/bin"/fnet-* 2>/dev/null || true

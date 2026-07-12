#!/usr/bin/env bash
# apply-fnet-launchd-wrappers.sh
#
# One-shot command to ensure every managed LaunchAgent has a named, signed
# fnet-* wrapper binary. This is the backwards-compatible entry point; the
# canonical tool is fnet-schedule.
#
# Usage:
#   apply-fnet-launchd-wrappers.sh           # migrate + sync
#   apply-fnet-launchd-wrappers.sh --create  # interactive create (delegates to fnet-schedule)
#   apply-fnet-launchd-wrappers.sh --list    # list managed items
#
# This script is automatically invoked by fnet-schedule create/update, so you
# normally do not need to run it manually.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FNET_SCHEDULE="$SCRIPT_DIR/fnet-schedule"

if [[ ! -x "$FNET_SCHEDULE" ]]; then
  echo "ERROR: fnet-schedule not found: $FNET_SCHEDULE" >&2
  exit 1
fi

case "${1:-}" in
  --create|-c)
    shift || true
    exec "$FNET_SCHEDULE" create "$@"
    ;;
  --update|-u)
    shift || true
    exec "$FNET_SCHEDULE" update "$@"
    ;;
  --list|-l)
    exec "$FNET_SCHEDULE" list
    ;;
  --help|-h|help)
    cat <<'EOF'
apply-fnet-launchd-wrappers.sh — Convenience wrapper around fnet-schedule.

This script is auto-invoked by fnet-schedule create/update, so the typical
workflow is:

  fnet-schedule create --name my-task --command /path/to/bin --interval 300

To bulk-reapply wrappers to existing LaunchAgents:

  apply-fnet-launchd-wrappers.sh

Options:
  (none)       Migrate existing plists and re-apply wrappers
  --create     Delegate to fnet-schedule create
  --update     Delegate to fnet-schedule update
  --list       Show all managed scheduled items
  --help       Show this help
EOF
    ;;
  *)
    echo "Applying fnet- wrappers to all LaunchAgent plists..."
    "$FNET_SCHEDULE" migrate
    "$FNET_SCHEDULE" sync
    ;;
esac

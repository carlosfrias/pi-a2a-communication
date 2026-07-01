#!/usr/bin/env bash
# Integration test: the package MUST build under a production install, because
# `pi install` runs `npm install --omit=dev` then `prepare: npm run build`.
# This is the authoritative RED/GREEN for the prod-install build path.
#
# Run: npm run test:build
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d /tmp/pi-a2a-prodbuild.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Copying package to $TMP (excluding node_modules/dist/.git) ..."
rsync -a --exclude node_modules --exclude dist --exclude .git "$SRC/" "$TMP/"
cd "$TMP"

echo "==> npm install --omit=dev (what pi install does) ..."
npm install --omit=dev --no-fund --no-audit

echo "==> npm run build (the prepare step) ..."
npm run build

echo "==> Asserting dist artifacts ..."
test -f dist/index.js   || { echo "FAIL: dist/index.js missing"; exit 1; }
test -f dist/index.cjs  || { echo "FAIL: dist/index.cjs missing"; exit 1; }

echo "==> Asserting build deps present, dev tooling absent ..."
test -d node_modules/typescript   || { echo "FAIL: typescript not installed (must be in dependencies)"; exit 1; }
test -d node_modules/@types/node  || { echo "FAIL: @types/node not installed (must be in dependencies)"; exit 1; }
test ! -d node_modules/vitest     || { echo "FAIL: vitest present under --omit=dev (should be dev-only)"; exit 1; }

echo "PASS: package builds under a production install."
#!/usr/bin/env bash
#
# Install (or reinstall) the Instagram → Notion sync as a macOS launchd agent
# that runs twice a day. Idempotent: safe to re-run after code changes.
#
# Usage:  ./launchd/install.sh
#
set -euo pipefail

LABEL="com.prscott.instagram-notion-sync"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE="${SCRIPT_DIR}/${LABEL}.plist"
DEST_DIR="${HOME}/Library/LaunchAgents"
DEST="${DEST_DIR}/${LABEL}.plist"

# Prefer the project virtualenv's Python if present, else the system python3.
if [[ -x "${PROJECT_DIR}/.venv/bin/python" ]]; then
    PYTHON="${PROJECT_DIR}/.venv/bin/python"
else
    PYTHON="$(command -v python3)"
fi
echo "Using Python: ${PYTHON}"

mkdir -p "${DEST_DIR}" "${PROJECT_DIR}/logs"

# Substitute placeholders into the destination plist.
sed -e "s#__PYTHON__#${PYTHON}#g" \
    -e "s#__PROJECT_DIR__#${PROJECT_DIR}#g" \
    "${TEMPLATE}" > "${DEST}"
echo "Wrote ${DEST}"

# Reload: unload an existing copy (ignore errors) then load the new one.
launchctl unload "${DEST}" 2>/dev/null || true
launchctl load "${DEST}"
echo "Loaded launchd agent ${LABEL}."

echo
echo "It will run daily at 08:00 and 20:00."
echo "Run once now:   launchctl start ${LABEL}"
echo "Watch logs:     tail -f ${PROJECT_DIR}/logs/sync.err.log"
echo "Uninstall:      launchctl unload ${DEST} && rm ${DEST}"

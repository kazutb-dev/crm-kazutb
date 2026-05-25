#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEW_SCRIPT="${SCRIPT_DIR}/dev_to_prod_release.sh"

if [[ ! -x "$NEW_SCRIPT" ]]; then
    echo "[deploy-prod] ERROR: missing executable $NEW_SCRIPT" >&2
    exit 1
fi

echo "[deploy-prod] WARNING: deprecated wrapper. Forwarding to dev_to_prod_release.sh"
exec "$NEW_SCRIPT" "$@"

#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEW_SCRIPT="${SCRIPT_DIR}/prod_to_dev_sync.sh"

if [[ ! -x "$NEW_SCRIPT" ]]; then
    echo "[refresh-dev] ERROR: missing executable $NEW_SCRIPT" >&2
    exit 1
fi

echo "[refresh-dev] Deprecated wrapper: forwarding to prod_to_dev_sync.sh"
exec "$NEW_SCRIPT" "$@"

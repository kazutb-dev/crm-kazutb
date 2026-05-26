#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="[sync-public-assets]"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib_deploy_common.sh"

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
MANIFEST_FILE="${SCRIPT_DIR}/runtime_public_assets_manifest.txt"

DRY_RUN=0
ASSUME_YES=0
DIRECTION=""

usage() {
    cat <<'USAGE'
Usage:
  /var/www/laravel-react/scripts/deploy/sync_public_assets.sh --direction <dev-to-prod|prod-to-dev> [--dry-run] [--yes]

What it does:
- syncs required runtime public assets listed in runtime_public_assets_manifest.txt
- supports both directions: DEV->PROD and PROD->DEV
- verifies source exists and target hash matches source after sync

Examples:
  ./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod --dry-run
  ./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod --yes
  ./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction prod-to-dev --yes
USAGE
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes) ASSUME_YES=1 ;;
        -h|--help)
            usage
            exit 0
            ;;
        *) ;;
    esac
done

while [[ $# -gt 0 ]]; do
    case "$1" in
        --direction)
            DIRECTION="${2:-}"
            shift 2
            ;;
        --dry-run|--yes)
            shift
            ;;
        -h|--help)
            shift
            ;;
        *)
            fail "Unknown argument: $1"
            ;;
    esac
done

[[ -n "$DIRECTION" ]] || fail "Missing required argument: --direction <dev-to-prod|prod-to-dev>"
[[ "$DIRECTION" == "dev-to-prod" || "$DIRECTION" == "prod-to-dev" ]] || fail "Unsupported --direction: $DIRECTION"

[[ -d "$PROD_ROOT" ]] || fail "Missing PROD root: $PROD_ROOT"
[[ -d "$DEV_ROOT" ]] || fail "Missing DEV root: $DEV_ROOT"
[[ -f "$MANIFEST_FILE" ]] || fail "Missing manifest file: $MANIFEST_FILE"

require_command rsync
require_command sha256sum

if [[ "$DIRECTION" == "dev-to-prod" ]]; then
    SOURCE_ROOT="$DEV_ROOT"
    TARGET_ROOT="$PROD_ROOT"
else
    SOURCE_ROOT="$PROD_ROOT"
    TARGET_ROOT="$DEV_ROOT"
fi

readarray -t ASSETS < <(
    sed -E 's/#.*$//' "$MANIFEST_FILE" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | awk 'NF > 0'
)

[[ "${#ASSETS[@]}" -gt 0 ]] || fail "Manifest is empty: $MANIFEST_FILE"

for rel_path in "${ASSETS[@]}"; do
    [[ "$rel_path" == public/* ]] || fail "Invalid manifest path (must start with public/): $rel_path"
done

log "Direction: $DIRECTION"
log "Source: $SOURCE_ROOT"
log "Target: $TARGET_ROOT"

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN mode enabled"
else
    if [[ "$ASSUME_YES" != "1" ]]; then
        read -r -p "Type YES to continue: " answer
        [[ "$answer" == "YES" ]] || fail "Canceled by operator"
    fi
fi

SYNCED_COUNT=0
UNCHANGED_COUNT=0

for rel_path in "${ASSETS[@]}"; do
    src="$SOURCE_ROOT/$rel_path"
    dst="$TARGET_ROOT/$rel_path"

    [[ -f "$src" ]] || fail "Source asset missing: $src"

    src_hash="$(sha256sum "$src" | awk '{print $1}')"
    dst_hash_before=""
    if [[ -f "$dst" ]]; then
        dst_hash_before="$(sha256sum "$dst" | awk '{print $1}')"
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: rsync -a '$src' '$dst'"
        log "DRY-RUN: source hash=${src_hash} target-before=${dst_hash_before:-<missing>} path=${rel_path}"
        continue
    fi

    mkdir -p "$(dirname "$dst")"
    rsync -a "$src" "$dst"

    dst_hash_after="$(sha256sum "$dst" | awk '{print $1}')"
    [[ "$dst_hash_after" == "$src_hash" ]] || fail "Post-sync hash mismatch for $rel_path"

    if [[ -n "$dst_hash_before" && "$dst_hash_before" == "$src_hash" ]]; then
        (( UNCHANGED_COUNT++ )) || true
        log "OK (unchanged): $rel_path"
    else
        (( SYNCED_COUNT++ )) || true
        log "OK (synced): $rel_path"
    fi
done

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN complete. No changes applied."
    exit 0
fi

log "Sync complete: synced=${SYNCED_COUNT}, unchanged=${UNCHANGED_COUNT}, total=${#ASSETS[@]}"

#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"

usage() {
    cat <<'USAGE'
Usage:
  ./scripts/deploy/incident_tools.sh <command>

Commands:
  drift-git          Compare PROD local vs origin/main and DEV local vs origin/dev
  drift-runtime      Compare critical runtime asset hashes across PROD and DEV
  orphaned-nav       Show files in PROD nav media not present in DEV nav media
  broken-storage     Check common storage/public symlink and path integrity
  backup-validate    Run backup inventory list and inspect latest complete snapshot
USAGE
}

cmd="${1:-}"
[[ -n "$cmd" ]] || { usage; exit 1; }

case "$cmd" in
    drift-git)
        echo "[incident] Git drift analysis"
        git -C "$PROD_ROOT" fetch origin --quiet || true
        git -C "$DEV_ROOT" fetch origin --quiet || true
        echo ""
        echo "PROD:"
        git -C "$PROD_ROOT" status --short || true
        echo "ahead/behind origin/main:"
        git -C "$PROD_ROOT" rev-list --left-right --count HEAD...origin/main || true
        echo ""
        echo "DEV:"
        git -C "$DEV_ROOT" status --short || true
        echo "ahead/behind origin/dev:"
        git -C "$DEV_ROOT" rev-list --left-right --count HEAD...origin/dev || true
        ;;
    drift-runtime)
        echo "[incident] Runtime asset drift (manifest-based)"
        manifest="$PROD_ROOT/scripts/deploy/runtime_public_assets_manifest.txt"
        [[ -f "$manifest" ]] || { echo "Missing manifest: $manifest" >&2; exit 1; }
        while IFS= read -r line; do
            rel="$(sed -E 's/#.*$//' <<< "$line" | xargs)"
            [[ -n "$rel" ]] || continue
            prod_file="$PROD_ROOT/$rel"
            dev_file="$DEV_ROOT/$rel"
            if [[ ! -f "$prod_file" || ! -f "$dev_file" ]]; then
                echo "[MISSING] $rel"
                continue
            fi
            prod_hash="$(sha256sum "$prod_file" | awk '{print $1}')"
            dev_hash="$(sha256sum "$dev_file" | awk '{print $1}')"
            if [[ "$prod_hash" == "$dev_hash" ]]; then
                echo "[OK] $rel"
            else
                echo "[DRIFT] $rel"
            fi
        done < "$manifest"
        ;;
    orphaned-nav)
        echo "[incident] Orphaned PROD nav files"
        prod_nav="$PROD_ROOT/storage/app/public/nav"
        dev_nav="$DEV_ROOT/storage/app/public/nav"
        [[ -d "$prod_nav" ]] || { echo "Missing $prod_nav" >&2; exit 1; }
        [[ -d "$dev_nav" ]] || { echo "Missing $dev_nav" >&2; exit 1; }
        rsync -ani --delete "$dev_nav/" "$prod_nav/" 2>/dev/null | awk '/^\*deleting/ {print}' || true
        ;;
    broken-storage)
        echo "[incident] Storage linkage check"
        for root in "$PROD_ROOT" "$DEV_ROOT"; do
            echo "--- $root ---"
            if [[ -L "$root/public/storage" ]]; then
                echo "public/storage symlink: OK -> $(readlink "$root/public/storage")"
            else
                echo "public/storage symlink: BROKEN"
            fi
            [[ -d "$root/storage/app/public" ]] && echo "storage/app/public: OK" || echo "storage/app/public: MISSING"
            [[ -d "$root/storage/logs" ]] && echo "storage/logs: OK" || echo "storage/logs: MISSING"
        done
        ;;
    backup-validate)
        echo "[incident] Backup validation"
        "$SCRIPT_DIR/backup_inventory.sh" list
        latest="$(find "$PROD_ROOT/backups" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot' ! -name '*.incomplete' -printf '%T@|%f\n' | sort -t'|' -k1,1nr | head -n1 | cut -d'|' -f2)"
        if [[ -n "$latest" ]]; then
            echo ""
            "$SCRIPT_DIR/backup_inventory.sh" inspect "$latest"
        else
            echo "No completed backup found"
            exit 1
        fi
        ;;
    -h|--help)
        usage
        ;;
    *)
        usage
        exit 1
        ;;
esac

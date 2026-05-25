#!/usr/bin/env bash
# deploy.sh — KazUTB CRM unified deployment CLI
# Usage: ./scripts/deploy/deploy.sh <command> [options]
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_ROOT="/var/www/laravel-react"

_usage() {
    cat <<'EOF'
deploy.sh — KazUTB CRM deployment CLI

Usage:
  ./scripts/deploy/deploy.sh <command> [options]

Commands:
  safety
      Run all pre-deploy safety checks (24 PASS baseline).

  release [--dry-run] [--yes] [--no-migrate] [--skip-build]
          [--force-protected-delete]
      Release DEV→PROD: merge origin/dev into main, build, migrate, reload.
      --dry-run            Show what would change; no mutations.
      --yes                Skip interactive confirmation (deletions still blocked).
      --no-migrate         Skip php artisan migrate.
      --skip-build         Skip npm ci + npm run build.
      --force-protected-delete
                           Allow protected-path deletions (requires manual review).

  sync-runtime --type TYPE [--dry-run] [--yes]
      Sync runtime data/media DEV→PROD without touching code.
      --type navigation    Sync navigation_routes map_image_path/map_polyline
                           + storage/app/public/nav/ files.
      (future types: questionnaire-media, public-assets)

  prod-to-dev [--dry-run] [--yes] [--skip-db] [--skip-files]
              [--skip-build] [--skip-migrate] [--no-auto-recover]
              [--fix-dev-app-key]
      Refresh DEV from PROD: imports PROD DB dump, syncs files, rebuilds DEV.
      DEV .env is always preserved and never overwritten.

  rollback --tag TAG [--dry-run] [--yes]
      Rollback PROD code to a pre-deploy tag.
      List tags: git -C /var/www/laravel-react tag --list 'pre-deploy-*' --sort=-creatordate

  backup-prod [--dry-run]
      Create full PROD backup: DB dump + project tar.gz + SHA256SUMS.
      Uses .incomplete suffix during creation; renames to final only after validation.

  ssl-check
      Verify SSL certificate: file fingerprint matches live endpoint.

  help
      Show this help.

Standard post-release checklist:
  1.  ./scripts/deploy/deploy.sh safety
  2.  ./scripts/deploy/deploy.sh release --dry-run   # expect "no changes"
  3.  Merge main → dev on GitHub (keep branches in sync)
  4.  ./scripts/deploy/deploy.sh sync-runtime --type navigation  # if nav data changed

Legacy wrappers (still work, will print deprecation notice):
  deploy_dev_to_prod.sh   →  deploy.sh release
  refresh_dev_from_prod.sh →  deploy.sh prod-to-dev
EOF
}

CMD="${1:-help}"
shift 2>/dev/null || true

case "$CMD" in
    safety)
        exec "${SCRIPT_DIR}/check_deploy_safety.sh" "$@"
        ;;

    release)
        exec "${SCRIPT_DIR}/dev_to_prod_release.sh" "$@"
        ;;

    sync-runtime)
        SYNC_TYPE=""
        PASSTHROUGH=()
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --type)
                    SYNC_TYPE="${2:-}"
                    shift 2
                    ;;
                *)
                    PASSTHROUGH+=("$1")
                    shift
                    ;;
            esac
        done
        case "$SYNC_TYPE" in
            navigation)
                exec "${SCRIPT_DIR}/sync_navigation_media_to_prod.sh" \
                    "${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}"
                ;;
            "")
                echo "[deploy] ERROR: sync-runtime requires --type <type>" >&2
                echo "  Available types: navigation" >&2
                echo "  Future types (planned): questionnaire-media, public-assets" >&2
                exit 1
                ;;
            *)
                echo "[deploy] ERROR: Unknown sync-runtime type: '${SYNC_TYPE}'" >&2
                echo "  Available types: navigation" >&2
                echo "  Future types (planned): questionnaire-media, public-assets" >&2
                exit 1
                ;;
        esac
        ;;

    prod-to-dev)
        exec "${SCRIPT_DIR}/prod_to_dev_sync.sh" "$@"
        ;;

    rollback)
        ROLLBACK_TAG=""
        PASSTHROUGH=()
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --tag)
                    ROLLBACK_TAG="${2:-}"
                    shift 2
                    ;;
                *)
                    PASSTHROUGH+=("$1")
                    shift
                    ;;
            esac
        done
        if [[ -z "$ROLLBACK_TAG" ]]; then
            echo "[deploy] ERROR: rollback requires --tag TAG" >&2
            echo "  List tags: git -C /var/www/laravel-react tag --list 'pre-deploy-*' --sort=-creatordate" >&2
            exit 1
        fi
        exec "${SCRIPT_DIR}/rollback_prod_to_tag.sh" "$ROLLBACK_TAG" \
            "${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}"
        ;;

    backup-prod)
        DRY_RUN_FLAG=0
        PASSTHROUGH=()
        for a in "$@"; do
            [[ "$a" == "--dry-run" ]] && DRY_RUN_FLAG=1 || PASSTHROUGH+=("$a")
        done
        export BACKUP_DRY_RUN="$DRY_RUN_FLAG"
        exec "${PROD_ROOT}/scripts/backup_prod.sh" \
            "${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}"
        ;;

    ssl-check)
        exec "${SCRIPT_DIR}/ssl_guard_check.sh" "$@"
        ;;

    help|--help|-h)
        _usage
        ;;

    *)
        echo "[deploy] ERROR: Unknown command: '${CMD}'" >&2
        echo "  Run '${SCRIPT_DIR}/deploy.sh help' for usage." >&2
        exit 1
        ;;
esac

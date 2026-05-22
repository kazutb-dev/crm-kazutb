#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="/var/www/laravel-react"
BACKUP_SCRIPT="${PROJECT_ROOT}/scripts/backup_prod.sh"
DRY_RUN=0
ASSUME_YES=0

usage() {
    cat <<'EOF'
Usage:
  ./scripts/deploy/rollback_prod_to_tag.sh <tag> [--dry-run] [--yes]
EOF
}

if [[ "$#" -lt 1 ]]; then
    usage
    exit 1
fi

TARGET_TAG="$1"
shift || true

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes) ASSUME_YES=1 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "[rollback] ERROR: Unknown argument: $arg" >&2; exit 1 ;;
    esac
done

log() {
    echo "[rollback] $*"
}

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $*"
    else
        eval "$@"
    fi
}

[[ -d "$PROJECT_ROOT" ]] || { echo "[rollback] ERROR: Project root not found: $PROJECT_ROOT" >&2; exit 1; }
[[ -f "$BACKUP_SCRIPT" ]] || { echo "[rollback] ERROR: backup script missing: $BACKUP_SCRIPT" >&2; exit 1; }

cd "$PROJECT_ROOT"

git rev-parse "$TARGET_TAG" >/dev/null 2>&1 || { echo "[rollback] ERROR: Tag not found: $TARGET_TAG" >&2; exit 1; }

if [[ "$ASSUME_YES" != "1" && "$DRY_RUN" != "1" ]]; then
    log "Rollback will reset PROD code to tag: $TARGET_TAG"
    log "Use --yes to confirm non-interactively."
    exit 1
fi

if [[ "$DRY_RUN" == "1" ]]; then
    emergency_backup_dir="${PROJECT_ROOT}/backups/prod_backup_DRYRUN_emergency"
    log "DRY-RUN: would run emergency backup via ${BACKUP_SCRIPT}"
else
    "$BACKUP_SCRIPT"
    emergency_backup_dir="$(ls -1dt "${PROJECT_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"
fi

run_cmd "git reset --hard '$TARGET_TAG'"
run_cmd "composer install --no-dev --optimize-autoloader"

if [[ -f "${PROJECT_ROOT}/package-lock.json" ]]; then
    run_cmd "npm ci"
else
    run_cmd "npm install"
fi
run_cmd "npm run build"

run_cmd "php artisan optimize:clear"
run_cmd "php artisan config:cache"
run_cmd "php artisan route:cache"
run_cmd "php artisan view:cache"
run_cmd "php artisan queue:restart"
run_cmd "sudo systemctl reload php8.3-fpm || true"
run_cmd "sudo systemctl reload nginx || true"

report_dir="${PROJECT_ROOT}/storage/app/deploy_reports"
report_file="${report_dir}/rollback_$(date +%Y%m%d_%H%M%S).txt"
run_cmd "mkdir -p '$report_dir'"

if [[ "$DRY_RUN" != "1" ]]; then
    {
        echo "timestamp=$(date -Iseconds)"
        echo "tag_restored=${TARGET_TAG}"
        echo "emergency_backup_dir=${emergency_backup_dir}"
        echo "db_rollback=manual_only"
        echo "note=Database rollback is intentionally NOT automatic to avoid losing post-deploy user data."
    } > "$report_file"
fi

echo "Rollback flow completed."
echo "Tag restored: $TARGET_TAG"
echo "Emergency backup: $emergency_backup_dir"
echo "DB rollback: manual only (from backup if required)."
if [[ "$DRY_RUN" != "1" ]]; then
    echo "Report: $report_file"
fi

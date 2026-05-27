#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="[prod->dev]"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib_deploy_common.sh"

begin_operation_lock "prod-to-dev-sync"
trap 'end_operation_lock' EXIT

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
BACKUP_SCRIPT="${PROD_ROOT}/scripts/backup_prod.sh"

DRY_RUN=0
ASSUME_YES=0
SKIP_DB=0
SKIP_FILES=0
SKIP_BUILD=0
SKIP_MIGRATE=0
NO_AUTO_RECOVER=0
FIX_DEV_APP_KEY=0
RISK_SCORE=0

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes) ASSUME_YES=1 ;;
        --skip-db) SKIP_DB=1 ;;
        --skip-files) SKIP_FILES=1 ;;
        --skip-build) SKIP_BUILD=1 ;;
        --skip-migrate) SKIP_MIGRATE=1 ;;
        --no-auto-recover) NO_AUTO_RECOVER=1 ;;
        --fix-dev-app-key) FIX_DEV_APP_KEY=1 ;;
        -h|--help)
            cat <<USAGE
Usage:
  ${PROD_ROOT}/scripts/deploy/prod_to_dev_sync.sh [--dry-run] [--yes] [--skip-db] [--skip-files] [--skip-build] [--skip-migrate] [--no-auto-recover] [--fix-dev-app-key]
USAGE
            exit 0
            ;;
        *) fail "Unknown argument: $arg" ;;
    esac
done

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $*"
    else
        eval "$@"
    fi
}

require_paths() {
    [[ -d "$PROD_ROOT" ]] || fail "PROD root missing: $PROD_ROOT"
    [[ -d "$DEV_ROOT" ]] || fail "DEV root missing: $DEV_ROOT"
    [[ -f "$BACKUP_SCRIPT" ]] || fail "Backup script missing: $BACKUP_SCRIPT"
    [[ -x "$BACKUP_SCRIPT" ]] || fail "Backup script is not executable: $BACKUP_SCRIPT"
}

check_branch_state() {
    git -C "$PROD_ROOT" fetch origin --quiet
    git -C "$DEV_ROOT" fetch origin --quiet

    local prod_branch dev_branch
    prod_branch="$(git -C "$PROD_ROOT" branch --show-current)"
    dev_branch="$(git -C "$DEV_ROOT" branch --show-current)"

    [[ "$prod_branch" == "main" ]] || fail "PROD must be on main (got $prod_branch)"
    [[ "$dev_branch" == "dev" ]] || fail "DEV must be on dev (got $dev_branch)"
}

checkpoint_prod_if_dirty() {
    local prod_status
    prod_status="$(git -C "$PROD_ROOT" status --short || true)"
    if [[ -z "$prod_status" ]]; then
        return 0
    fi

    [[ "$DRY_RUN" == "1" ]] && { log "DRY-RUN: PROD dirty -> would checkpoint with safecommit and push origin main"; return 0; }

    local safecommit_script="${PROD_ROOT}/scripts/deploy/safecommit.sh"
    [[ -x "$safecommit_script" ]] || fail "safecommit missing or not executable: $safecommit_script"

    if [[ "$ASSUME_YES" != "1" ]]; then
        fail "PROD has uncommitted changes. Re-run with --yes to checkpoint automatically."
    fi

    (cd "$PROD_ROOT" && "$safecommit_script" "chore(prod): checkpoint direct changes before prod->dev sync")
    (cd "$PROD_ROOT" && git push origin main)
}

TIMESTAMP="$(current_ts)"
DEV_BACKUP_DIR="${DEV_ROOT}/backups/dev_before_prod_sync_${TIMESTAMP}"
PROD_BACKUP_DIR=""
CHECKPOINT_BRANCH="safety/dev-before-prod-sync-${TIMESTAMP}"
CHECKPOINT_TAG="dev-before-prod-sync-${TIMESTAMP}"
RESTORE_FROM_CHECKPOINT=0

on_error() {
    local ec=$?
    warn "Sync failed (exit=$ec)"
    if [[ "$DRY_RUN" == "0" ]]; then
        print_recovery_instructions "$CHECKPOINT_BRANCH" "$CHECKPOINT_TAG" "$DEV_BACKUP_DIR"
        if [[ "$RESTORE_FROM_CHECKPOINT" == "1" && "$NO_AUTO_RECOVER" == "0" ]]; then
            warn "Auto-recovering local DEV branch to checkpoint"
            git -C "$DEV_ROOT" checkout dev || true
            git -C "$DEV_ROOT" reset --hard "$CHECKPOINT_BRANCH" || true
        fi
    fi
    exit "$ec"
}
trap on_error ERR

require_paths
check_branch_state
checkpoint_prod_if_dirty

if [[ "$SKIP_DB" == "0" ]]; then
    RISK_SCORE=$((RISK_SCORE + 5))
fi
if [[ "$SKIP_FILES" == "0" ]]; then
    RISK_SCORE=$((RISK_SCORE + 4))
fi
if [[ "$SKIP_BUILD" == "0" ]]; then
    RISK_SCORE=$((RISK_SCORE + 1))
fi

if [[ "$DRY_RUN" != "1" && "$ASSUME_YES" != "1" ]]; then
    echo "[prod->dev] RISK SCORE: ${RISK_SCORE}/10"
    echo "[prod->dev] This operation can destructively overwrite DEV code/database/runtime files."
    read -r -p "Type REFRESH-DEV-DESTRUCTIVE to continue: " typed
    [[ "$typed" == "REFRESH-DEV-DESTRUCTIVE" ]] || fail "Canceled by operator"
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would create DEV checkpoint branch/tag and push both"
else
    git -C "$DEV_ROOT" branch "$CHECKPOINT_BRANCH"
    git -C "$DEV_ROOT" tag "$CHECKPOINT_TAG"
    git -C "$DEV_ROOT" push origin "$CHECKPOINT_BRANCH"
    git -C "$DEV_ROOT" push origin "$CHECKPOINT_TAG"
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would back up DEV DB/storage/.env into $DEV_BACKUP_DIR"
else
    mkdir -p "$DEV_BACKUP_DIR"
    backup_env_file "$DEV_ROOT" "$DEV_BACKUP_DIR/env.backup"
    (cd "$DEV_ROOT" && git status --short > "$DEV_BACKUP_DIR/git_status.txt")
    (cd "$DEV_ROOT" && git rev-parse HEAD > "$DEV_BACKUP_DIR/git_head.txt")
    (cd "$DEV_ROOT" && php artisan migrate:status > "$DEV_BACKUP_DIR/migrate_status.txt" || true)

    DEV_DB_CONNECTION="$(grep -E '^DB_CONNECTION=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
    DEV_DB_HOST="$(grep -E '^DB_HOST=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
    DEV_DB_PORT="$(grep -E '^DB_PORT=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
    DEV_DB_DATABASE="$(grep -E '^DB_DATABASE=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
    DEV_DB_USERNAME="$(grep -E '^DB_USERNAME=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
    DEV_DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"

    if [[ "${DEV_DB_CONNECTION:-mysql}" == "sqlite" ]]; then
        DEV_SQLITE_PATH="$DEV_DB_DATABASE"
        [[ "$DEV_SQLITE_PATH" == /* ]] || DEV_SQLITE_PATH="$DEV_ROOT/$DEV_SQLITE_PATH"
        cp "$DEV_SQLITE_PATH" "$DEV_BACKUP_DIR/database_before_sync.sqlite"
        gzip -f "$DEV_BACKUP_DIR/database_before_sync.sqlite"
    else
        MYSQL_PWD="$DEV_DB_PASSWORD" mysqldump --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --no-tablespaces -h"$DEV_DB_HOST" -P"$DEV_DB_PORT" -u"$DEV_DB_USERNAME" "$DEV_DB_DATABASE" | gzip -c > "$DEV_BACKUP_DIR/database_before_sync.sql.gz"
    fi

    tar -czf "$DEV_BACKUP_DIR/storage_public_before_sync.tar.gz" -C "$DEV_ROOT" storage public
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would run PROD backup script and verify db/project_data artifacts"
    PROD_BACKUP_DIR="${PROD_ROOT}/backups/prod_backup_DRYRUN_full_snapshot"
else
    BACKUP_KEEP_COUNT=1 "$BACKUP_SCRIPT"
    PROD_BACKUP_DIR="$(ls -1dt "${PROD_ROOT}"/backups/prod_backup_*_full_snapshot | head -n1)"
    [[ -n "$PROD_BACKUP_DIR" ]] || fail "Unable to locate PROD backup dir"
    ls -1 "$PROD_BACKUP_DIR"/database_*.sql.gz >/dev/null
    ls -1 "$PROD_BACKUP_DIR"/project_data_*.tar.gz >/dev/null
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would reset local DEV to origin/main then restore .env and permissions"
else
    cp "$DEV_ROOT/.env" "/tmp/laravel-react-dev-env-${TIMESTAMP}.tmp"
    git -C "$DEV_ROOT" fetch origin --quiet
    git -C "$DEV_ROOT" checkout dev
    git -C "$DEV_ROOT" reset --hard origin/main
    RESTORE_FROM_CHECKPOINT=1
    cp "/tmp/laravel-react-dev-env-${TIMESTAMP}.tmp" "$DEV_ROOT/.env"
    chgrp www-data "$DEV_ROOT/.env" || true
    chmod 640 "$DEV_ROOT/.env"

    if ! grep -E '^APP_KEY=' "$DEV_ROOT/.env" >/dev/null 2>&1 || [[ -z "$(grep -E '^APP_KEY=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)" ]]; then
        if [[ "$FIX_DEV_APP_KEY" == "1" ]]; then
            (cd "$DEV_ROOT" && php artisan key:generate --force)
        else
            fail "APP_KEY missing in DEV .env. Fix manually or re-run with --fix-dev-app-key"
        fi
    fi

    check_env_key_readable_by_www_data "$DEV_ROOT"
fi

if [[ "$SKIP_DB" == "0" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would restore DEV DB from latest PROD backup using DEV DB credentials"
    else
        PROD_DB_FILE="$(ls -1 "$PROD_BACKUP_DIR"/database_*.sql.gz | head -n1)"
        DEV_DB_CONNECTION="$(grep -E '^DB_CONNECTION=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
        DEV_DB_HOST="$(grep -E '^DB_HOST=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
        DEV_DB_PORT="$(grep -E '^DB_PORT=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
        DEV_DB_DATABASE="$(grep -E '^DB_DATABASE=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
        DEV_DB_USERNAME="$(grep -E '^DB_USERNAME=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"
        DEV_DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$DEV_ROOT/.env" | tail -n1 | cut -d= -f2-)"

        if [[ "${DEV_DB_CONNECTION:-mysql}" == "sqlite" ]]; then
            DEV_SQLITE_PATH="$DEV_DB_DATABASE"
            [[ "$DEV_SQLITE_PATH" == /* ]] || DEV_SQLITE_PATH="$DEV_ROOT/$DEV_SQLITE_PATH"
            gunzip -c "$PROD_DB_FILE" > "$DEV_SQLITE_PATH"
        else
            gunzip -c "$PROD_DB_FILE" | MYSQL_PWD="$DEV_DB_PASSWORD" mysql -h"$DEV_DB_HOST" -P"$DEV_DB_PORT" -u"$DEV_DB_USERNAME" "$DEV_DB_DATABASE"
        fi

        if [[ "$SKIP_MIGRATE" == "0" ]]; then
            (cd "$DEV_ROOT" && php artisan migrate --force)
        fi
    fi
fi

if [[ "$SKIP_FILES" == "0" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would restore runtime files from PROD project_data backup via temp extract"
    else
        PROD_DATA_FILE="$(ls -1 "$PROD_BACKUP_DIR"/project_data_*.tar.gz | head -n1)"
        TMP_EXTRACT_DIR="$DEV_ROOT/backups/tmp_extract_${TIMESTAMP}"
        mkdir -p "$TMP_EXTRACT_DIR"
        tar -xzf "$PROD_DATA_FILE" -C "$TMP_EXTRACT_DIR"

        # Copy only runtime-safe directories to avoid destructive overwrite.
        if [[ -d "$TMP_EXTRACT_DIR/storage" ]]; then
            rm -rf "$DEV_ROOT/storage"
            cp -a "$TMP_EXTRACT_DIR/storage" "$DEV_ROOT/storage"
        fi
        if [[ -d "$TMP_EXTRACT_DIR/public" ]]; then
            mkdir -p "$DEV_ROOT/public"
            for p in uploads storage; do
                [[ -e "$TMP_EXTRACT_DIR/public/$p" ]] && cp -a "$TMP_EXTRACT_DIR/public/$p" "$DEV_ROOT/public/" || true
            done
        fi

        rm -rf "$TMP_EXTRACT_DIR"

        chgrp -R www-data "$DEV_ROOT/storage" "$DEV_ROOT/bootstrap/cache" || true
        chmod -R ug+rwX "$DEV_ROOT/storage" "$DEV_ROOT/bootstrap/cache" || true
    fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would run composer install, npm ci/build, optimize:clear, about, and health checks"
else
    (cd "$DEV_ROOT" && composer install)
    if [[ "$SKIP_BUILD" == "0" ]]; then
        if [[ -f "$DEV_ROOT/package-lock.json" ]]; then
            (cd "$DEV_ROOT" && npm ci)
        else
            (cd "$DEV_ROOT" && npm install)
        fi
        (cd "$DEV_ROOT" && npm run build)
    fi

    (cd "$DEV_ROOT" && php artisan optimize:clear)
    check_laravel_health "$DEV_ROOT"
    check_storage_permissions "$DEV_ROOT"
    if [[ "$SKIP_BUILD" == "0" ]]; then
        check_public_build "$DEV_ROOT"
    fi

    dev_http_code="$(curl -s -o /dev/null -w '%{http_code}' https://dev-crm.kaztbu.edu.kz/)"
    dev_profile_code="$(curl -s -o /dev/null -w '%{http_code}' https://dev-crm.kaztbu.edu.kz/profile)"

    [[ "$dev_http_code" != "500" ]] || fail "DEV health check failed: / returned 500"
    [[ "$dev_profile_code" != "500" ]] || fail "DEV health check failed: /profile returned 500"
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "Dry-run completed. No changes were made."
    exit 0
fi

# Push only after all checks passed.
git -C "$DEV_ROOT" checkout dev
git -C "$DEV_ROOT" add -A
if [[ -n "$(git -C "$DEV_ROOT" status --short)" ]]; then
    git -C "$DEV_ROOT" commit -m "sync(dev): refresh from production main"
fi
git -C "$DEV_ROOT" push origin dev
RESTORE_FROM_CHECKPOINT=0

log "PROD->DEV sync completed successfully"
log "PROD backup used: ${PROD_BACKUP_DIR}"
log "DEV backup created: ${DEV_BACKUP_DIR}"
log "DEV checkpoint branch/tag: ${CHECKPOINT_BRANCH} / ${CHECKPOINT_TAG}"

if [[ "$DRY_RUN" != "1" ]]; then
        report_dir="${PROD_ROOT}/storage/app/deploy_reports"
        mkdir -p "$report_dir"
        report_file="${report_dir}/prod_to_dev_sync_${TIMESTAMP}.json"
        cat > "$report_file" <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "operation": "prod-to-dev",
    "risk_score": ${RISK_SCORE},
    "prod_backup_dir": "${PROD_BACKUP_DIR}",
    "dev_backup_dir": "${DEV_BACKUP_DIR}",
    "checkpoint_branch": "${CHECKPOINT_BRANCH}",
    "checkpoint_tag": "${CHECKPOINT_TAG}",
    "skip_db": ${SKIP_DB},
    "skip_files": ${SKIP_FILES},
    "skip_build": ${SKIP_BUILD},
    "skip_migrate": ${SKIP_MIGRATE}
}
EOF
        log "Journal: ${report_file}"
fi

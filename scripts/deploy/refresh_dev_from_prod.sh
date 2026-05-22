#!/usr/bin/env bash
set -Eeuo pipefail

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
PROD_BACKUP_SCRIPT="${PROD_ROOT}/scripts/backup_prod.sh"
DRY_RUN=0
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            cat <<'EOF'
Usage:
  /var/www/laravel-react/scripts/deploy/refresh_dev_from_prod.sh [--dry-run]
EOF
            exit 0
            ;;
        *)
            echo "[refresh] ERROR: Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

log() {
    echo "[refresh] $*"
}

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $*"
    else
        eval "$@"
    fi
}

env_value() {
    local key="$1"
    local env_file="$2"
    local raw
    raw="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
    raw="${raw#*=}"
    raw="${raw%$'\r'}"
    if [[ "$raw" == '"'*'"' ]]; then
        raw="${raw:1:${#raw}-2}"
    elif [[ "$raw" == "'"*"'" ]]; then
        raw="${raw:1:${#raw}-2}"
    fi
    printf '%s' "$raw"
}

[[ -d "$PROD_ROOT" ]] || { echo "[refresh] ERROR: PROD root missing: $PROD_ROOT" >&2; exit 1; }
[[ -d "$DEV_ROOT" ]] || { echo "[refresh] ERROR: DEV root missing: $DEV_ROOT" >&2; exit 1; }
[[ -f "$PROD_BACKUP_SCRIPT" ]] || { echo "[refresh] ERROR: PROD backup script missing: $PROD_BACKUP_SCRIPT" >&2; exit 1; }

prod_backup_dir=""
if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would create fresh PROD backup via ${PROD_BACKUP_SCRIPT}"
    prod_backup_dir="${PROD_ROOT}/backups/prod_backup_DRYRUN_full_snapshot"
else
    "$PROD_BACKUP_SCRIPT"
    prod_backup_dir="$(ls -1dt "${PROD_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"
    [[ -n "$prod_backup_dir" ]] || { echo "[refresh] ERROR: Cannot locate latest PROD backup dir" >&2; exit 1; }
fi

if [[ "$DRY_RUN" != "1" ]]; then
    prod_db_file="$(ls -1 "$prod_backup_dir"/database_*.sql.gz 2>/dev/null | head -n1 || true)"
    prod_project_file="$(ls -1 "$prod_backup_dir"/project_data_*.tar.gz 2>/dev/null | head -n1 || true)"
    [[ -n "$prod_db_file" && -f "$prod_db_file" ]] || { echo "[refresh] ERROR: PROD database backup not found" >&2; exit 1; }
    [[ -n "$prod_project_file" && -f "$prod_project_file" ]] || { echo "[refresh] ERROR: PROD project_data archive not found" >&2; exit 1; }
    gzip -t "$prod_db_file"
    tar -tzf "$prod_project_file" >/dev/null
fi

dev_backup_dir="${DEV_ROOT}/backups/dev_backup_${TIMESTAMP}_before_refresh"
run_cmd "mkdir -p '$dev_backup_dir'"

# Backup DEV .env
run_cmd "cp '${DEV_ROOT}/.env' '${dev_backup_dir}/env_${TIMESTAMP}.backup'"
run_cmd "chmod 600 '${dev_backup_dir}/env_${TIMESTAMP}.backup'"

# Backup DEV DB (minimal)
dev_env="${DEV_ROOT}/.env"
dev_db_connection="$(env_value DB_CONNECTION "$dev_env")"
dev_db_host="$(env_value DB_HOST "$dev_env")"
dev_db_port="$(env_value DB_PORT "$dev_env")"
dev_db_database="$(env_value DB_DATABASE "$dev_env")"
dev_db_username="$(env_value DB_USERNAME "$dev_env")"
dev_db_password="$(env_value DB_PASSWORD "$dev_env")"

if [[ "${dev_db_connection:-mysql}" == "sqlite" ]]; then
    dev_sqlite_path="$dev_db_database"
    [[ "$dev_sqlite_path" == /* ]] || dev_sqlite_path="${DEV_ROOT}/${dev_sqlite_path}"
    run_cmd "cp '$dev_sqlite_path' '${dev_backup_dir}/database_${TIMESTAMP}.sqlite'"
    run_cmd "gzip -f '${dev_backup_dir}/database_${TIMESTAMP}.sqlite'"
else
    run_cmd "MYSQL_PWD='${dev_db_password}' mysqldump --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --no-tablespaces -h'${dev_db_host}' -P'${dev_db_port}' -u'${dev_db_username}' '${dev_db_database}' | gzip -c > '${dev_backup_dir}/database_${TIMESTAMP}.sql.gz'"
fi

# Backup DEV storage/public
run_cmd "tar -czf '${dev_backup_dir}/dev_files_${TIMESTAMP}.tar.gz' -C '${DEV_ROOT}' storage public"

stash_ref="no"
cd "$DEV_ROOT"
dev_status="$(git status --short)"
if [[ -n "$dev_status" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would stash DEV changes before reset."
        stash_ref="dry-run-stash"
    else
        git stash push -u -m "auto-stash-before-prod-refresh-${TIMESTAMP}"
        stash_ref="$(git stash list | head -n1 | cut -d: -f1)"
    fi
fi

run_cmd "git fetch origin"
run_cmd "git checkout main"
run_cmd "git reset --hard origin/main"

tmp_dev_env="/tmp/dev_env_${TIMESTAMP}"
run_cmd "cp '${DEV_ROOT}/.env' '${tmp_dev_env}'"

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would restore DEV DB from ${prod_backup_dir}/database_*.sql.gz using DEV DB settings"
else
    prod_db_file="$(ls -1 "$prod_backup_dir"/database_*.sql.gz 2>/dev/null | head -n1 || true)"
    [[ -n "$prod_db_file" && -f "$prod_db_file" ]] || { echo "[refresh] ERROR: PROD DB backup file missing" >&2; exit 1; }

    if [[ "${dev_db_connection:-mysql}" == "sqlite" ]]; then
        dev_sqlite_path="$dev_db_database"
        [[ "$dev_sqlite_path" == /* ]] || dev_sqlite_path="${DEV_ROOT}/${dev_sqlite_path}"
        gunzip -c "$prod_db_file" > "$dev_sqlite_path"
    else
        gunzip -c "$prod_db_file" | MYSQL_PWD="$dev_db_password" mysql -h"$dev_db_host" -P"$dev_db_port" -u"$dev_db_username" "$dev_db_database"
    fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would extract PROD project_data archive into DEV root and restore DEV .env"
else
    prod_project_file="$(ls -1 "$prod_backup_dir"/project_data_*.tar.gz 2>/dev/null | head -n1 || true)"
    [[ -n "$prod_project_file" && -f "$prod_project_file" ]] || { echo "[refresh] ERROR: PROD project archive missing" >&2; exit 1; }

    tar -xzf "$prod_project_file" -C "$DEV_ROOT"
    cp "$tmp_dev_env" "${DEV_ROOT}/.env"
    chmod 600 "${DEV_ROOT}/.env" || true

    chmod -R ug+rwX "${DEV_ROOT}/storage" "${DEV_ROOT}/bootstrap/cache" || true
fi

cd "$DEV_ROOT"
run_cmd "composer install"
if [[ -f "${DEV_ROOT}/package-lock.json" ]]; then
    run_cmd "npm ci"
else
    run_cmd "npm install"
fi
run_cmd "npm run build"
run_cmd "php artisan optimize:clear"
run_cmd "php artisan migrate --force"
run_cmd "php artisan storage:link || true"

echo
echo "Refresh DEV from PROD completed."
echo "PROD backup used: ${prod_backup_dir}"
echo "DEV backup created: ${dev_backup_dir}"
echo "DEV DB restored from PROD: yes"
echo "DEV .env preserved: yes"
echo "stash created: ${stash_ref}"
echo "DEV HEAD: $(git -C "$DEV_ROOT" rev-parse --short HEAD)"
echo "Next: cd ${DEV_ROOT} && php artisan about"

#!/usr/bin/env bash
set -Eeuo pipefail

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
BACKUP_SCRIPT="${PROD_ROOT}/scripts/backup_prod.sh"
ENSURE_DEV_BRANCH_SCRIPT="${PROD_ROOT}/scripts/deploy/ensure_dev_branch.sh"
SAFECOMMIT_SCRIPT="${PROD_ROOT}/scripts/deploy/safecommit.sh"
DRY_RUN=0
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            cat <<'EOF'
Usage:
  /var/www/laravel-react/scripts/deploy/prod_to_dev_sync.sh [--dry-run]
EOF
            exit 0
            ;;
        *)
            echo "[prod->dev] ERROR: Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

log() {
    echo "[prod->dev] $*"
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

[[ -d "$PROD_ROOT" ]] || { echo "[prod->dev] ERROR: PROD root missing" >&2; exit 1; }
[[ -d "$DEV_ROOT" ]] || { echo "[prod->dev] ERROR: DEV root missing" >&2; exit 1; }
[[ -f "$BACKUP_SCRIPT" ]] || { echo "[prod->dev] ERROR: backup script missing" >&2; exit 1; }
[[ -f "$ENSURE_DEV_BRANCH_SCRIPT" ]] || { echo "[prod->dev] ERROR: ensure_dev_branch script missing" >&2; exit 1; }

# A. PROD checks + checkpoint + backup
cd "$PROD_ROOT"
[[ "$(pwd)" == "$PROD_ROOT" ]] || { echo "[prod->dev] ERROR: wrong PROD path" >&2; exit 1; }
[[ "$(git branch --show-current)" == "main" ]] || { echo "[prod->dev] ERROR: PROD must be on main" >&2; exit 1; }

git remote get-url origin >/dev/null 2>&1 || { echo "[prod->dev] ERROR: PROD origin missing" >&2; exit 1; }

if [[ -n "$(git status --short)" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would safecommit dirty PROD changes and push main"
    else
        if [[ ! -x "$SAFECOMMIT_SCRIPT" ]]; then
            echo "[prod->dev] ERROR: safecommit wrapper missing or not executable: $SAFECOMMIT_SCRIPT" >&2
            exit 1
        fi
        "$SAFECOMMIT_SCRIPT" "chore(prod): checkpoint direct production changes before dev sync"
        git push origin main
    fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
    prod_backup_dir="${PROD_ROOT}/backups/prod_backup_DRYRUN_full_snapshot"
    prod_db_file="${prod_backup_dir}/database_DRYRUN.sql.gz"
    prod_data_file="${prod_backup_dir}/project_data_DRYRUN.tar.gz"
else
    BACKUP_KEEP_COUNT=2 "$BACKUP_SCRIPT"
    prod_backup_dir="$(ls -1dt "${PROD_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"
    [[ -n "$prod_backup_dir" ]] || { echo "[prod->dev] ERROR: PROD backup not found" >&2; exit 1; }
    prod_db_file="$(ls -1 "$prod_backup_dir"/database_*.sql.gz 2>/dev/null | head -n1 || true)"
    prod_data_file="$(ls -1 "$prod_backup_dir"/project_data_*.tar.gz 2>/dev/null | head -n1 || true)"
    [[ -n "$prod_db_file" && -f "$prod_db_file" ]] || { echo "[prod->dev] ERROR: PROD DB dump missing" >&2; exit 1; }
    [[ -n "$prod_data_file" && -f "$prod_data_file" ]] || { echo "[prod->dev] ERROR: PROD project_data archive missing" >&2; exit 1; }
    gzip -t "$prod_db_file"
    tar -tzf "$prod_data_file" >/dev/null
fi

# B. DEV branch + checkpoint + backup
run_cmd "'${ENSURE_DEV_BRANCH_SCRIPT}' $([[ "$DRY_RUN" == "1" ]] && echo --dry-run || true)"

cd "$DEV_ROOT"
[[ "$(pwd)" == "$DEV_ROOT" ]] || { echo "[prod->dev] ERROR: wrong DEV path" >&2; exit 1; }
[[ "$(git branch --show-current)" == "dev" ]] || { echo "[prod->dev] ERROR: DEV must be on dev branch" >&2; exit 1; }

dev_checkpoint_tag=""
if [[ -n "$(git status --short)" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would checkpoint dirty DEV changes and push dev"
        dev_checkpoint_tag="dev-checkpoint-${TIMESTAMP}"
    else
        if [[ ! -x "$SAFECOMMIT_SCRIPT" ]]; then
            echo "[prod->dev] ERROR: safecommit wrapper missing or not executable: $SAFECOMMIT_SCRIPT" >&2
            exit 1
        fi
        "$SAFECOMMIT_SCRIPT" "chore(dev): checkpoint local dev changes before prod sync"
        dev_checkpoint_tag="dev-checkpoint-${TIMESTAMP}"
        git tag "$dev_checkpoint_tag"
        git push origin dev
        git push origin "$dev_checkpoint_tag"
    fi
fi

dev_env_file="${DEV_ROOT}/.env"
tmp_dev_env="/tmp/laravel-react-dev-env-${TIMESTAMP}"
run_cmd "cp '${dev_env_file}' '${tmp_dev_env}'"

# DEV backup
DEV_BACKUP_DIR="${DEV_ROOT}/backups/dev_backup_${TIMESTAMP}_before_prod_sync"
run_cmd "mkdir -p '${DEV_BACKUP_DIR}'"
run_cmd "cp '${dev_env_file}' '${DEV_BACKUP_DIR}/env_${TIMESTAMP}.backup'"
run_cmd "chmod 600 '${DEV_BACKUP_DIR}/env_${TIMESTAMP}.backup'"

DEV_DB_CONNECTION="$(env_value DB_CONNECTION "$dev_env_file")"
DEV_DB_HOST="$(env_value DB_HOST "$dev_env_file")"
DEV_DB_PORT="$(env_value DB_PORT "$dev_env_file")"
DEV_DB_DATABASE="$(env_value DB_DATABASE "$dev_env_file")"
DEV_DB_USERNAME="$(env_value DB_USERNAME "$dev_env_file")"
DEV_DB_PASSWORD="$(env_value DB_PASSWORD "$dev_env_file")"

if [[ "${DEV_DB_CONNECTION:-mysql}" == "sqlite" ]]; then
    DEV_SQLITE_PATH="$DEV_DB_DATABASE"
    [[ "$DEV_SQLITE_PATH" == /* ]] || DEV_SQLITE_PATH="${DEV_ROOT}/${DEV_SQLITE_PATH}"
    run_cmd "cp '${DEV_SQLITE_PATH}' '${DEV_BACKUP_DIR}/database_${TIMESTAMP}.sqlite'"
    run_cmd "gzip -f '${DEV_BACKUP_DIR}/database_${TIMESTAMP}.sqlite'"
else
    run_cmd "MYSQL_PWD='${DEV_DB_PASSWORD}' mysqldump --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --no-tablespaces -h'${DEV_DB_HOST}' -P'${DEV_DB_PORT}' -u'${DEV_DB_USERNAME}' '${DEV_DB_DATABASE}' | gzip -c > '${DEV_BACKUP_DIR}/database_${TIMESTAMP}.sql.gz'"
fi
run_cmd "tar -czf '${DEV_BACKUP_DIR}/storage_public_${TIMESTAMP}.tar.gz' -C '${DEV_ROOT}' storage public"

# Move DEV code to PROD main state through git
run_cmd "git fetch origin"
run_cmd "git checkout dev"
run_cmd "git reset --hard origin/main"
run_cmd "git checkout -B dev"
run_cmd "git push -f origin dev"

# Restore DEV env
run_cmd "cp '${tmp_dev_env}' '${dev_env_file}'"
run_cmd "chmod 600 '${dev_env_file}'"

# Restore DEV DB from PROD dump using DEV credentials
if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would restore DEV DB from PROD dump (${prod_db_file})"
else
    if [[ "${DEV_DB_CONNECTION:-mysql}" == "sqlite" ]]; then
        DEV_SQLITE_PATH="$DEV_DB_DATABASE"
        [[ "$DEV_SQLITE_PATH" == /* ]] || DEV_SQLITE_PATH="${DEV_ROOT}/${DEV_SQLITE_PATH}"
        gunzip -c "$prod_db_file" > "$DEV_SQLITE_PATH"
    else
        gunzip -c "$prod_db_file" | MYSQL_PWD="$DEV_DB_PASSWORD" mysql -h"$DEV_DB_HOST" -P"$DEV_DB_PORT" -u"$DEV_DB_USERNAME" "$DEV_DB_DATABASE"
    fi
fi

# Restore project data from PROD backup, then restore DEV env again
if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would extract PROD project_data archive into DEV root"
else
    tar -xzf "$prod_data_file" -C "$DEV_ROOT"
    cp "$tmp_dev_env" "$dev_env_file"
    chmod 600 "$dev_env_file"
    chmod -R ug+rwX "${DEV_ROOT}/storage" "${DEV_ROOT}/bootstrap/cache" || true
fi

# DEV post-refresh
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

cat <<EOF

PROD -> DEV sync completed.
PROD backup used: ${prod_backup_dir}
DEV backup created: ${DEV_BACKUP_DIR}
DEV checkpoint tag: ${dev_checkpoint_tag:-none}
DEV DB restored from PROD: yes
DEV .env preserved: yes
DEV branch pushed: dev
EOF

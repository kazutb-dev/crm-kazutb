#!/usr/bin/env bash
# =============================================================================
# Production backup script for /var/www/laravel-react
#
# Usage:
#   ./scripts/backup_prod.sh                   # full backup
#   BACKUP_DRY_RUN=1 ./scripts/backup_prod.sh  # dry-run (no dump/archive)
#   BACKUP_KEEP_COUNT=3 ./scripts/backup_prod.sh
#
# Backups are stored in:
#   /var/www/laravel-react/backups/prod_backup_YYYYMMDD_HHMMSS_full_snapshot
#
# Keeps last BACKUP_KEEP_COUNT (default: 2) prod_backup_*_full_snapshot dirs.
# Older directories are removed automatically after a successful backup.
# =============================================================================
set -Eeuo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT="/var/www/laravel-react"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
DRY_RUN="${BACKUP_DRY_RUN:-0}"
BACKUP_KEEP_COUNT="${BACKUP_KEEP_COUNT:-2}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/prod_backup_${TIMESTAMP}_full_snapshot"
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
err() {
    echo "[backup_prod] ERROR: $*" >&2
    exit 1
}

log() {
    echo "[backup_prod] $*"
}

get_env_value() {
    local key="$1"
    local env_file="$2"
    local raw
    raw="$(grep -E "^${key}=" "${env_file}" | tail -n 1 || true)"
    raw="${raw#*=}"
    raw="${raw%$'\r'}"
    [[ -z "${raw}" ]] && { echo ""; return 0; }
    if   [[ "${raw}" == '"'*'"' ]]; then raw="${raw:1:${#raw}-2}"
    elif [[ "${raw}" == "'"*"'" ]]; then raw="${raw:1:${#raw}-2}"
    fi
    echo "${raw}"
}

# ---------------------------------------------------------------------------
# Guard: BACKUP_KEEP_COUNT must be a positive integer
# ---------------------------------------------------------------------------
[[ "${BACKUP_KEEP_COUNT}" =~ ^[1-9][0-9]*$ ]] \
    || err "BACKUP_KEEP_COUNT must be a positive integer, got: ${BACKUP_KEEP_COUNT}"

# ---------------------------------------------------------------------------
# Guard: Project root
# ---------------------------------------------------------------------------
[[ -d "${PROJECT_ROOT}" ]] || err "Project root not found: ${PROJECT_ROOT}"

# ---------------------------------------------------------------------------
# Ensure BACKUP_ROOT exists and is the expected path (safety guard)
# ---------------------------------------------------------------------------
[[ "${BACKUP_ROOT}" == "/var/www/laravel-react/backups" ]] \
    || err "BACKUP_ROOT has unexpected value: ${BACKUP_ROOT}"
[[ -d "${BACKUP_ROOT}" ]] || mkdir -p "${BACKUP_ROOT}"
[[ -d "${BACKUP_ROOT}" ]] || err "Could not create backup root: ${BACKUP_ROOT}"

# ---------------------------------------------------------------------------
# .env
# ---------------------------------------------------------------------------
ENV_FILE="${PROJECT_ROOT}/.env"
[[ -f "${ENV_FILE}" ]] || err ".env not found at ${ENV_FILE}"

# ---------------------------------------------------------------------------
# Read DB settings from .env (never print values)
# ---------------------------------------------------------------------------
DB_CONNECTION="$(get_env_value "DB_CONNECTION" "${ENV_FILE}")"
DB_HOST="$(get_env_value "DB_HOST" "${ENV_FILE}")"
DB_PORT="$(get_env_value "DB_PORT" "${ENV_FILE}")"
DB_DATABASE="$(get_env_value "DB_DATABASE" "${ENV_FILE}")"
DB_USERNAME="$(get_env_value "DB_USERNAME" "${ENV_FILE}")"
DB_PASSWORD="$(get_env_value "DB_PASSWORD" "${ENV_FILE}")"
DB_CONNECTION="${DB_CONNECTION:-mysql}"

# ---------------------------------------------------------------------------
# Create backup directory
# ---------------------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"
[[ -d "${BACKUP_DIR}" ]] || err "Backup directory was not created: ${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# Backup .env (chmod 600, never echo contents)
# ---------------------------------------------------------------------------
ENV_BACKUP_FILE="${BACKUP_DIR}/env_${TIMESTAMP}.backup"
cp "${ENV_FILE}" "${ENV_BACKUP_FILE}"
chmod 600 "${ENV_BACKUP_FILE}"

# ---------------------------------------------------------------------------
# DRY-RUN branch: validate only, no heavy operations
# ---------------------------------------------------------------------------
DB_BACKUP_FILE=""
STORAGE_BACKUP_FILE=""
OLD_BACKUPS_REMOVED=0

if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN mode — validating configuration only, no dump or archive created."

    # Validate DB settings
    if [[ "${DB_CONNECTION}" == "sqlite" ]]; then
        [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty for sqlite"
        SQLITE_PATH="${DB_DATABASE}"
        [[ "${SQLITE_PATH}" == /* ]] || SQLITE_PATH="${PROJECT_ROOT}/${SQLITE_PATH}"
        [[ -f "${SQLITE_PATH}" ]] || err "SQLite database file not found: ${SQLITE_PATH}"
        log "SQLite database found: ${SQLITE_PATH}"
    else
        [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty"
        [[ -n "${DB_HOST}" ]]     || err "DB_HOST is empty"
        [[ -n "${DB_PORT}" ]]     || err "DB_PORT is empty"
        [[ -n "${DB_USERNAME}" ]] || err "DB_USERNAME is empty"
        log "MySQL/MariaDB: host=${DB_HOST} port=${DB_PORT} database=${DB_DATABASE} user=${DB_USERNAME}"
    fi

    # Validate storage paths
    [[ -d "${PROJECT_ROOT}/storage/app" ]] \
        || err "storage/app directory not found: ${PROJECT_ROOT}/storage/app"
    log "storage/app found."

    if [[ -d "${PROJECT_ROOT}/public/storage" ]]; then
        log "public/storage found."
    else
        log "public/storage not found (will be skipped in full mode)."
    fi

    # Write a minimal dry-run manifest
    {
        echo "dry_run=1"
        echo "timestamp=${TIMESTAMP}"
        echo "hostname=$(hostname)"
        echo "user=$(whoami)"
        echo "db_connection=${DB_CONNECTION}"
        echo "db_database=${DB_DATABASE}"
        echo "validation=passed"
    } > "${MANIFEST_FILE}"

    log "Validation passed. Cleaning up dry-run directory: ${BACKUP_DIR}"
    rm -rf "${BACKUP_DIR}"
    log ""
    log "============================================================"
    log "DRY-RUN completed successfully."
    log "No backup files were created."
    log "BACKUP_KEEP_COUNT = ${BACKUP_KEEP_COUNT}"
    log "Full backup command: ${PROJECT_ROOT}/scripts/backup_prod.sh"
    log "============================================================"
    exit 0
fi

# ---------------------------------------------------------------------------
# FULL BACKUP
# ---------------------------------------------------------------------------

# --- Database backup -------------------------------------------------------
if [[ "${DB_CONNECTION}" == "sqlite" ]]; then
    [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty for sqlite"
    SQLITE_PATH="${DB_DATABASE}"
    [[ "${SQLITE_PATH}" == /* ]] || SQLITE_PATH="${PROJECT_ROOT}/${SQLITE_PATH}"
    [[ -f "${SQLITE_PATH}" ]] || err "SQLite database file not found: ${SQLITE_PATH}"

    SQLITE_COPY="${BACKUP_DIR}/database_${TIMESTAMP}.sqlite"
    cp "${SQLITE_PATH}" "${SQLITE_COPY}"
    gzip -f "${SQLITE_COPY}"
    DB_BACKUP_FILE="${SQLITE_COPY}.gz"
else
    [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty"
    [[ -n "${DB_HOST}" ]]     || err "DB_HOST is empty"
    [[ -n "${DB_PORT}" ]]     || err "DB_PORT is empty"
    [[ -n "${DB_USERNAME}" ]] || err "DB_USERNAME is empty"

    DB_BACKUP_FILE="${BACKUP_DIR}/database_${TIMESTAMP}.sql.gz"
    log "Creating database dump: ${DB_BACKUP_FILE}"

    MYSQL_PWD="${DB_PASSWORD}" mysqldump \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --no-tablespaces \
        -h"${DB_HOST}" \
        -P"${DB_PORT}" \
        -u"${DB_USERNAME}" \
        "${DB_DATABASE}" \
        | gzip -c > "${DB_BACKUP_FILE}"
fi

[[ -n "${DB_BACKUP_FILE}" ]]    || err "DB_BACKUP_FILE variable is empty after dump"
[[ -f "${DB_BACKUP_FILE}" ]]    || err "DB dump file not found: ${DB_BACKUP_FILE}"
[[ -s "${DB_BACKUP_FILE}" ]]    || err "DB dump is zero-size: ${DB_BACKUP_FILE}"
gzip -t "${DB_BACKUP_FILE}"     || err "gzip integrity check failed: ${DB_BACKUP_FILE}"
log "Database dump OK."

# --- Storage archive -------------------------------------------------------
storage_sources=()
[[ -d "${PROJECT_ROOT}/storage/app" ]]   && storage_sources+=("storage/app")
[[ -d "${PROJECT_ROOT}/public/storage" ]] && storage_sources+=("public/storage")

if [[ ${#storage_sources[@]} -gt 0 ]]; then
    STORAGE_BACKUP_FILE="${BACKUP_DIR}/storage_app_${TIMESTAMP}.tar.gz"
    log "Creating storage archive: ${STORAGE_BACKUP_FILE}"

    tar -czf "${STORAGE_BACKUP_FILE}" \
        -C "${PROJECT_ROOT}" \
        --exclude='.git' \
        --exclude='vendor' \
        --exclude='node_modules' \
        --exclude='backups' \
        --exclude='storage/logs' \
        --exclude='storage/framework/cache' \
        --exclude='storage/framework/sessions' \
        --exclude='storage/framework/views' \
        "${storage_sources[@]}"

    [[ -f "${STORAGE_BACKUP_FILE}" ]] || err "Storage archive not created: ${STORAGE_BACKUP_FILE}"
    [[ -s "${STORAGE_BACKUP_FILE}" ]] || err "Storage archive is zero-size: ${STORAGE_BACKUP_FILE}"
    tar -tzf "${STORAGE_BACKUP_FILE}" >/dev/null \
        || err "tar integrity check failed: ${STORAGE_BACKUP_FILE}"
    log "Storage archive OK."
else
    log "No storage directories found; skipping storage archive."
fi

# --- Manifest + SHA256SUMS -------------------------------------------------
BRANCH_NAME="$(git -C "${PROJECT_ROOT}" branch --show-current 2>/dev/null || echo "unknown")"
GIT_HEAD="$(git -C "${PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || echo "unknown")"
GIT_STATUS_SHORT="$(git -C "${PROJECT_ROOT}" status --short 2>/dev/null || true)"

{
    echo "timestamp=${TIMESTAMP}"
    echo "hostname=$(hostname)"
    echo "user=$(whoami)"
    echo "project_root=${PROJECT_ROOT}"
    echo "git_branch=${BRANCH_NAME}"
    echo "git_head=${GIT_HEAD}"
    echo "db_connection=${DB_CONNECTION}"
    echo "db_database=${DB_DATABASE}"
    echo "dry_run=0"
    echo
    echo "[git_status_short]"
    if [[ -n "${GIT_STATUS_SHORT}" ]]; then
        echo "${GIT_STATUS_SHORT}"
    else
        echo "clean"
    fi
    echo
    echo "[backup_files]"
    find "${BACKUP_DIR}" -maxdepth 1 -type f -printf '%f\n' | sort
    echo
    echo "[sizes]"
    while IFS= read -r fp; do
        [[ -n "${fp}" ]] || continue
        printf '%s\n' "$(du -h "${fp}" | awk '{print $1"\t"$2}')"
    done < <(find "${BACKUP_DIR}" -maxdepth 1 -type f | sort)
} > "${MANIFEST_FILE}"

# SHA256 checksums (exclude the SUMS file itself)
find "${BACKUP_DIR}" -maxdepth 1 -type f ! -name 'SHA256SUMS' -print0 \
    | xargs -0 sha256sum \
    > "${BACKUP_DIR}/SHA256SUMS"

{
    echo
    echo "[sha256sum]"
    cat "${BACKUP_DIR}/SHA256SUMS"
} >> "${MANIFEST_FILE}"

TOTAL_SIZE="$(du -sh "${BACKUP_DIR}" | awk '{print $1}')"
log "Manifest and checksums written."

# ---------------------------------------------------------------------------
# Retention: keep last BACKUP_KEEP_COUNT prod_backup_*_full_snapshot dirs
# ---------------------------------------------------------------------------
cleanup_old_backups() {
    # Guard: BACKUP_ROOT must be exactly our expected path
    [[ "${BACKUP_ROOT}" == "/var/www/laravel-react/backups" ]] \
        || { log "WARN: unexpected BACKUP_ROOT, skipping cleanup."; return; }
    [[ -d "${BACKUP_ROOT}" ]] \
        || { log "WARN: BACKUP_ROOT not a directory, skipping cleanup."; return; }
    [[ -n "${BACKUP_ROOT}" ]] \
        || { log "WARN: BACKUP_ROOT is empty, skipping cleanup."; return; }

    # Collect all prod_backup_*_full_snapshot directories, sorted oldest-first
    local all_dirs=()
    while IFS= read -r -d '' d; do
        # Triple-check each candidate
        [[ "${d}" == "${BACKUP_ROOT}/prod_backup_"* ]] || continue
        [[ "${d}" == *"_full_snapshot" ]]               || continue
        [[ -d "${d}" ]]                                 || continue
        all_dirs+=("${d}")
    done < <(find "${BACKUP_ROOT}" -maxdepth 1 -type d \
                  -name 'prod_backup_*_full_snapshot' -print0 \
             | sort -z)

    local total="${#all_dirs[@]}"
    if [[ "${total}" -le "${BACKUP_KEEP_COUNT}" ]]; then
        log "Retention: ${total} backup(s) present, keeping all (limit=${BACKUP_KEEP_COUNT})."
        return
    fi

    # Keep the newest BACKUP_KEEP_COUNT; delete the rest (oldest first)
    local to_delete_count=$(( total - BACKUP_KEEP_COUNT ))
    local to_delete=("${all_dirs[@]:0:${to_delete_count}}")

    log "Retention: ${total} backup(s) found, keeping ${BACKUP_KEEP_COUNT}, removing ${to_delete_count} old backup(s)."
    log "Directories that will be removed:"
    local d
    for d in "${to_delete[@]}"; do
        log "  -> ${d}"
    done

    for d in "${to_delete[@]}"; do
        # Final safety checks before each rm -rf
        [[ -n "${d}" ]]                                  || { log "WARN: empty path, skipping."; continue; }
        [[ "${d}" == "${BACKUP_ROOT}/prod_backup_"* ]]   || { log "WARN: path does not start with expected prefix, skipping: ${d}"; continue; }
        [[ "${d}" == *"_full_snapshot" ]]                || { log "WARN: path does not end with _full_snapshot, skipping: ${d}"; continue; }
        [[ "${d}" != "${BACKUP_DIR}" ]]                  || { log "WARN: refusing to delete the current backup: ${d}"; continue; }
        [[ -d "${d}" ]]                                  || { log "WARN: not a directory, skipping: ${d}"; continue; }

        log "Removing old backup: ${d}"
        rm -rf "${d}"
        (( OLD_BACKUPS_REMOVED++ )) || true
    done
}

cleanup_old_backups

# ---------------------------------------------------------------------------
# Final report
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo " Backup completed successfully."
echo "============================================================"
echo " Backup directory : ${BACKUP_DIR}"
echo " Database backup  : ${DB_BACKUP_FILE:-not-created}"
echo " Storage backup   : ${STORAGE_BACKUP_FILE:-not-created}"
echo " Env backup       : ${ENV_BACKUP_FILE}"
echo " Manifest         : ${MANIFEST_FILE}"
echo " Total size       : ${TOTAL_SIZE}"
echo " Old backups removed : ${OLD_BACKUPS_REMOVED}"
echo " Backups kept        : ${BACKUP_KEEP_COUNT}"
echo "============================================================"

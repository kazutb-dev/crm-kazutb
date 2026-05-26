#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="/var/www/laravel-react"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
EXPECTED_BACKUP_ROOT="/var/www/laravel-react/backups"
DRY_RUN="${BACKUP_DRY_RUN:-0}"
CLEANUP_ONLY="${BACKUP_CLEANUP_ONLY:-0}"
# Keep only 1 completed full_snapshot (old default was 2; now hardened).
BACKUP_KEEP_COUNT="${BACKUP_KEEP_COUNT:-1}"
# Keep this many per-prefix runtime backups (nav_fix_*, nginx_ssl_fix_*, etc.)
RUNTIME_BACKUP_KEEP_COUNT="${RUNTIME_BACKUP_KEEP_COUNT:-3}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
# Use .incomplete suffix while the backup is in progress.
# Only rename to final path after validation succeeds.
BACKUP_DIR_FINAL="${BACKUP_ROOT}/prod_backup_${TIMESTAMP}_full_snapshot"
BACKUP_DIR="${BACKUP_DIR_FINAL}.incomplete"
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"

DB_BACKUP_FILE=""
PROJECT_DATA_ARCHIVE_FILE=""
ENV_BACKUP_FILE=""
TAR_WARNING_LOG=""
TOTAL_SIZE=""

CLEANUP_DIRS_REMOVED=0
CLEANUP_FILES_REMOVED=0

declare -a WARNINGS=()
declare -a CLEANUP_DETAILS=()

usage() {
    cat <<'EOF'
Usage:
  ./scripts/backup_prod.sh
  BACKUP_DRY_RUN=1 ./scripts/backup_prod.sh
  ./scripts/backup_prod.sh --cleanup-only
  BACKUP_CLEANUP_ONLY=1 ./scripts/backup_prod.sh
  BACKUP_KEEP_COUNT=1 ./scripts/backup_prod.sh --cleanup-only
EOF
}

log() {
    echo "[backup_prod] $*"
}

warn() {
    local msg="$*"
    WARNINGS+=("${msg}")
    echo "[backup_prod] WARN: ${msg}" >&2
}

err() {
    echo "[backup_prod] ERROR: $*" >&2
    exit 1
}

add_cleanup_detail() {
    CLEANUP_DETAILS+=("$*")
    log "$*"
}

get_env_value() {
    local key="$1"
    local env_file="$2"
    local raw

    raw="$(grep -E "^${key}=" "${env_file}" | tail -n 1 || true)"
    raw="${raw#*=}"
    raw="${raw%$'\r'}"

    if [[ -z "${raw}" ]]; then
        echo ""
        return 0
    fi

    if [[ "${raw}" == '"'*'"' ]]; then
        raw="${raw:1:${#raw}-2}"
    elif [[ "${raw}" == "'"*"'" ]]; then
        raw="${raw:1:${#raw}-2}"
    fi

    echo "${raw}"
}

safe_delete_path() {
    local candidate="$1"
    local kind="$2"

    [[ "${BACKUP_ROOT}" == "${EXPECTED_BACKUP_ROOT}" ]] || err "Safety check failed: BACKUP_ROOT mismatch"
    [[ -n "${candidate}" ]] || { warn "Empty cleanup candidate skipped"; return 0; }
    [[ "${candidate}" != "/" ]] || { warn "Refusing to delete root path"; return 0; }
    [[ "${candidate}" != "${BACKUP_ROOT}" ]] || { warn "Refusing to delete BACKUP_ROOT"; return 0; }
    [[ "${candidate}" == "${BACKUP_ROOT}/"* ]] || { warn "Path outside BACKUP_ROOT skipped: ${candidate}"; return 0; }
    [[ "$(dirname "${candidate}")" == "${BACKUP_ROOT}" ]] || { warn "Not a direct child of BACKUP_ROOT: ${candidate}"; return 0; }
    [[ "${candidate}" != "${BACKUP_DIR}" ]] || { warn "Refusing to delete current backup dir: ${candidate}"; return 0; }

    if [[ "${DRY_RUN}" == "1" ]]; then
        add_cleanup_detail "DRY-RUN cleanup would remove ${kind}: ${candidate}"
        return 0
    fi

    if [[ "${kind}" == "directory" ]]; then
        [[ -d "${candidate}" ]] || { warn "Directory not found for cleanup: ${candidate}"; return 0; }
        rm -rf "${candidate}"
        (( CLEANUP_DIRS_REMOVED++ )) || true
        add_cleanup_detail "Removed directory: ${candidate}"
    else
        [[ -f "${candidate}" ]] || { warn "File not found for cleanup: ${candidate}"; return 0; }
        rm -f "${candidate}"
        (( CLEANUP_FILES_REMOVED++ )) || true
        add_cleanup_detail "Removed file: ${candidate}"
    fi
}

cleanup_ranked_items() {
    local item_type="$1"
    local find_expr="$2"
    local kept=0

    while IFS= read -r line; do
        [[ -n "${line}" ]] || continue
        local path="${line#* }"
        [[ -n "${path}" ]] || continue

        if [[ "${kept}" -lt "${BACKUP_KEEP_COUNT}" ]]; then
            (( kept++ )) || true
            add_cleanup_detail "Keeping ${item_type}: ${path}"
            continue
        fi

        safe_delete_path "${path}" "${item_type}"
    done < <(eval "${find_expr}" | sort -nr)
}

cleanup_full_snapshots() {
    # Keep BACKUP_KEEP_COUNT completed (non-.incomplete) full snapshots; remove older ones.
    local kept=0
    while IFS= read -r line; do
        local path="${line#* }"
        [[ -n "${path}" && -d "${path}" ]] || continue
        if (( kept < BACKUP_KEEP_COUNT )); then
            (( kept++ )) || true
            add_cleanup_detail "Keeping completed snapshot (${kept}/${BACKUP_KEEP_COUNT}): ${path}"
        else
            safe_delete_path "${path}" "directory"
        fi
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d \
        -name 'prod_backup_*_full_snapshot' \
        ! -name '*.incomplete' \
        -printf '%T@ %p\n' 2>/dev/null | sort -nr)
}

cleanup_incomplete_backups() {
    # Remove .incomplete backup dirs older than 24 hours (failed / interrupted runs).
    local cutoff
    cutoff="$(date -d '24 hours ago' +%s 2>/dev/null || echo 0)"
    while IFS= read -r line; do
        local mtime="${line%% *}"
        local path="${line#* }"
        local mtime_int="${mtime%%.*}"
        [[ -n "${path}" && -d "${path}" ]] || continue
        if [[ "${mtime_int}" -lt "${cutoff}" ]]; then
            safe_delete_path "${path}" "directory"
        else
            add_cleanup_detail "Keeping recent .incomplete (< 24h): ${path}"
        fi
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d \
        -name '*.incomplete' \
        -printf '%T@ %p\n' 2>/dev/null)
}

cleanup_runtime_backups_by_prefix() {
    # Keep RUNTIME_BACKUP_KEEP_COUNT most recent dirs/files matching <prefix>*.
    local prefix="$1"
    local keep="${2:-${RUNTIME_BACKUP_KEEP_COUNT}}"
    local kept=0
    while IFS= read -r line; do
        local path="${line#* }"
        [[ -n "${path}" ]] || continue
        if (( kept < keep )); then
            (( kept++ )) || true
            add_cleanup_detail "Keeping runtime backup [${prefix}*] (${kept}/${keep}): ${path}"
        else
            if [[ -d "${path}" ]]; then
                safe_delete_path "${path}" "directory"
            else
                safe_delete_path "${path}" "file"
            fi
        fi
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 \
        \( -type d -o -type f \) \
        -name "${prefix}*" \
        -printf '%T@ %p\n' 2>/dev/null | sort -nr)
}

cleanup_misc_files() {
    # cleanup_only_* manifest dirs: always remove (they're just temporary cleanup logs).
    while IFS= read -r line; do
        local path="${line#* }"
        [[ -n "${path}" && -d "${path}" ]] || continue
        safe_delete_path "${path}" "directory"
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d \
        -name 'cleanup_only_*' \
        -printf '%T@ %p\n' 2>/dev/null)

    # Legacy loose files: keep at most 1 each.
    for pattern in 'pre_seeder_backup_*' 'db_backup_*' 'laravel_react_*' 'pre_deploy_*.manifest' '*.sql.gz' '*.tar.gz'; do
        local kept=0
        while IFS= read -r line; do
            local path="${line#* }"
            [[ -n "${path}" && -f "${path}" ]] || continue
            if (( kept < 1 )); then
                (( kept++ )) || true
                add_cleanup_detail "Keeping legacy file [${pattern}]: ${path}"
            else
                safe_delete_path "${path}" "file"
            fi
        done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type f \
            -name "${pattern}" \
            -printf '%T@ %p\n' 2>/dev/null | sort -nr)
    done
}

cleanup_old_backups() {
    [[ "${BACKUP_ROOT}" == "${EXPECTED_BACKUP_ROOT}" ]] || err "Cleanup aborted: BACKUP_ROOT mismatch"
    [[ -n "${BACKUP_ROOT}" ]] || err "Cleanup aborted: BACKUP_ROOT empty"
    [[ -d "${BACKUP_ROOT}" ]] || err "Cleanup aborted: BACKUP_ROOT missing"

    add_cleanup_detail "Cleanup started (keep_full=${BACKUP_KEEP_COUNT}, keep_runtime=${RUNTIME_BACKUP_KEEP_COUNT})."

    cleanup_full_snapshots
    cleanup_incomplete_backups
    cleanup_runtime_backups_by_prefix "nav_fix_" "${RUNTIME_BACKUP_KEEP_COUNT}"
    cleanup_runtime_backups_by_prefix "nginx_ssl_fix_" "${RUNTIME_BACKUP_KEEP_COUNT}"
    cleanup_runtime_backups_by_prefix "dev_before_prod_sync_" "2"
    cleanup_misc_files

    add_cleanup_detail "Cleanup finished. directories_removed=${CLEANUP_DIRS_REMOVED}, files_removed=${CLEANUP_FILES_REMOVED}, dry_run=${DRY_RUN}"
}

write_manifest() {
    local dry_run_mode="$1"
    local cleanup_mode="$2"

    local branch_name="$(git -C "${PROJECT_ROOT}" branch --show-current 2>/dev/null || echo unknown)"
    local git_head="$(git -C "${PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"
    local git_status_short="$(git -C "${PROJECT_ROOT}" status --short 2>/dev/null || true)"

    {
        echo "timestamp=${TIMESTAMP}"
        echo "hostname=$(hostname)"
        echo "user=$(whoami)"
        echo "project_root=${PROJECT_ROOT}"
        echo "backup_root=${BACKUP_ROOT}"
        echo "backup_dir=${BACKUP_DIR}"
        echo "dry_run=${dry_run_mode}"
        echo "cleanup_only=${cleanup_mode}"
        echo "git_branch=${branch_name}"
        echo "git_head=${git_head}"
        echo "db_connection=${DB_CONNECTION:-n/a}"
        echo "db_database=${DB_DATABASE:-n/a}"
        echo "backup_keep_count=${BACKUP_KEEP_COUNT}"
        echo
        echo "[git_status_short]"
        if [[ -n "${git_status_short}" ]]; then
            echo "${git_status_short}"
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
        echo
        echo "[warnings]"
        if [[ "${#WARNINGS[@]}" -eq 0 ]]; then
            echo "none"
        else
            printf '%s\n' "${WARNINGS[@]}"
        fi
        echo
        echo "[cleanup_result]"
        if [[ "${#CLEANUP_DETAILS[@]}" -eq 0 ]]; then
            echo "none"
        else
            printf '%s\n' "${CLEANUP_DETAILS[@]}"
        fi
    } > "${MANIFEST_FILE}"

    # Exclude manifest from SHA file list to avoid self-referential mismatch.
    find "${BACKUP_DIR}" -maxdepth 1 -type f ! -name 'SHA256SUMS' ! -name 'manifest_*.txt' -print0 | xargs -0 sha256sum > "${BACKUP_DIR}/SHA256SUMS"

    {
        echo
        echo "[sha256sum]"
        cat "${BACKUP_DIR}/SHA256SUMS"
    } >> "${MANIFEST_FILE}"

    TOTAL_SIZE="$(du -sh "${BACKUP_DIR}" | awk '{print $1}')"

    {
        echo
        echo "[total_size]"
        echo "${TOTAL_SIZE}"
    } >> "${MANIFEST_FILE}"
}

for arg in "$@"; do
    case "${arg}" in
        --cleanup-only)
            CLEANUP_ONLY="1"
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            err "Unknown argument: ${arg}"
            ;;
    esac
done

[[ "${BACKUP_KEEP_COUNT}" =~ ^[1-9][0-9]*$ ]] || err "BACKUP_KEEP_COUNT must be a positive integer"
[[ -d "${PROJECT_ROOT}" ]] || err "Project root not found: ${PROJECT_ROOT}"
[[ "${BACKUP_ROOT}" == "${EXPECTED_BACKUP_ROOT}" ]] || err "Unexpected BACKUP_ROOT: ${BACKUP_ROOT}"
[[ -d "${BACKUP_ROOT}" ]] || mkdir -p "${BACKUP_ROOT}"
[[ -d "${BACKUP_ROOT}" ]] || err "Unable to create BACKUP_ROOT: ${BACKUP_ROOT}"

if [[ "${CLEANUP_ONLY}" == "1" ]]; then
    log "Cleanup-only mode started (dry_run=${DRY_RUN}, keep=${BACKUP_KEEP_COUNT})."
    BACKUP_DIR="${BACKUP_ROOT}/cleanup_only_${TIMESTAMP}"
    mkdir -p "${BACKUP_DIR}"
    MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"

    cleanup_old_backups
    write_manifest "${DRY_RUN}" "1"

    if [[ "${DRY_RUN}" == "1" ]]; then
        log "Cleanup-only dry-run completed. Removing temporary cleanup manifest dir: ${BACKUP_DIR}"
        rm -rf "${BACKUP_DIR}"
    fi

    log "Cleanup-only summary: dirs_removed=${CLEANUP_DIRS_REMOVED}, files_removed=${CLEANUP_FILES_REMOVED}, dry_run=${DRY_RUN}"
    log "Current backups state:"
    ls -lah "${BACKUP_ROOT}" || true
    du -sh "${BACKUP_ROOT}"/* 2>/dev/null | sort -h || true
    exit 0
fi

ENV_FILE="${PROJECT_ROOT}/.env"
[[ -f "${ENV_FILE}" ]] || err ".env not found at ${ENV_FILE}"

DB_CONNECTION="$(get_env_value "DB_CONNECTION" "${ENV_FILE}")"
DB_HOST="$(get_env_value "DB_HOST" "${ENV_FILE}")"
DB_PORT="$(get_env_value "DB_PORT" "${ENV_FILE}")"
DB_DATABASE="$(get_env_value "DB_DATABASE" "${ENV_FILE}")"
DB_USERNAME="$(get_env_value "DB_USERNAME" "${ENV_FILE}")"
DB_PASSWORD="$(get_env_value "DB_PASSWORD" "${ENV_FILE}")"
DB_CONNECTION="${DB_CONNECTION:-mysql}"

if command -v pigz >/dev/null 2>&1; then
    GZIP_CMD=(pigz -1 -c)
    TAR_COMPRESS_PROGRAM="pigz -1"
    log "Using pigz for faster compression."
else
    GZIP_CMD=(gzip -1 -c)
    TAR_COMPRESS_PROGRAM="gzip -1"
fi

mkdir -p "${BACKUP_DIR}"
[[ -d "${BACKUP_DIR}" ]] || err "Failed to create backup dir: ${BACKUP_DIR}"

ENV_BACKUP_FILE="${BACKUP_DIR}/env_${TIMESTAMP}.backup"
cp "${ENV_FILE}" "${ENV_BACKUP_FILE}"
chmod 600 "${ENV_BACKUP_FILE}"

if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN mode: validating configuration and expected sources only."

    if [[ "${DB_CONNECTION}" == "sqlite" ]]; then
        [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty for sqlite"
        sqlite_path="${DB_DATABASE}"
        [[ "${sqlite_path}" == /* ]] || sqlite_path="${PROJECT_ROOT}/${sqlite_path}"
        [[ -f "${sqlite_path}" ]] || err "SQLite database file not found: ${sqlite_path}"
    else
        [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty"
        [[ -n "${DB_HOST}" ]] || err "DB_HOST is empty"
        [[ -n "${DB_PORT}" ]] || err "DB_PORT is empty"
        [[ -n "${DB_USERNAME}" ]] || err "DB_USERNAME is empty"
        command -v mysqldump >/dev/null 2>&1 || err "mysqldump command not found"
    fi

    for required in storage public bootstrap/cache database routes config app resources scripts docs artisan; do
        if [[ -e "${PROJECT_ROOT}/${required}" ]]; then
            log "Found backup source: ${required}"
        else
            warn "Backup source not found (will be skipped): ${required}"
        fi
    done

    write_manifest "1" "0"
    log "Dry-run validation completed. Removing temporary backup dir: ${BACKUP_DIR}"
    rm -rf "${BACKUP_DIR}"
    exit 0
fi

if [[ "${DB_CONNECTION}" == "sqlite" ]]; then
    [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty for sqlite"
    sqlite_path="${DB_DATABASE}"
    [[ "${sqlite_path}" == /* ]] || sqlite_path="${PROJECT_ROOT}/${sqlite_path}"
    [[ -f "${sqlite_path}" ]] || err "SQLite database file not found: ${sqlite_path}"

    sqlite_copy="${BACKUP_DIR}/database_${TIMESTAMP}.sqlite"
    DB_BACKUP_FILE="${sqlite_copy}.gz"
    cp "${sqlite_path}" "${sqlite_copy}"
    "${GZIP_CMD[@]}" < "${sqlite_copy}" > "${DB_BACKUP_FILE}"
    rm -f "${sqlite_copy}"
else
    [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty"
    [[ -n "${DB_HOST}" ]] || err "DB_HOST is empty"
    [[ -n "${DB_PORT}" ]] || err "DB_PORT is empty"
    [[ -n "${DB_USERNAME}" ]] || err "DB_USERNAME is empty"

    DB_BACKUP_FILE="${BACKUP_DIR}/database_${TIMESTAMP}.sql.gz"

    MYSQL_PWD="${DB_PASSWORD}" mysqldump \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --hex-blob \
        --default-character-set=utf8mb4 \
        --no-tablespaces \
        -h"${DB_HOST}" \
        -P"${DB_PORT}" \
        -u"${DB_USERNAME}" \
        "${DB_DATABASE}" \
        | "${GZIP_CMD[@]}" > "${DB_BACKUP_FILE}"
fi

[[ -f "${DB_BACKUP_FILE}" ]] || err "Database backup file missing: ${DB_BACKUP_FILE}"
[[ -s "${DB_BACKUP_FILE}" ]] || err "Database backup file is empty: ${DB_BACKUP_FILE}"
gzip -t "${DB_BACKUP_FILE}" || err "Database backup integrity check failed: ${DB_BACKUP_FILE}"

PROJECT_DATA_ARCHIVE_FILE="${BACKUP_DIR}/project_data_${TIMESTAMP}.tar.gz"
TAR_WARNING_LOG="${BACKUP_DIR}/tar_warnings_${TIMESTAMP}.log"

declare -a PROJECT_DATA_ITEMS=()
for item in storage public bootstrap/cache database routes config app resources scripts docs artisan .env.example composer.json composer.lock package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js public/uploads uploads data; do
    if [[ -e "${PROJECT_ROOT}/${item}" ]]; then
        PROJECT_DATA_ITEMS+=("${item}")
    fi
done

[[ "${#PROJECT_DATA_ITEMS[@]}" -gt 0 ]] || err "No project data items found to archive"

set +e
tar --use-compress-program="${TAR_COMPRESS_PROGRAM}" -cf "${PROJECT_DATA_ARCHIVE_FILE}" \
    -C "${PROJECT_ROOT}" \
    --warning=no-file-changed \
    --ignore-failed-read \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='node_modules' \
    --exclude='vendor' \
    --exclude='.env' \
    --exclude='.DS_Store' \
    "${PROJECT_DATA_ITEMS[@]}" > "${TAR_WARNING_LOG}" 2>&1
tar_exit=$?
set -e

if [[ "${tar_exit}" -eq 0 ]]; then
    log "project_data archive created successfully."
elif [[ "${tar_exit}" -eq 1 ]] && grep -Eq "file changed as we read it|File removed before we read it|Cannot stat" "${TAR_WARNING_LOG}"; then
    warn "tar returned warning exit code 1 with non-fatal read-change entries. Archive accepted. See ${TAR_WARNING_LOG}"
else
    err "tar failed with exit code ${tar_exit}. See ${TAR_WARNING_LOG}"
fi

[[ -f "${PROJECT_DATA_ARCHIVE_FILE}" ]] || err "Project data archive missing: ${PROJECT_DATA_ARCHIVE_FILE}"
[[ -s "${PROJECT_DATA_ARCHIVE_FILE}" ]] || err "Project data archive is empty: ${PROJECT_DATA_ARCHIVE_FILE}"
tar -tzf "${PROJECT_DATA_ARCHIVE_FILE}" >/dev/null || err "Project data archive is corrupted: ${PROJECT_DATA_ARCHIVE_FILE}"

if [[ -s "${TAR_WARNING_LOG}" ]]; then
    warn "tar warnings log contains entries: ${TAR_WARNING_LOG}"
fi

# Both files validated. Rename .incomplete → final path.
log "Backup files validated. Renaming .incomplete → final..."
mv "${BACKUP_DIR}" "${BACKUP_DIR_FINAL}"
DB_BACKUP_FILE="${BACKUP_DIR_FINAL}/${DB_BACKUP_FILE##*/}"
PROJECT_DATA_ARCHIVE_FILE="${BACKUP_DIR_FINAL}/${PROJECT_DATA_ARCHIVE_FILE##*/}"
ENV_BACKUP_FILE="${BACKUP_DIR_FINAL}/${ENV_BACKUP_FILE##*/}"
[[ -n "${TAR_WARNING_LOG}" ]] && TAR_WARNING_LOG="${BACKUP_DIR_FINAL}/${TAR_WARNING_LOG##*/}" || true
BACKUP_DIR="${BACKUP_DIR_FINAL}"
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"
log "Renamed: ${BACKUP_DIR}"

cleanup_old_backups

write_manifest "0" "0"

echo ""
echo "============================================================"
echo " Backup completed successfully."
echo "============================================================"
echo " Backup directory : ${BACKUP_DIR}"
echo " Database backup  : ${DB_BACKUP_FILE}"
echo " Project data     : ${PROJECT_DATA_ARCHIVE_FILE}"
echo " Env backup       : ${ENV_BACKUP_FILE}"
echo " Manifest         : ${MANIFEST_FILE}"
echo " SHA256SUMS       : ${BACKUP_DIR}/SHA256SUMS"
echo " Total size       : ${TOTAL_SIZE}"
echo " Old dirs removed : ${CLEANUP_DIRS_REMOVED}"
echo " Old files removed: ${CLEANUP_FILES_REMOVED}"
echo " Backups kept     : ${BACKUP_KEEP_COUNT}"
echo "============================================================"

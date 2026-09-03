#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="/home/admaza/projects/du"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
EXPECTED_BACKUP_ROOT="/home/admaza/projects/du/backups"

DRY_RUN="${BACKUP_DRY_RUN:-0}"
CLEANUP_ONLY="${BACKUP_CLEANUP_ONLY:-0}"
BACKUP_KEEP_COUNT="${BACKUP_KEEP_COUNT:-1}"
RUNTIME_BACKUP_KEEP_COUNT="${RUNTIME_BACKUP_KEEP_COUNT:-1}"
INCOMPLETE_TTL_HOURS="${INCOMPLETE_TTL_HOURS:-24}"
BACKUP_SPACE_FACTOR="${BACKUP_SPACE_FACTOR:-130}"
BACKUP_OFFSITE_HOOK="${BACKUP_OFFSITE_HOOK:-}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR_FINAL="${BACKUP_ROOT}/prod_backup_${TIMESTAMP}_full_snapshot"
BACKUP_DIR="${BACKUP_DIR_FINAL}.incomplete"
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"
METADATA_JSON_FILE="${BACKUP_DIR}/metadata_${TIMESTAMP}.json"

DB_BACKUP_FILE=""
PROJECT_DATA_ARCHIVE_FILE=""
ENV_BACKUP_FILE=""
TAR_WARNING_LOG=""
TOTAL_SIZE=""

FULL_SNAPSHOTS_REMOVED=0
STALE_INCOMPLETE_REMOVED=0
RUNTIME_DIRS_REMOVED=0
RUNTIME_DIRS_FAILED=0
RUNTIME_DIRS_KEPT=0
MISC_FILES_REMOVED=0

RUNTIME_WARNING_COUNT=0

declare -a WARNINGS=()
declare -a RUNTIME_WARNINGS=()

usage() {
    cat <<'EOF'
Usage:
  ./scripts/backup_prod.sh
  BACKUP_DRY_RUN=1 ./scripts/backup_prod.sh
  ./scripts/backup_prod.sh --cleanup-only
  BACKUP_CLEANUP_ONLY=1 ./scripts/backup_prod.sh

Env:
  BACKUP_KEEP_COUNT=1               # keep latest completed full snapshots
  RUNTIME_BACKUP_KEEP_COUNT=1       # keep latest runtime backup dirs per prefix
  INCOMPLETE_TTL_HOURS=24           # remove stale .incomplete older than this
    BACKUP_SPACE_FACTOR=130           # projected size safety factor in %
    BACKUP_OFFSITE_HOOK=/path/hook.sh # optional executable hook: hook <backup_dir>
EOF
}

log() {
    echo "[backup_prod] $*"
}

warn() {
    local msg="$*"
    WARNINGS+=("$msg")
    echo "[backup_prod] WARN: $msg" >&2
}

err() {
    echo "[backup_prod] ERROR: $*" >&2
    exit 1
}

on_error() {
    local ec="$?"
    if [[ -n "${BACKUP_DIR:-}" && -d "${BACKUP_DIR}" && "${BACKUP_DIR}" == *.incomplete ]]; then
        echo "[backup_prod] ERROR: Backup failed. Incomplete backup kept for inspection: ${BACKUP_DIR}" >&2
        echo "[backup_prod] ERROR: Recovery hint: inspect files and rerun backup after fixing the issue." >&2
    fi
    exit "$ec"
}
trap on_error ERR

get_env_value() {
    local key="$1"
    local env_file="$2"
    local raw

    raw="$(grep -E "^${key}=" "${env_file}" | tail -n1 || true)"
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

assert_safe_backup_root() {
    [[ "${BACKUP_ROOT}" == "${EXPECTED_BACKUP_ROOT}" ]] || err "Unexpected BACKUP_ROOT: ${BACKUP_ROOT}"
    [[ -d "${PROJECT_ROOT}" ]] || err "Project root not found: ${PROJECT_ROOT}"
    [[ -d "${BACKUP_ROOT}" ]] || mkdir -p "${BACKUP_ROOT}"
}

check_projected_disk_space() {
    local available_kb projected_kb base_bytes
    available_kb="$(df -Pk "${PROJECT_ROOT}" | awk 'NR==2 {print $4}')"

    base_bytes="$(du -sb "${PROJECT_ROOT}/storage" "${PROJECT_ROOT}/public" "${PROJECT_ROOT}/database" "${PROJECT_ROOT}/app" "${PROJECT_ROOT}/routes" "${PROJECT_ROOT}/config" "${PROJECT_ROOT}/scripts" "${PROJECT_ROOT}/docs" 2>/dev/null | awk '{s+=$1} END {print s+0}')"
    projected_kb="$(( (base_bytes / 1024) * BACKUP_SPACE_FACTOR / 100 ))"
    [[ "${projected_kb}" -gt 0 ]] || projected_kb=1024

    if [[ "${available_kb}" -lt "${projected_kb}" ]]; then
        err "Projected disk check failed: available_kb=${available_kb}, projected_kb=${projected_kb}, factor=${BACKUP_SPACE_FACTOR}%"
    fi

    log "Projected disk check passed: available_kb=${available_kb}, projected_kb=${projected_kb}, factor=${BACKUP_SPACE_FACTOR}%"
}

is_direct_child_of_backup_root() {
    local path="$1"
    [[ -n "${path}" ]] || return 1
    [[ "${path}" == "${BACKUP_ROOT}/"* ]] || return 1
    [[ "$(dirname "${path}")" == "${BACKUP_ROOT}" ]]
}

is_owned_or_writable() {
    local path="$1"
    [[ -O "${path}" || -w "${path}" ]]
}

remove_dir_best_effort() {
    local dir_path="$1"
    local context_label="$2"

    if ! is_direct_child_of_backup_root "${dir_path}"; then
        warn "Skip unsafe directory cleanup path (${context_label}): ${dir_path}"
        return 0
    fi

    [[ -d "${dir_path}" ]] || return 0

    if [[ "${DRY_RUN}" == "1" ]]; then
        log "DRY-RUN: would remove directory (${context_label}): ${dir_path}"
        return 0
    fi

    if rm -rf "${dir_path}" 2>/tmp/backup_rm_err.$$; then
        case "${context_label}" in
            runtime-*) (( RUNTIME_DIRS_REMOVED++ )) || true ;;
            stale-incomplete) (( STALE_INCOMPLETE_REMOVED++ )) || true ;;
            full-snapshot) (( FULL_SNAPSHOTS_REMOVED++ )) || true ;;
        esac
        return 0
    fi

    local rm_err
    rm_err="$(cat /tmp/backup_rm_err.$$ 2>/dev/null || true)"
    rm -f /tmp/backup_rm_err.$$ || true

    warn "Failed to remove directory (${context_label}): ${dir_path}. ${rm_err}"

    if [[ "${context_label}" == runtime-* ]]; then
        (( RUNTIME_DIRS_FAILED++ )) || true
        (( RUNTIME_WARNING_COUNT++ )) || true
        RUNTIME_WARNINGS+=("${dir_path}")
        if [[ "${rm_err}" == *"Permission denied"* ]]; then
            warn "Manual cleanup suggested: sudo rm -rf ${dir_path}"
        fi
        return 0
    fi

    if [[ "${context_label}" == "misc" || "${context_label}" == "stale-incomplete" ]]; then
        return 0
    fi

    err "Failed to remove directory (${context_label}): ${dir_path}"
}

remove_file_best_effort() {
    local file_path="$1"
    local context_label="$2"

    if ! is_direct_child_of_backup_root "${file_path}"; then
        warn "Skip unsafe file cleanup path (${context_label}): ${file_path}"
        return 0
    fi

    [[ -f "${file_path}" ]] || return 0

    if [[ "${DRY_RUN}" == "1" ]]; then
        log "DRY-RUN: would remove file (${context_label}): ${file_path}"
        return 0
    fi

    if rm -f "${file_path}"; then
        (( MISC_FILES_REMOVED++ )) || true
    else
        warn "Failed to remove file (${context_label}): ${file_path}"
    fi
}

validate_completed_backup_dir() {
    local backup_dir="$1"
    local allow_incomplete="${2:-0}"

    [[ -d "${backup_dir}" ]] || return 1
    if [[ "${allow_incomplete}" != "1" ]]; then
        [[ "${backup_dir}" != *.incomplete ]] || return 1
    fi

    local db_file data_file env_file manifest_file sha_file
    db_file="$(find "${backup_dir}" -maxdepth 1 -type f -name 'database_*.sql.gz' | head -n1 || true)"
    data_file="$(find "${backup_dir}" -maxdepth 1 -type f -name 'project_data_*.tar.gz' | head -n1 || true)"
    env_file="$(find "${backup_dir}" -maxdepth 1 -type f -name 'env_*.backup' | head -n1 || true)"
    manifest_file="$(find "${backup_dir}" -maxdepth 1 -type f -name 'manifest_*.txt' | head -n1 || true)"
    sha_file="${backup_dir}/SHA256SUMS"

    [[ -n "${db_file}" && -f "${db_file}" && -s "${db_file}" ]] || return 1
    [[ -n "${data_file}" && -f "${data_file}" && -s "${data_file}" ]] || return 1
    [[ -n "${env_file}" && -f "${env_file}" && -s "${env_file}" ]] || return 1
    [[ -n "${manifest_file}" && -f "${manifest_file}" && -s "${manifest_file}" ]] || return 1
    [[ -f "${sha_file}" && -s "${sha_file}" ]] || return 1

    gzip -t "${db_file}" >/dev/null 2>&1 || return 1
    tar -tzf "${data_file}" >/dev/null 2>&1 || return 1
    (cd "${backup_dir}" && sha256sum -c "SHA256SUMS" >/dev/null 2>&1) || return 1

    return 0
}

find_latest_valid_full_backup() {
    while IFS= read -r backup_dir; do
        [[ -n "${backup_dir}" ]] || continue
        if validate_completed_backup_dir "${backup_dir}"; then
            echo "${backup_dir}"
            return 0
        fi
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot' ! -name '*.incomplete' | sort -r)

    return 1
}

cleanup_completed_full_snapshots() {
    local keep_count="$1"
    local current_final_dir="$2"
    local kept=0

    while IFS= read -r backup_dir; do
        [[ -n "${backup_dir}" ]] || continue
        [[ -d "${backup_dir}" ]] || continue

        if [[ -n "${current_final_dir}" && "${backup_dir}" == "${current_final_dir}" ]]; then
            (( kept++ )) || true
            continue
        fi

        if (( kept < keep_count )); then
            (( kept++ )) || true
            continue
        fi

        remove_dir_best_effort "${backup_dir}" "full-snapshot"
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot' ! -name '*.incomplete' -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
}

cleanup_stale_incomplete_backups() {
    local ttl_hours="$1"
    local current_incomplete_dir="$2"
    local now cutoff_seconds age_seconds inc_mtime

    now="$(date +%s)"
    cutoff_seconds="$(( ttl_hours * 3600 ))"

    while IFS= read -r inc_dir; do
        [[ -n "${inc_dir}" ]] || continue
        [[ -d "${inc_dir}" ]] || continue

        if [[ -n "${current_incomplete_dir}" && "${inc_dir}" == "${current_incomplete_dir}" ]]; then
            continue
        fi

        inc_mtime="$(stat -c %Y "${inc_dir}" 2>/dev/null || echo "${now}")"
        age_seconds="$(( now - inc_mtime ))"
        if (( age_seconds < cutoff_seconds )); then
            continue
        fi

        remove_dir_best_effort "${inc_dir}" "stale-incomplete"
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot.incomplete' | sort)
}

cleanup_runtime_backups_by_prefix() {
    local prefix="$1"
    local keep_count="$2"
    local kept=0

    while IFS= read -r runtime_dir; do
        [[ -n "${runtime_dir}" ]] || continue

        if (( kept < keep_count )); then
            (( kept++ )) || true
            (( RUNTIME_DIRS_KEPT++ )) || true
            continue
        fi

        remove_dir_best_effort "${runtime_dir}" "runtime-${prefix}"
    done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name "${prefix}*" -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
}

cleanup_misc_loose_files() {
    local file_pattern
    for file_pattern in 'pre_seeder_backup_*' 'db_backup_*' 'laravel_react_*' 'pre_deploy_*.manifest' '*.sql.gz' '*.tar.gz' '*.dump'; do
        local kept=0
        while IFS= read -r loose_file; do
            [[ -n "${loose_file}" ]] || continue
            [[ -f "${loose_file}" ]] || continue

            if (( kept < 1 )); then
                (( kept++ )) || true
                continue
            fi

            if is_owned_or_writable "${loose_file}"; then
                remove_file_best_effort "${loose_file}" "misc"
            else
                warn "Skipping misc file cleanup (not owned/writable): ${loose_file}"
            fi
        done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type f -name "${file_pattern}" -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
    done
}

write_manifest_and_sha() {
    local dry_run_mode="$1"
    local cleanup_mode="$2"

    {
        echo "timestamp=${TIMESTAMP}"
        echo "hostname=$(hostname)"
        echo "user=$(whoami)"
        echo "project_root=${PROJECT_ROOT}"
        echo "backup_root=${BACKUP_ROOT}"
        echo "backup_dir=${BACKUP_DIR}"
        echo "dry_run=${dry_run_mode}"
        echo "cleanup_only=${cleanup_mode}"
        echo "git_branch=$(git -C "${PROJECT_ROOT}" branch --show-current 2>/dev/null || echo unknown)"
        echo "git_head=$(git -C "${PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"
        echo "db_connection=${DB_CONNECTION:-n/a}"
        echo "db_database=${DB_DATABASE:-n/a}"
        echo "backup_keep_count=${BACKUP_KEEP_COUNT}"
        echo "runtime_backup_keep_count=${RUNTIME_BACKUP_KEEP_COUNT}"
        echo
        echo "[warnings]"
        if [[ "${#WARNINGS[@]}" -eq 0 ]]; then
            echo "none"
        else
            printf '%s\n' "${WARNINGS[@]}"
        fi
    } > "${MANIFEST_FILE}"

    # Exclude manifest from SHA file list to avoid self-referential mismatch.
    # Generate relative paths so checksum file remains valid after .incomplete -> final rename.
    (
        cd "${BACKUP_DIR}"
        find . -maxdepth 1 -type f ! -name 'SHA256SUMS' ! -name 'manifest_*.txt' -printf '%P\0' | xargs -0 sha256sum > "SHA256SUMS"
    )

    {
        echo
        echo "[sha256sum]"
        cat "${BACKUP_DIR}/SHA256SUMS"
        echo
        echo "[cleanup_summary]"
        echo "full_snapshots_removed=${FULL_SNAPSHOTS_REMOVED}"
        echo "stale_incomplete_removed=${STALE_INCOMPLETE_REMOVED}"
        echo "runtime_dirs_kept=${RUNTIME_DIRS_KEPT}"
        echo "runtime_dirs_removed=${RUNTIME_DIRS_REMOVED}"
        echo "runtime_dirs_failed=${RUNTIME_DIRS_FAILED}"
        echo "misc_files_removed=${MISC_FILES_REMOVED}"
    } >> "${MANIFEST_FILE}"

    TOTAL_SIZE="$(du -sh "${BACKUP_DIR}" | awk '{print $1}')"
}

cleanup_old_backups() {
    cleanup_completed_full_snapshots "${BACKUP_KEEP_COUNT}" "${BACKUP_DIR_FINAL}"
    cleanup_stale_incomplete_backups "${INCOMPLETE_TTL_HOURS}" "${BACKUP_DIR}"
    cleanup_runtime_backups_by_prefix "nav_fix_" "${RUNTIME_BACKUP_KEEP_COUNT}"
    cleanup_runtime_backups_by_prefix "nginx_ssl_fix_" "${RUNTIME_BACKUP_KEEP_COUNT}"
    cleanup_runtime_backups_by_prefix "dev_before_prod_sync_" 1
    cleanup_misc_loose_files
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
[[ "${RUNTIME_BACKUP_KEEP_COUNT}" =~ ^[1-9][0-9]*$ ]] || err "RUNTIME_BACKUP_KEEP_COUNT must be a positive integer"
[[ "${INCOMPLETE_TTL_HOURS}" =~ ^[1-9][0-9]*$ ]] || err "INCOMPLETE_TTL_HOURS must be a positive integer"

assert_safe_backup_root
check_projected_disk_space

if [[ "${CLEANUP_ONLY}" == "1" ]]; then
    log "Cleanup-only mode started (dry_run=${DRY_RUN})."
    cleanup_completed_full_snapshots "${BACKUP_KEEP_COUNT}" ""
    cleanup_stale_incomplete_backups "${INCOMPLETE_TTL_HOURS}" ""
    cleanup_runtime_backups_by_prefix "nav_fix_" "${RUNTIME_BACKUP_KEEP_COUNT}"
    cleanup_runtime_backups_by_prefix "nginx_ssl_fix_" "${RUNTIME_BACKUP_KEEP_COUNT}"
    cleanup_runtime_backups_by_prefix "dev_before_prod_sync_" 1
    cleanup_misc_loose_files

    echo "[backup_prod] Cleanup-only summary:"
    echo "[backup_prod] full_snapshots_removed=${FULL_SNAPSHOTS_REMOVED}"
    echo "[backup_prod] stale_incomplete_removed=${STALE_INCOMPLETE_REMOVED}"
    echo "[backup_prod] runtime_dirs_kept=${RUNTIME_DIRS_KEPT}"
    echo "[backup_prod] runtime_dirs_removed=${RUNTIME_DIRS_REMOVED}"
    echo "[backup_prod] runtime_dirs_failed=${RUNTIME_DIRS_FAILED}"
    echo "[backup_prod] misc_files_removed=${MISC_FILES_REMOVED}"
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
        SQLITE_PATH="${DB_DATABASE}"
        [[ "${SQLITE_PATH}" == /* ]] || SQLITE_PATH="${PROJECT_ROOT}/${SQLITE_PATH}"
        [[ -f "${SQLITE_PATH}" ]] || err "SQLite DB not found: ${SQLITE_PATH}"
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

    write_manifest_and_sha 1 0
    log "Dry-run validation completed. Removing temporary backup dir: ${BACKUP_DIR}"
    rm -rf "${BACKUP_DIR}"
    exit 0
fi

if [[ "${DB_CONNECTION}" == "sqlite" ]]; then
    [[ -n "${DB_DATABASE}" ]] || err "DB_DATABASE is empty for sqlite"
    SQLITE_PATH="${DB_DATABASE}"
    [[ "${SQLITE_PATH}" == /* ]] || SQLITE_PATH="${PROJECT_ROOT}/${SQLITE_PATH}"
    [[ -f "${SQLITE_PATH}" ]] || err "SQLite DB file not found: ${SQLITE_PATH}"

    SQLITE_COPY="${BACKUP_DIR}/database_${TIMESTAMP}.sqlite"
    DB_BACKUP_FILE="${SQLITE_COPY}.gz"
    cp "${SQLITE_PATH}" "${SQLITE_COPY}"
    "${GZIP_CMD[@]}" < "${SQLITE_COPY}" > "${DB_BACKUP_FILE}"
    rm -f "${SQLITE_COPY}"
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

[[ -f "${DB_BACKUP_FILE}" && -s "${DB_BACKUP_FILE}" ]] || err "Database backup missing or empty: ${DB_BACKUP_FILE}"
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
tar_exit="$?"
set -e

if [[ "${tar_exit}" -eq 0 ]]; then
    log "project_data archive created successfully."
elif [[ "${tar_exit}" -eq 1 ]] && grep -Eq 'file changed as we read it|File removed before we read it|Cannot stat' "${TAR_WARNING_LOG}"; then
    warn "tar returned non-fatal warning exit code 1. Archive accepted. See ${TAR_WARNING_LOG}"
else
    err "tar failed with exit code ${tar_exit}. See ${TAR_WARNING_LOG}"
fi

# Rarely, tar may report success but the archive file is missing/empty (e.g. interrupted or writer race).
# Retry once with classic -czf as a safe fallback before failing hard.
if [[ ! -f "${PROJECT_DATA_ARCHIVE_FILE}" || ! -s "${PROJECT_DATA_ARCHIVE_FILE}" ]]; then
    warn "Primary archive output missing/empty, retrying with fallback tar -czf."
    tar -czf "${PROJECT_DATA_ARCHIVE_FILE}" \
        -C "${PROJECT_ROOT}" \
        --warning=no-file-changed \
        --ignore-failed-read \
        --exclude='.git' \
        --exclude='backups' \
        --exclude='node_modules' \
        --exclude='vendor' \
        --exclude='.env' \
        --exclude='.DS_Store' \
        "${PROJECT_DATA_ITEMS[@]}" >> "${TAR_WARNING_LOG}" 2>&1 || err "Fallback tar failed. See ${TAR_WARNING_LOG}"
fi

[[ -f "${PROJECT_DATA_ARCHIVE_FILE}" && -s "${PROJECT_DATA_ARCHIVE_FILE}" ]] || err "Project data archive missing or empty: ${PROJECT_DATA_ARCHIVE_FILE}"
tar -tzf "${PROJECT_DATA_ARCHIVE_FILE}" >/dev/null || err "Project data archive corrupted: ${PROJECT_DATA_ARCHIVE_FILE}"

write_manifest_and_sha 0 0

cat > "${METADATA_JSON_FILE}" <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "backup_dir": "${BACKUP_DIR}",
    "project_root": "${PROJECT_ROOT}",
    "db_connection": "${DB_CONNECTION}",
    "db_database": "${DB_DATABASE}",
    "dry_run": false,
    "backup_keep_count": ${BACKUP_KEEP_COUNT},
    "runtime_backup_keep_count": ${RUNTIME_BACKUP_KEEP_COUNT},
    "warnings": ${#WARNINGS[@]}
}
EOF

validate_completed_backup_dir "${BACKUP_DIR}" 1 || err "Backup validation failed before finalization. Inspect ${BACKUP_DIR}"

log "Backup files validated. Renaming .incomplete -> final..."
mv "${BACKUP_DIR}" "${BACKUP_DIR_FINAL}"
BACKUP_DIR="${BACKUP_DIR_FINAL}"
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"
DB_BACKUP_FILE="${BACKUP_DIR}/$(basename "${DB_BACKUP_FILE}")"
PROJECT_DATA_ARCHIVE_FILE="${BACKUP_DIR}/$(basename "${PROJECT_DATA_ARCHIVE_FILE}")"
ENV_BACKUP_FILE="${BACKUP_DIR}/$(basename "${ENV_BACKUP_FILE}")"

validate_completed_backup_dir "${BACKUP_DIR}" || err "Final backup validation failed after rename. Inspect ${BACKUP_DIR}"

cleanup_old_backups

{
    echo
    echo "[post_cleanup_summary]"
    echo "full_snapshots_removed=${FULL_SNAPSHOTS_REMOVED}"
    echo "stale_incomplete_removed=${STALE_INCOMPLETE_REMOVED}"
    echo "runtime_dirs_kept=${RUNTIME_DIRS_KEPT}"
    echo "runtime_dirs_removed=${RUNTIME_DIRS_REMOVED}"
    echo "runtime_dirs_failed=${RUNTIME_DIRS_FAILED}"
    echo "runtime_cleanup_warnings=${RUNTIME_WARNING_COUNT}"
    echo "misc_files_removed=${MISC_FILES_REMOVED}"
} >> "${MANIFEST_FILE}"

    (
        cd "${BACKUP_DIR}"
        find . -maxdepth 1 -type f ! -name 'SHA256SUMS' ! -name 'manifest_*.txt' -printf '%P\0' | xargs -0 sha256sum > "SHA256SUMS"
    )

LATEST_VALID_BACKUP="$(find_latest_valid_full_backup || true)"
[[ -n "${LATEST_VALID_BACKUP}" ]] || err "No valid completed full snapshot found after backup and cleanup"

TOTAL_SIZE="$(du -sh "${BACKUP_DIR}" | awk '{print $1}')"

echo ""
echo "============================================================"
echo " Backup completed successfully"
echo "============================================================"
echo " backup_dir=${BACKUP_DIR}"
echo " database_path=${DB_BACKUP_FILE}"
echo " project_data_path=${PROJECT_DATA_ARCHIVE_FILE}"
echo " env_backup_path=${ENV_BACKUP_FILE}"
echo " manifest_path=${MANIFEST_FILE}"
echo " metadata_path=${BACKUP_DIR}/$(basename "${METADATA_JSON_FILE}")"
echo " sha256_path=${BACKUP_DIR}/SHA256SUMS"
echo " total_size=${TOTAL_SIZE}"
echo " full_snapshots_removed=${FULL_SNAPSHOTS_REMOVED}"
echo " stale_incomplete_removed=${STALE_INCOMPLETE_REMOVED}"
echo " runtime_dirs_kept=${RUNTIME_DIRS_KEPT}"
echo " runtime_dirs_removed=${RUNTIME_DIRS_REMOVED}"
echo " runtime_dirs_failed=${RUNTIME_DIRS_FAILED}"
echo " runtime_cleanup_warnings=${RUNTIME_WARNING_COUNT}"
echo " misc_files_removed=${MISC_FILES_REMOVED}"
if [[ "${RUNTIME_WARNING_COUNT}" -gt 0 ]]; then
    echo " runtime_warning_paths=$(printf '%s ' "${RUNTIME_WARNINGS[@]}" | sed 's/[[:space:]]\+$//')"
fi
if [[ "${#WARNINGS[@]}" -gt 0 ]]; then
    echo " warnings_count=${#WARNINGS[@]}"
fi

if [[ -n "${BACKUP_OFFSITE_HOOK}" ]]; then
    if [[ -x "${BACKUP_OFFSITE_HOOK}" ]]; then
        if "${BACKUP_OFFSITE_HOOK}" "${BACKUP_DIR}"; then
            echo " offsite_hook=success (${BACKUP_OFFSITE_HOOK})"
        else
            echo " offsite_hook=failed (${BACKUP_OFFSITE_HOOK})"
        fi
    else
        echo " offsite_hook=not_executable (${BACKUP_OFFSITE_HOOK})"
    fi
fi
echo "============================================================"

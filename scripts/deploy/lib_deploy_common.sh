#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="${LOG_PREFIX:-[deploy]}"
PROD_ROOT_DEFAULT="/var/www/laravel-react"
DEV_ROOT_DEFAULT="/var/www/laravel-react-dev"
DEPLOY_LOCK_FILE_DEFAULT="/var/lock/kazutb-deploy.lock"

if [[ ! -w "$(dirname "$DEPLOY_LOCK_FILE_DEFAULT")" ]]; then
    DEPLOY_LOCK_FILE_DEFAULT="/tmp/kazutb-deploy.lock"
fi

SCRIPT_LOCK_FILE="${DEPLOY_LOCK_FILE:-$DEPLOY_LOCK_FILE_DEFAULT}"
SCRIPT_LOCK_META_FILE="${SCRIPT_LOCK_FILE}.meta"

log() {
    echo "${LOG_PREFIX} $*"
}

warn() {
    echo "${LOG_PREFIX} WARN: $*" >&2
}

fail() {
    echo "${LOG_PREFIX} ERROR: $*" >&2
    exit 1
}

current_ts() {
    date +%Y%m%d_%H%M%S
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command missing: $1"
}

require_path() {
    local expected_path="$1"
    local current_path
    current_path="$(pwd)"
    [[ "$current_path" == "$expected_path" ]] || fail "Wrong path: $current_path (expected $expected_path)"
}

require_release_routed_via_deploy() {
    local expected_dev_root="${1:-$DEV_ROOT_DEFAULT}"
    if [[ "${DEPLOY_ROUTED_BY_ENTRYPOINT:-0}" != "1" ]]; then
        fail "Direct execution blocked. Run release from ${expected_dev_root}: ./scripts/deploy/deploy.sh release --dry-run"
    fi

    if [[ "${DEPLOY_ENTRYPOINT_ROOT:-}" != "$expected_dev_root" ]]; then
        fail "Release routing context invalid. Re-run from ${expected_dev_root}: ./scripts/deploy/deploy.sh release --dry-run"
    fi
}

require_branch() {
    local expected="$1"
    local branch
    branch="$(git branch --show-current)"
    [[ "$branch" == "$expected" ]] || fail "Expected branch '$expected', got '$branch'"
}

git_status_report() {
    git status --short || true
}

require_clean_git_or_checkpoint() {
    local repo_root="$1"
    local mode="${2:-fail}"
    local status
    status="$(git -C "$repo_root" status --short || true)"
    if [[ -z "$status" ]]; then
        return 0
    fi

    case "$mode" in
        fail)
            fail "Repo not clean: $repo_root"
            ;;
        warn)
            warn "Repo not clean: $repo_root"
            ;;
        *)
            fail "Unknown require_clean_git_or_checkpoint mode: $mode"
            ;;
    esac
}

ensure_no_sensitive_tracked() {
    local repo_root="$1"
    local tracked
    tracked="$(git -C "$repo_root" ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.|^backups/|\.sql$|\.sql\.gz$|\.dump$|\.tar\.gz$|^vendor/|^node_modules/|^skills/' | grep -Ev '(^|/)\.env\.example$' || true)"
    [[ -z "$tracked" ]] || fail "Sensitive tracked files found in $repo_root:\n$tracked"
}

ensure_no_forbidden_commands() {
    local file="$1"
    grep -nE 'php artisan migrate:fresh|php artisan migrate:refresh|php artisan migrate:reset|php artisan migrate:rollback|php artisan db:wipe|php artisan db:seed|php artisan test|migrate --seed' "$file" >/dev/null 2>&1 && fail "Forbidden command found in $file" || true
}

create_git_checkpoint_branch() {
    local repo_root="$1"
    local prefix="$2"
    local name="${prefix}-$(current_ts)"
    git -C "$repo_root" branch "$name"
    echo "$name"
}

create_git_checkpoint_tag() {
    local repo_root="$1"
    local prefix="$2"
    local name="${prefix}-$(current_ts)"
    git -C "$repo_root" tag "$name"
    echo "$name"
}

backup_env_file() {
    local project_root="$1"
    local destination="$2"
    [[ -f "$project_root/.env" ]] || fail ".env not found in $project_root"
    cp "$project_root/.env" "$destination"
    chmod 600 "$destination"
}

check_env_key_readable_by_www_data() {
    local project_root="$1"
    local env_file="$project_root/.env"
    [[ -f "$env_file" ]] || fail ".env missing: $env_file"

    local key_line
    key_line="$(grep -E '^APP_KEY=' "$env_file" | tail -n1 || true)"
    [[ -n "$key_line" ]] || fail "APP_KEY missing in $env_file"
    local key_value="${key_line#*=}"
    [[ -n "$key_value" ]] || fail "APP_KEY is empty in $env_file"

    local owner group perms
    owner="$(stat -c '%U' "$env_file")"
    group="$(stat -c '%G' "$env_file")"
    perms="$(stat -c '%a' "$env_file")"

    if [[ "$owner" == "www-data" || "$group" == "www-data" ]]; then
        :
    else
        fail ".env is not associated with www-data (owner=$owner group=$group, perms=$perms)"
    fi
}

check_storage_permissions() {
    local project_root="$1"
    [[ -d "$project_root/storage" ]] || fail "Missing storage dir in $project_root"
    [[ -d "$project_root/bootstrap/cache" ]] || fail "Missing bootstrap/cache dir in $project_root"
    [[ -w "$project_root/storage" ]] || fail "storage is not writable in $project_root"
    [[ -w "$project_root/bootstrap/cache" ]] || fail "bootstrap/cache is not writable in $project_root"
}

check_public_build() {
    local project_root="$1"
    [[ -f "$project_root/public/build/manifest.json" ]] || fail "public/build/manifest.json missing in $project_root"
}

check_laravel_health() {
    local project_root="$1"
    (cd "$project_root" && php artisan about >/dev/null)
}

list_diff_name_status() {
    local repo_root="$1"
    local base_ref="$2"
    local head_ref="$3"
    git -C "$repo_root" diff --name-status "$base_ref..$head_ref"
}

_detect_protected_path() {
    local path="$1"
    [[ "$path" == scripts/backup_prod.sh ]] && return 0
    [[ "$path" == scripts/deploy/* ]] && return 0
    [[ "$path" == scripts/git-hooks/* ]] && return 0
    [[ "$path" == docs/deployment.md ]] && return 0
    [[ "$path" == docs/backup.md ]] && return 0
    [[ "$path" == .gitignore ]] && return 0
    [[ "$path" == composer.json ]] && return 0
    [[ "$path" == composer.lock ]] && return 0
    [[ "$path" == package.json ]] && return 0
    [[ "$path" == package-lock.json ]] && return 0
    [[ "$path" == vite.config.js ]] && return 0
    [[ "$path" == config/* ]] && return 0
    return 1
}

detect_protected_deletions() {
    local repo_root="$1"
    local base_ref="$2"
    local head_ref="$3"
    local out=""

    while IFS=$'\t' read -r status p1 p2; do
        [[ -n "$status" ]] || continue
        if [[ "$status" == D ]]; then
            if _detect_protected_path "$p1"; then
                out+="$p1"$'\n'
            fi
        fi
        if [[ "$status" == R* ]]; then
            if _detect_protected_path "$p1"; then
                out+="$p1"$'\n'
            fi
        fi
    done < <(git -C "$repo_root" diff --name-status "$base_ref..$head_ref")

    printf '%s' "$out"
}

detect_dangerous_migrations() {
    local repo_root="$1"
    local base_ref="$2"
    local head_ref="$3"
    local out=""

    while IFS= read -r f; do
        [[ -n "$f" ]] || continue
        [[ "$f" == database/migrations/*.php ]] || continue
        local content
        content="$(git -C "$repo_root" show "$head_ref:$f" 2>/dev/null || true)"
        [[ -n "$content" ]] || continue
        local upblock
        upblock="$(awk '/function up\(\)[: ]*void/ {in_up=1} /function down\(\)[: ]*void/ {in_up=0} in_up {print}' <<< "$content")"

        # Block explicit destructive/structural operations in up().
        if grep -nE 'dropTable|dropColumn|Schema::drop|Schema::dropIfExists|truncate|delete\(|renameColumn|change\(' <<< "$upblock" >/dev/null; then
            out+="$f"$'\n'
            continue
        fi

        # DB::statement is blocked by default; allow only one audited safe SQL shape.
        local db_lines db_line sql_literal normalized
        db_lines="$(grep -nE 'DB::statement\(' <<< "$upblock" || true)"

        if [[ -n "$db_lines" ]]; then
            while IFS= read -r db_line; do
                [[ -n "$db_line" ]] || continue

                sql_literal="$(sed -E "s/^[0-9]+:[[:space:]]*.*DB::statement\([[:space:]]*'([^']*)'.*$/\1/" <<< "$db_line")"
                if [[ "$sql_literal" == "$db_line" ]]; then
                    # Could not safely parse the SQL literal; treat as dangerous.
                    out+="$f"$'\n'
                    break
                fi

                normalized="$(tr '[:upper:]' '[:lower:]' <<< "$sql_literal" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"

                if [[ "$normalized" =~ ^alter[[:space:]]+table[[:space:]]+students[[:space:]]+modify[[:space:]]+group_id[[:space:]]+bigint[[:space:]]+unsigned[[:space:]]+null$ ]]; then
                    continue
                fi

                out+="$f"$'\n'
                break
            done <<< "$db_lines"
        fi
    done < <(git -C "$repo_root" diff --name-only "$base_ref..$head_ref")

    printf '%s' "$out"
}

detect_changed_seeders() {
    local repo_root="$1"
    local base_ref="$2"
    local head_ref="$3"
    git -C "$repo_root" diff --name-only "$base_ref..$head_ref" -- 'database/seeders/*.php' 2>/dev/null || true
}

_migration_pending_signal() {
    local project_root="$1"
    local status_output
    status_output="$(cd "$project_root" && php artisan migrate:status 2>/dev/null || true)"
    if grep -Eq '\|\s+N\s+\|' <<< "$status_output"; then
        echo "YES"
    elif grep -Eq '\|\s+Y\s+\|' <<< "$status_output"; then
        echo "NO"
    else
        echo "UNKNOWN"
    fi
}

_rollback_feasibility_signal() {
    local repo_root="$1"
    local base_ref="$2"
    local head_ref="$3"
    local migration_changes dangerous_changes

    migration_changes="$(git -C "$repo_root" diff --name-only "$base_ref..$head_ref" -- 'database/migrations/*.php' 2>/dev/null || true)"
    dangerous_changes="$(detect_dangerous_migrations "$repo_root" "$base_ref" "$head_ref" || true)"

    if [[ -n "$dangerous_changes" ]]; then
        echo "HIGH (dangerous migration pattern detected)"
    elif [[ -n "$migration_changes" ]]; then
        echo "MEDIUM (new migrations require rollback planning)"
    else
        echo "LOW (no migration file changes in release diff)"
    fi
}

print_migration_preflight() {
    local project_root="$1"
    local base_ref="${2:-origin/main}"
    local head_ref="${3:-origin/dev}"
    local pending_signal rollback_signal migration_changes

    pending_signal="$(_migration_pending_signal "$project_root")"
    rollback_signal="$(_rollback_feasibility_signal "$project_root" "$base_ref" "$head_ref")"
    migration_changes="$(git -C "$project_root" diff --name-only "$base_ref..$head_ref" -- 'database/migrations/*.php' 2>/dev/null || true)"

    echo ""
    echo "=== Migration Preflight ==="
    echo "pending migration: ${pending_signal}"
    echo "rollback-feasibility: ${rollback_signal}"
    if [[ -n "$migration_changes" ]]; then
        echo "migration files in ${base_ref}..${head_ref}:"
        echo "$migration_changes"
    else
        echo "migration files in ${base_ref}..${head_ref}: <none>"
    fi
    echo "==========================="
}

check_node_version() {
    local required_major="${1:-20}"
    local required_minor="${2:-19}"
    if ! command -v node >/dev/null 2>&1; then
        warn "node not found in PATH; skipping version check"
        return 0
    fi
    local version
    version="$(node --version 2>/dev/null | sed 's/^v//')"
    local major minor
    major="$(printf '%s' "$version" | cut -d. -f1)"
    minor="$(printf '%s' "$version" | cut -d. -f2)"
    if [[ -z "$major" || -z "$minor" ]]; then
        warn "Could not parse node version: $version"
        return 0
    fi
    if [[ "$major" -lt "$required_major" ]] || \
       [[ "$major" -eq "$required_major" && "$minor" -lt "$required_minor" ]]; then
        warn "Node version is v${version}; Vite requires >= ${required_major}.${required_minor}. Build may still succeed but upgrade is recommended."
        return 1
    fi
    return 0
}

redact_command_for_log() {
    local cmd="$*"
    cmd="$(printf '%s' "$cmd" | sed -E "s/MYSQL_PWD='[^']*'/MYSQL_PWD='[REDACTED]'/g")"
    cmd="$(printf '%s' "$cmd" | sed -E 's/MYSQL_PWD="[^"]*"/MYSQL_PWD="[REDACTED]"/g')"
    cmd="$(printf '%s' "$cmd" | sed -E 's/(DB_PASSWORD=)[^[:space:]]+/\1[REDACTED]/g')"
    cmd="$(printf '%s' "$cmd" | sed -E 's/(APP_KEY=)[^[:space:]]+/\1[REDACTED]/g')"
    printf '%s' "$cmd"
}

validate_completed_backup_dir() {
    local backup_dir="$1"
    local db_file data_file env_file manifest_file sha_file

    [[ -d "$backup_dir" ]] || return 1
    [[ "$backup_dir" != *.incomplete ]] || return 1

    db_file="$(find "$backup_dir" -maxdepth 1 -type f -name 'database_*.sql.gz' | head -n1 || true)"
    data_file="$(find "$backup_dir" -maxdepth 1 -type f -name 'project_data_*.tar.gz' | head -n1 || true)"
    env_file="$(find "$backup_dir" -maxdepth 1 -type f -name 'env_*.backup' | head -n1 || true)"
    manifest_file="$(find "$backup_dir" -maxdepth 1 -type f -name 'manifest_*.txt' | head -n1 || true)"
    sha_file="$backup_dir/SHA256SUMS"

    [[ -n "$db_file" && -f "$db_file" && -s "$db_file" ]] || return 1
    [[ -n "$data_file" && -f "$data_file" && -s "$data_file" ]] || return 1
    [[ -n "$env_file" && -f "$env_file" && -s "$env_file" ]] || return 1
    [[ -n "$manifest_file" && -f "$manifest_file" && -s "$manifest_file" ]] || return 1
    [[ -f "$sha_file" && -s "$sha_file" ]] || return 1

    gzip -t "$db_file" >/dev/null 2>&1 || return 1
    tar -tzf "$data_file" >/dev/null 2>&1 || return 1

    return 0
}

find_latest_valid_full_backup() {
    local backup_root="$1"
    while IFS= read -r backup_dir; do
        [[ -n "$backup_dir" ]] || continue
        if validate_completed_backup_dir "$backup_dir"; then
            printf '%s' "$backup_dir"
            return 0
        fi
    done < <(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot' ! -name '*.incomplete' -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk '{print $2}')

    return 1
}

print_recovery_instructions() {
    local checkpoint_branch="$1"
    local checkpoint_tag="$2"
    local backup_dir="$3"

    cat <<EOF
Recovery instructions:
- checkpoint_branch: $checkpoint_branch
- checkpoint_tag: $checkpoint_tag
- backup_dir: $backup_dir
- local restore command: git checkout dev && git reset --hard ${checkpoint_branch}
EOF
}

begin_operation_lock() {
    local op_name="$1"

    if [[ "${DEPLOY_LOCK_HELD:-0}" == "1" ]]; then
        log "Lock already held by router operation: ${DEPLOY_LOCK_OPERATION:-unknown}"
        return 0
    fi

    touch "$SCRIPT_LOCK_FILE"
    exec {SCRIPT_OPERATION_LOCK_FD}>"$SCRIPT_LOCK_FILE"
    if ! flock -n "$SCRIPT_OPERATION_LOCK_FD"; then
        fail "Another deployment operation is active. lock_file=${SCRIPT_LOCK_FILE}"
    fi

    cat > "$SCRIPT_LOCK_META_FILE" <<EOF
operation=${op_name}
owner=$(whoami)
pid=$$
host=$(hostname)
started_at=$(date -Iseconds)
cwd=$(pwd)
source=direct-script
EOF

    export SCRIPT_OPERATION_LOCK_OWNED=1
}

end_operation_lock() {
    if [[ "${DEPLOY_LOCK_HELD:-0}" == "1" ]]; then
        return 0
    fi

    if [[ "${SCRIPT_OPERATION_LOCK_OWNED:-0}" == "1" ]]; then
        rm -f "$SCRIPT_LOCK_META_FILE" || true
        flock -u "$SCRIPT_OPERATION_LOCK_FD" || true
        eval "exec ${SCRIPT_OPERATION_LOCK_FD}>&-" || true
        unset SCRIPT_OPERATION_LOCK_OWNED
    fi
}

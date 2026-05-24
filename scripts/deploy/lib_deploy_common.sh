#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="${LOG_PREFIX:-[deploy]}"
PROD_ROOT_DEFAULT="/var/www/laravel-react"
DEV_ROOT_DEFAULT="/var/www/laravel-react-dev"

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
        if grep -nE 'dropTable|dropColumn|Schema::drop|Schema::dropIfExists|truncate|delete\(|DB::statement|renameColumn|change\(' <<< "$upblock" >/dev/null; then
            out+="$f"$'\n'
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

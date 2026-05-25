#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="[safety]"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib_deploy_common.sh"

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
BACKUP_SCRIPT="${PROD_ROOT}/scripts/backup_prod.sh"
EXPECTED_FREE_GB=20

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
    echo "PASS: $*"
    (( PASS_COUNT++ )) || true
}

warn_item() {
    echo "WARN: $*"
    (( WARN_COUNT++ )) || true
}

fail_item() {
    echo "FAIL: $*"
    (( FAIL_COUNT++ )) || true
}

safe_check() {
    local msg="$1"
    shift
    if "$@"; then
        pass "$msg"
    else
        fail_item "$msg"
    fi
}

[[ -d "$PROD_ROOT" ]] || fail "PROD root not found: $PROD_ROOT"
[[ -d "$DEV_ROOT" ]] || fail "DEV root not found: $DEV_ROOT"

if [[ -z "$(git -C "$PROD_ROOT" status --short || true)" ]]; then
    pass "PROD git status is clean"
else
    fail_item "PROD git status is not clean"
fi

if [[ -z "$(git -C "$DEV_ROOT" status --short || true)" ]]; then
    pass "DEV git status is clean"
else
    warn_item "DEV git status has changes (intentional local work may exist)"
fi

[[ "$(git -C "$PROD_ROOT" branch --show-current)" == "main" ]] && pass "PROD branch is main" || fail_item "PROD branch is not main"
[[ "$(git -C "$DEV_ROOT" branch --show-current)" == "dev" ]] && pass "DEV branch is dev" || fail_item "DEV branch is not dev"

if git -C "$PROD_ROOT" remote get-url origin >/dev/null 2>&1 && git -C "$DEV_ROOT" remote get-url origin >/dev/null 2>&1; then
    pass "origin remotes are configured"
else
    fail_item "origin remote is missing in PROD or DEV"
fi

if git -C "$PROD_ROOT" fetch origin --quiet >/dev/null 2>&1 && git -C "$DEV_ROOT" fetch origin --quiet >/dev/null 2>&1; then
    pass "origin fetch works for PROD and DEV"
else
    warn_item "Could not fetch origin for one of repositories"
fi

if ensure_no_sensitive_tracked "$PROD_ROOT" >/dev/null 2>&1; then
    pass "No sensitive tracked files in PROD"
else
    fail_item "Sensitive tracked files found in PROD"
fi

if ensure_no_sensitive_tracked "$DEV_ROOT" >/dev/null 2>&1; then
    pass "No sensitive tracked files in DEV"
else
    fail_item "Sensitive tracked files found in DEV"
fi

[[ -x "$BACKUP_SCRIPT" ]] && pass "Backup script exists and executable" || fail_item "Backup script missing or not executable"

avail_gb="$(df -BG "$PROD_ROOT" | awk 'NR==2 {gsub(/G/,"",$4); print $4}')"
if [[ -n "$avail_gb" && "$avail_gb" -ge "$EXPECTED_FREE_GB" ]]; then
    pass "Disk free space is ${avail_gb}G (>= ${EXPECTED_FREE_GB}G)"
else
    fail_item "Disk free space below ${EXPECTED_FREE_GB}G"
fi

mapfile -t _completed_backups < <(find "$PROD_ROOT/backups" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot' ! -name '*.incomplete' -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk '{print $2}')
mapfile -t _incomplete_backups < <(find "$PROD_ROOT/backups" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot.incomplete' -printf '%T@ %p\n' 2>/dev/null | sort -nr)

if [[ "${#_incomplete_backups[@]}" -gt 0 ]]; then
    _now_ts="$(date +%s)"
    _incomplete_ttl="$((24 * 3600))"
    for _inc in "${_incomplete_backups[@]}"; do
        _inc_path="${_inc#* }"
        _inc_mtime="${_inc%% *}"
        _inc_age="$((_now_ts - ${_inc_mtime%.*}))"
        if [[ "$_inc_age" -gt "$_incomplete_ttl" ]]; then
            warn_item "Stale .incomplete backup exists (>24h): $(basename "$_inc_path")"
        else
            warn_item "Current .incomplete backup exists (<24h): $(basename "$_inc_path")"
        fi
    done
fi

if [[ "${#_completed_backups[@]}" -eq 0 ]]; then
    fail_item "No completed PROD full snapshot found"
else
    _latest_backup="${_completed_backups[0]}"
    _latest_valid=0
    _first_valid_backup=""

    if validate_completed_backup_dir "$_latest_backup"; then
        _latest_valid=1
        _first_valid_backup="$_latest_backup"
        pass "Latest PROD backup valid: $(basename "$_latest_backup")"
    else
        warn_item "Newest completed PROD backup is invalid: $(basename "$_latest_backup")"
    fi

    if [[ "$_latest_valid" -eq 0 ]]; then
        for _candidate in "${_completed_backups[@]:1}"; do
            if validate_completed_backup_dir "$_candidate"; then
                _first_valid_backup="$_candidate"
                warn_item "Latest backup invalid, but older valid snapshot exists: $(basename "$_candidate")"
                pass "Latest valid PROD backup found: $(basename "$_candidate")"
                break
            fi
        done
    fi

    if [[ -z "$_first_valid_backup" ]]; then
        fail_item "No valid completed PROD full snapshot exists"
    fi
fi

protected_deletes="$(detect_protected_deletions "$PROD_ROOT" origin/main origin/dev || true)"
if [[ -n "$protected_deletes" ]]; then
    fail_item "Protected deletions detected in origin/main..origin/dev"
    echo "$protected_deletes"
else
    pass "No protected deletions detected between main and dev"
fi

dangerous_migrations="$(detect_dangerous_migrations "$PROD_ROOT" origin/main origin/dev || true)"
if [[ -n "$dangerous_migrations" ]]; then
    fail_item "Dangerous migration patterns found in dev"
    echo "$dangerous_migrations"
else
    pass "No dangerous migration patterns in new migrations"
fi

changed_seeders="$(detect_changed_seeders "$PROD_ROOT" origin/main origin/dev || true)"
if [[ -n "$changed_seeders" ]]; then
    warn_item "Seeders changed between main and dev (must remain idempotent)"
    echo "$changed_seeders"
else
    pass "No changed seeders between main and dev"
fi

for script in \
    "$PROD_ROOT/scripts/deploy/dev_to_prod_release.sh" \
    "$PROD_ROOT/scripts/deploy/prod_to_dev_sync.sh" \
    "$PROD_ROOT/scripts/deploy/pre_deploy_prod_checkpoint.sh" \
    "$PROD_ROOT/scripts/deploy/rollback_prod_to_tag.sh"; do
    if [[ ! -f "$script" ]]; then
        fail_item "Deploy script missing: $script"
        continue
    fi

    if ensure_no_forbidden_commands "$script" >/dev/null 2>&1; then
        pass "No forbidden commands in $script"
    else
        fail_item "Forbidden commands found in $script"
    fi

done

if check_env_key_readable_by_www_data "$DEV_ROOT" >/dev/null 2>&1; then
    pass "DEV .env contains APP_KEY and is readable via www-data association"
else
    fail_item "DEV .env APP_KEY/readability check failed"
fi

if check_storage_permissions "$DEV_ROOT" >/dev/null 2>&1; then
    pass "DEV storage/bootstrap permissions look writable"
else
    fail_item "DEV storage/bootstrap permissions check failed"
fi

# Node version check — WARN only (Vite >= 20.19 recommended but build works on 18).
if check_node_version 20 19 2>/dev/null; then
    pass "Node version OK ($(node --version 2>/dev/null || echo 'n/a'))"
else
    warn_item "Node $(node --version 2>/dev/null || echo 'unknown') is below 20.19 required by Vite. npm run build may fail. Upgrade Node.js."
fi

# HTTP checks must reject 500. 200/301/302/401/403 are acceptable for this probe.
prod_root_code="$(curl -s -o /dev/null -w '%{http_code}' https://crm.kaztbu.edu.kz/ || true)"
dev_root_code="$(curl -s -o /dev/null -w '%{http_code}' https://dev-crm.kaztbu.edu.kz/ || true)"
dev_profile_code="$(curl -s -o /dev/null -w '%{http_code}' https://dev-crm.kaztbu.edu.kz/profile || true)"

[[ "$prod_root_code" == "500" ]] && fail_item "PROD / returned 500" || pass "PROD / HTTP code=${prod_root_code}"
[[ "$dev_root_code" == "500" ]] && fail_item "DEV / returned 500" || pass "DEV / HTTP code=${dev_root_code}"
[[ "$dev_profile_code" == "500" ]] && fail_item "DEV /profile returned 500" || pass "DEV /profile HTTP code=${dev_profile_code}"

if "$PROD_ROOT/scripts/deploy/ssl_guard_check.sh" >/dev/null 2>&1; then
    pass "ssl_guard_check.sh passed"
else
    fail_item "ssl_guard_check.sh failed"
fi

echo ""
echo "Summary: PASS=${PASS_COUNT}, WARN=${WARN_COUNT}, FAIL=${FAIL_COUNT}"
[[ "$FAIL_COUNT" -eq 0 ]]

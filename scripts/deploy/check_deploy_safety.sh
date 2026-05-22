#!/usr/bin/env bash
set -Eeuo pipefail

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
BACKUP_SCRIPT="${PROD_ROOT}/scripts/backup_prod.sh"
PRE_COMMIT_HOOK="${PROD_ROOT}/.git/hooks/pre-commit"
EXPECTED_FREE_GB=20

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
    echo "PASS: $*"
    (( PASS_COUNT++ )) || true
}

warn() {
    echo "WARN: $*"
    (( WARN_COUNT++ )) || true
}

fail() {
    echo "FAIL: $*"
    (( FAIL_COUNT++ )) || true
}

if [[ ! -d "$PROD_ROOT" ]]; then
    echo "FAIL: PROD root not found: $PROD_ROOT"
    exit 1
fi

if [[ ! -d "$DEV_ROOT" ]]; then
    echo "FAIL: DEV root not found: $DEV_ROOT"
    exit 1
fi

prod_status="$(git -C "$PROD_ROOT" status --short)"
if [[ -z "$prod_status" ]]; then
    pass "PROD git status is clean"
else
    fail "PROD git status is not clean"
fi

dev_status="$(git -C "$DEV_ROOT" status --short)"
if [[ -z "$dev_status" ]]; then
    pass "DEV git status is clean"
else
    warn "DEV git status has changes (refresh/deploy should handle intentionally)"
fi

prod_branch="$(git -C "$PROD_ROOT" branch --show-current)"
dev_branch="$(git -C "$DEV_ROOT" branch --show-current)"
[[ "$prod_branch" == "main" ]] && pass "PROD branch is main" || fail "PROD branch is $prod_branch (expected main)"
[[ "$dev_branch" == "main" || "$dev_branch" == "dev" ]] && pass "DEV branch is $dev_branch" || fail "DEV branch is $dev_branch (expected main/dev)"

tracked_sensitive="$(git -C "$PROD_ROOT" ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.|^backups/|\.sql$|\.sql\.gz$|\.dump$|\.tar\.gz$|^skills/' | grep -Ev '(^|/)\.env\.example$' || true)"
if [[ -z "$tracked_sensitive" ]]; then
    pass "No sensitive backup/env/sql files are tracked in PROD"
else
    fail "Sensitive tracked files detected in PROD:\n${tracked_sensitive}"
fi

[[ -f "$BACKUP_SCRIPT" ]] && pass "Backup script exists" || fail "Backup script missing: $BACKUP_SCRIPT"
[[ -x "$BACKUP_SCRIPT" ]] && pass "Backup script is executable" || warn "Backup script is not executable"

[[ -f "$PRE_COMMIT_HOOK" ]] && pass "pre-commit hook exists" || warn "pre-commit hook missing in PROD repo"
if source ~/.bashrc 2>/dev/null && command -v safecommit >/dev/null 2>&1; then
    pass "safecommit is available"
else
    warn "safecommit not found in current shell"
fi

avail_gb="$(df -BG "$PROD_ROOT" | awk 'NR==2 {gsub(/G/,"",$4); print $4}')"
if [[ -n "$avail_gb" && "$avail_gb" -ge "$EXPECTED_FREE_GB" ]]; then
    pass "Disk free space is ${avail_gb}G (>= ${EXPECTED_FREE_GB}G)"
else
    fail "Disk free space is below ${EXPECTED_FREE_GB}G"
fi

latest_backups="$(ls -1dt "$PROD_ROOT"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n2 || true)"
if [[ -n "$latest_backups" ]]; then
    pass "Latest PROD backups found"
    echo "$latest_backups"
else
    warn "No prod_backup_*_full_snapshot directories found"
fi

prod_head="$(git -C "$PROD_ROOT" rev-parse HEAD)"
dev_head="$(git -C "$DEV_ROOT" rev-parse HEAD)"
new_migrations="$(comm -13 \
    <(find "$PROD_ROOT/database/migrations" -maxdepth 1 -type f -name '*.php' -printf '%f\n' | sort) \
    <(find "$DEV_ROOT/database/migrations" -maxdepth 1 -type f -name '*.php' -printf '%f\n' | sort) || true)"

if [[ -n "$new_migrations" ]]; then
    risky_migrations=""
    while IFS= read -r migration_file; do
        [[ -n "$migration_file" ]] || continue
        full_path="$DEV_ROOT/database/migrations/$migration_file"
        [[ -f "$full_path" ]] || continue
        line_hits="$(grep -nE 'dropTable|dropColumn|truncate|delete\(|DB::statement|Schema::drop' "$full_path" || true)"
        if [[ -n "$line_hits" ]]; then
            risky_migrations+="${line_hits}"$'\n'
        fi
    done <<< "$new_migrations"

    if [[ -n "$risky_migrations" ]]; then
        warn "Potentially dangerous migration patterns detected in DEV"
        echo "$risky_migrations"
    else
        pass "No dangerous migration patterns detected in DEV"
    fi
else
    pass "No new migration files in DEV compared to PROD"
fi

changed_seeders="$(git -C "$DEV_ROOT" diff --name-only "$prod_head" "$dev_head" -- database/seeders/*.php 2>/dev/null || true)"
if [[ -n "$changed_seeders" ]]; then
    risky_seeders="$(grep -nE '->create\(' $changed_seeders | grep -Ev 'updateOrCreate|firstOrCreate|upsert' || true)"
    if [[ -n "$risky_seeders" ]]; then
        warn "Seeder create() without clear idempotency markers detected"
        echo "$risky_seeders"
    else
        pass "Changed seeders appear idempotent"
    fi
else
    pass "No changed seeders between PROD and DEV HEAD"
fi

echo ""
echo "Summary: PASS=${PASS_COUNT}, WARN=${WARN_COUNT}, FAIL=${FAIL_COUNT}"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
    exit 1
fi

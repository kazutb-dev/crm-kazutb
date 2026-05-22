#!/usr/bin/env bash
set -Eeuo pipefail

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
BACKUP_SCRIPT="${PROD_ROOT}/scripts/backup_prod.sh"
PRE_COMMIT_HOOK="${PROD_ROOT}/.git/hooks/pre-commit"
SAFECOMMIT_SCRIPT="${PROD_ROOT}/scripts/deploy/safecommit.sh"
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
[[ "$dev_branch" == "dev" ]] && pass "DEV branch is dev" || fail "DEV branch is $dev_branch (expected dev)"

if git -C "$PROD_ROOT" remote get-url origin >/dev/null 2>&1 && git -C "$DEV_ROOT" remote get-url origin >/dev/null 2>&1; then
    pass "origin remotes are configured"
else
    fail "origin remote is missing in PROD or DEV"
fi

if git -C "$PROD_ROOT" fetch origin --quiet >/dev/null 2>&1 && git -C "$DEV_ROOT" fetch origin --quiet >/dev/null 2>&1; then
    pass "origin fetch works for PROD and DEV"
else
    warn "Could not fetch origin for one of repos"
fi

tracked_sensitive="$(git -C "$PROD_ROOT" ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.|^backups/|\.sql$|\.sql\.gz$|\.dump$|\.tar\.gz$|^skills/' | grep -Ev '(^|/)\.env\.example$' || true)"
if [[ -z "$tracked_sensitive" ]]; then
    pass "No sensitive backup/env/sql files are tracked in PROD"
else
    fail "Sensitive tracked files detected in PROD:\n${tracked_sensitive}"
fi

[[ -f "$BACKUP_SCRIPT" ]] && pass "Backup script exists" || fail "Backup script missing: $BACKUP_SCRIPT"
[[ -x "$BACKUP_SCRIPT" ]] && pass "Backup script is executable" || warn "Backup script is not executable"

[[ -f "$PRE_COMMIT_HOOK" ]] && pass "pre-commit hook exists" || warn "pre-commit hook missing in PROD repo"
if [[ -x "$SAFECOMMIT_SCRIPT" ]]; then
    pass "safecommit wrapper is available"
else
    warn "safecommit wrapper missing or not executable: $SAFECOMMIT_SCRIPT"
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

new_migrations="$(comm -13 \
    <(git -C "$PROD_ROOT" ls-tree -r --name-only origin/main 2>/dev/null | grep '^database/migrations/.*\.php$' | sed 's#^database/migrations/##' | sort) \
    <(git -C "$PROD_ROOT" ls-tree -r --name-only origin/dev 2>/dev/null | grep '^database/migrations/.*\.php$' | sed 's#^database/migrations/##' | sort) || true)"

if [[ -n "$new_migrations" ]]; then
    risky_migrations=""
    while IFS= read -r migration_file; do
        [[ -n "$migration_file" ]] || continue
        full_path="$DEV_ROOT/database/migrations/$migration_file"
        [[ -f "$full_path" ]] || continue
        line_hits="$(awk '
            /function up\(\)[: ]*void/ {in_up=1}
            /function down\(\)[: ]*void/ {in_up=0}
            in_up {print NR ":" $0}
        ' "$full_path" | grep -E 'dropTable|dropColumn|Schema::drop|Schema::dropIfExists|truncate|delete\(|DB::statement|renameColumn|change\(' || true)"
        if [[ -n "$line_hits" ]]; then
            risky_migrations+="${full_path}"$'\n'"${line_hits}"$'\n'
        fi
    done <<< "$new_migrations"

    if [[ -n "$risky_migrations" ]]; then
        fail "Potentially dangerous migration patterns detected in DEV"
        echo "$risky_migrations"
    else
        pass "No dangerous migration patterns detected in DEV"
    fi
else
    pass "No new migration files in DEV compared to PROD"
fi

changed_seeders="$(git -C "$PROD_ROOT" diff --name-only origin/main..origin/dev -- database/seeders/*.php 2>/dev/null || true)"
if [[ -n "$changed_seeders" ]]; then
    risky_seeders="$(while IFS= read -r sf; do [[ -n "$sf" ]] && grep -nE -- '->create\(' "$DEV_ROOT/$sf" || true; done <<< "$changed_seeders" | grep -Ev 'updateOrCreate|firstOrCreate|upsert' || true)"
    if [[ -n "$risky_seeders" ]]; then
        warn "Seeder create() without clear idempotency markers detected"
        echo "$risky_seeders"
    else
        pass "Changed seeders appear idempotent"
    fi
else
    pass "No changed seeders between PROD and DEV HEAD"
fi

deploy_scripts=(
    "$PROD_ROOT/scripts/deploy/dev_to_prod_release.sh"
    "$PROD_ROOT/scripts/deploy/prod_to_dev_sync.sh"
    "$PROD_ROOT/scripts/deploy/pre_deploy_prod_checkpoint.sh"
    "$PROD_ROOT/scripts/deploy/rollback_prod_to_tag.sh"
)

for s in "${deploy_scripts[@]}"; do
    if [[ ! -f "$s" ]]; then
        fail "Deploy script missing: $s"
        continue
    fi

    if grep -nE 'php artisan db:seed|php artisan migrate:fresh|php artisan migrate:refresh|php artisan migrate:reset|php artisan db:wipe|php artisan test' "$s" >/dev/null 2>&1; then
        fail "Forbidden database reset/seed command found in $s"
    else
        pass "No forbidden reset/seed commands in $s"
    fi

    if grep -nE '\brsync\b' "$s" >/dev/null 2>&1; then
        fail "Forbidden rsync-based deploy command found in $s"
    else
        pass "No rsync command found in $s"
    fi
done

echo ""
echo "Summary: PASS=${PASS_COUNT}, WARN=${WARN_COUNT}, FAIL=${FAIL_COUNT}"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
    exit 1
fi

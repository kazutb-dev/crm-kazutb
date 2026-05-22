#!/usr/bin/env bash
set -Eeuo pipefail

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
CHECKPOINT_SCRIPT="${PROD_ROOT}/scripts/deploy/pre_deploy_prod_checkpoint.sh"
DRY_RUN=0
NO_MIGRATE=0
SKIP_BUILD=0
ASSUME_YES=0
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --no-migrate) NO_MIGRATE=1 ;;
        --skip-build) SKIP_BUILD=1 ;;
        --yes) ASSUME_YES=1 ;;
        -h|--help)
            cat <<'EOF'
Usage:
  ./scripts/deploy/deploy_dev_to_prod.sh [--dry-run] [--no-migrate] [--skip-build] [--yes]
EOF
            exit 0
            ;;
        *)
            echo "[deploy] ERROR: Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

log() {
    echo "[deploy] $*"
}

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $*"
    else
        eval "$@"
    fi
}

fail() {
    echo "[deploy] FAIL: $*" >&2
    exit 1
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

[[ -d "$PROD_ROOT" ]] || fail "PROD path missing: $PROD_ROOT"
[[ -d "$DEV_ROOT" ]] || fail "DEV path missing: $DEV_ROOT"
[[ -f "$CHECKPOINT_SCRIPT" ]] || fail "Checkpoint script missing: $CHECKPOINT_SCRIPT"

prod_status="$(git -C "$PROD_ROOT" status --short)"
dev_status="$(git -C "$DEV_ROOT" status --short)"
prod_branch="$(git -C "$PROD_ROOT" branch --show-current)"
dev_branch="$(git -C "$DEV_ROOT" branch --show-current)"
prod_head="$(git -C "$PROD_ROOT" rev-parse --short HEAD)"
dev_head="$(git -C "$DEV_ROOT" rev-parse --short HEAD)"

echo "PROD HEAD: ${prod_head} (${prod_branch})"
echo "DEV HEAD:  ${dev_head} (${dev_branch})"

if [[ -n "$prod_status" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
        echo "[deploy] WARN: PROD has uncommitted changes; continuing because --dry-run is enabled."
    else
        fail "PROD has uncommitted changes. Run checkpoint script first."
    fi
fi

if [[ "$dev_branch" != "main" && "$dev_branch" != "dev" ]]; then
    fail "DEV branch must be main or dev, got: $dev_branch"
fi

dangerous_dev="$(git -C "$DEV_ROOT" ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.|^backups/|\.sql$|\.sql\.gz$|\.dump$|\.tar\.gz$|^vendor/|^node_modules/|^skills/' | grep -Ev '(^|/)\.env\.example$' || true)"
if [[ -n "$dangerous_dev" ]]; then
    fail "DEV has dangerous tracked files:\n${dangerous_dev}"
fi

git -C "$PROD_ROOT" fetch origin main
prod_remote_head="$(git -C "$PROD_ROOT" rev-parse --short origin/main)"
if [[ "$prod_head" != "$prod_remote_head" ]]; then
    fail "PROD main is not synced with origin/main (local=${prod_head}, remote=${prod_remote_head})"
fi

echo ""
echo "Diff summary DEV vs PROD:"
git --no-pager -C "$PROD_ROOT" diff --stat HEAD.."$dev_head" || true

echo ""
echo "Migration files in DEV not present in PROD:"
comm -13 \
    <(find "$PROD_ROOT/database/migrations" -maxdepth 1 -type f -name '*.php' -printf '%f\n' | sort) \
    <(find "$DEV_ROOT/database/migrations" -maxdepth 1 -type f -name '*.php' -printf '%f\n' | sort) || true

echo ""
echo "Changed seeders in DEV working tree:"
git -C "$DEV_ROOT" status --short database/seeders || true

if [[ "$DRY_RUN" == "1" ]]; then
    log "Dry-run preflight finished. No deploy actions executed."
    exit 0
fi

"$CHECKPOINT_SCRIPT"

if [[ -n "$dev_status" ]]; then
    source ~/.bashrc || true
    if ! command -v safecommit >/dev/null 2>&1; then
        fail "DEV has uncommitted changes and safecommit is unavailable"
    fi
    cd "$DEV_ROOT"
    safecommit "chore(dev): checkpoint dev changes before production deploy"
    git push origin "$dev_branch"
fi

cd "$PROD_ROOT"
prod_old_head="$(git rev-parse HEAD)"
git fetch origin
git merge --ff-only origin/main
prod_new_head="$(git rev-parse HEAD)"

if [[ "$SKIP_BUILD" != "1" ]]; then
    composer install --no-dev --optimize-autoloader
    if [[ -f "${PROD_ROOT}/package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    npm run build
fi

new_migration_files="$(git diff --name-only "$prod_old_head" "$prod_new_head" -- database/migrations/*.php || true)"
if [[ -n "$new_migration_files" ]]; then
    risky_migrations="$(grep -nE 'dropTable|dropColumn|truncate|delete\(|DB::statement|Schema::drop' $new_migration_files || true)"
    if [[ -n "$risky_migrations" && "$ASSUME_YES" != "1" ]]; then
        fail "Potentially dangerous migration statements found:\n${risky_migrations}\nRe-run with --yes after manual review."
    fi
fi

if [[ "$NO_MIGRATE" != "1" ]]; then
    php artisan migrate:status
    php artisan migrate --force
fi

changed_seeders="$(git diff --name-only "$prod_old_head" "$prod_new_head" -- database/seeders/*.php || true)"
if [[ -n "$changed_seeders" ]]; then
    risky_seeders="$(grep -nE '->create\(' $changed_seeders | grep -Ev 'updateOrCreate|firstOrCreate|upsert' || true)"
    if [[ -n "$risky_seeders" && "$ASSUME_YES" != "1" ]]; then
        fail "Non-idempotent seeder patterns detected:\n${risky_seeders}\nAuto-seeding is disabled. Review manually."
    fi
fi

php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan queue:restart
sudo systemctl reload php8.3-fpm || true
sudo systemctl reload nginx || true

php artisan about || true
app_url="$(env_value APP_URL "${PROD_ROOT}/.env")"
if [[ -n "$app_url" ]]; then
    curl -I "$app_url" || true
fi
tail -n 100 storage/logs/laravel.log || true

report_dir="${PROD_ROOT}/storage/app/deploy_reports"
mkdir -p "$report_dir"
report_file="${report_dir}/deploy_${TIMESTAMP}.txt"

checkpoint_tag="$(git tag --list 'pre-deploy-*' --sort=-creatordate | head -n1)"
backup_dir="$(ls -1dt "${PROD_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"

{
    echo "timestamp=$(date -Iseconds)"
    echo "prod_checkpoint_tag=$checkpoint_tag"
    echo "backup_dir=$backup_dir"
    echo "prod_old_head=$prod_old_head"
    echo "prod_new_head=$prod_new_head"
    echo "migrations_run=$([[ "$NO_MIGRATE" == "1" ]] && echo no || echo yes)"
    echo "build_skipped=$([[ "$SKIP_BUILD" == "1" ]] && echo yes || echo no)"
    echo "health_check=completed"
    echo "rollback_command=./scripts/deploy/rollback_prod_to_tag.sh $checkpoint_tag"
} > "$report_file"

echo "Deploy finished."
echo "Report: $report_file"

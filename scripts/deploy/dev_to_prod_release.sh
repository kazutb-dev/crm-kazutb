#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="[release]"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib_deploy_common.sh"

PROD_ROOT="/home/admaza/projects/du"
DEV_ROOT="/home/admaza/projects/laravel-react-dev"
CHECKPOINT_SCRIPT="${PROD_ROOT}/scripts/deploy/pre_deploy_prod_checkpoint.sh"

require_release_routed_via_deploy "$DEV_ROOT"

begin_operation_lock "dev-to-prod-release"
trap 'end_operation_lock' EXIT

DRY_RUN=0
ASSUME_YES=0
NO_MIGRATE=0
SKIP_BUILD=0
FORCE_PROTECTED_DELETE=0
RELEASE_FAILPOINT="${RELEASE_FAILPOINT:-}"

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes) ASSUME_YES=1 ;;
        --no-migrate) NO_MIGRATE=1 ;;
        --skip-build) SKIP_BUILD=1 ;;
        --force-protected-delete) FORCE_PROTECTED_DELETE=1 ;;
        -h|--help)
            cat <<USAGE
Usage:
  ${PROD_ROOT}/scripts/deploy/dev_to_prod_release.sh [--dry-run] [--yes] [--no-migrate] [--skip-build] [--force-protected-delete]
USAGE
            exit 0
            ;;
        *) fail "Unknown argument: $arg" ;;
    esac
done

run_failpoint_if_requested() {
    local stage="$1"
    if [[ -n "$RELEASE_FAILPOINT" && "$RELEASE_FAILPOINT" == "$stage" ]]; then
        fail "Simulated failpoint reached: ${stage}"
    fi
}

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $*"
    else
        eval "$@"
    fi
}

confirm_word() {
    local prompt="$1"
    local expected="$2"
    local input
    read -r -p "$prompt" input
    [[ "$input" == "$expected" ]]
}

is_excluded_path() {
    local p="$1"
    [[ "$p" =~ (^|/)\.env($|\.) ]] && return 0
    [[ "$p" =~ ^backups/ ]] && return 0
    [[ "$p" =~ ^storage/ ]] && return 0
    [[ "$p" =~ ^public/storage($|/) ]] && return 0
    [[ "$p" =~ ^public/build($|/) ]] && return 0
    [[ "$p" =~ ^vendor/ ]] && return 0
    [[ "$p" =~ ^node_modules/ ]] && return 0
    [[ "$p" =~ ^skills/ ]] && return 0
    [[ "$p" =~ \.sql$ ]] && return 0
    [[ "$p" =~ \.sql\.gz$ ]] && return 0
    [[ "$p" =~ \.tar\.gz$ ]] && return 0
    [[ "$p" =~ \.dump$ ]] && return 0
    return 1
}

[[ -d "$PROD_ROOT" ]] || fail "PROD root missing"
[[ -d "$DEV_ROOT" ]] || fail "DEV root missing"
[[ -x "$CHECKPOINT_SCRIPT" ]] || fail "Checkpoint script missing or not executable: $CHECKPOINT_SCRIPT"

require_command git
require_command php
require_command curl

# Preflight states
require_branch_main() { [[ "$(git -C "$PROD_ROOT" branch --show-current)" == "main" ]] || fail "PROD must be on main"; }
require_branch_dev() { [[ "$(git -C "$DEV_ROOT" branch --show-current)" == "dev" ]] || fail "DEV must be on dev"; }
require_branch_main
require_branch_dev

ensure_no_sensitive_tracked "$PROD_ROOT"
ensure_no_sensitive_tracked "$DEV_ROOT"

git -C "$PROD_ROOT" fetch origin --quiet
git -C "$DEV_ROOT" fetch origin --quiet

print_migration_preflight "$PROD_ROOT" origin/main origin/dev

if [[ -n "$(git -C "$PROD_ROOT" status --short || true)" ]]; then
    fail "DIRTY PROD BLOCKER: ${PROD_ROOT} has uncommitted changes. Release and migration halted before execution."
fi

protected_deletes="$(detect_protected_deletions "$PROD_ROOT" origin/main origin/dev)"
if [[ -n "$protected_deletes" && "$FORCE_PROTECTED_DELETE" != "1" ]]; then
    fail "Protected deletions detected between origin/main..origin/dev:\n$protected_deletes\nUse --force-protected-delete only after explicit approval."
fi

dangerous_migrations="$(detect_dangerous_migrations "$PROD_ROOT" origin/main origin/dev)"
[[ -z "$dangerous_migrations" ]] || fail "Dangerous migration patterns detected:\n$dangerous_migrations"

changed_seeders="$(detect_changed_seeders "$PROD_ROOT" origin/main origin/dev)"
if [[ -n "$changed_seeders" ]]; then
    warn "Seeders changed (will not be auto-run on PROD):\n$changed_seeders"
fi

changes="$(list_diff_name_status "$PROD_ROOT" origin/main origin/dev || true)"
create_list=""
modify_list=""
delete_list=""

while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    status="$(awk '{print $1}' <<< "$line")"
    path1="$(awk '{print $2}' <<< "$line")"
    path2="$(awk '{print $3}' <<< "$line")"

    case "$status" in
        A)
            is_excluded_path "$path1" || create_list+="$path1"$'\n'
            ;;
        M)
            is_excluded_path "$path1" || modify_list+="$path1"$'\n'
            ;;
        D)
            is_excluded_path "$path1" || delete_list+="$path1"$'\n'
            ;;
        R*)
            is_excluded_path "$path1" || delete_list+="$path1"$'\n'
            is_excluded_path "$path2" || create_list+="$path2"$'\n'
            ;;
    esac
done <<< "$changes"

echo ""
echo "Files to create:"
echo "${create_list:-<none>}"
echo ""
echo "Files to modify:"
echo "${modify_list:-<none>}"
echo ""
echo "Files to delete:"
echo "${delete_list:-<none>}"

if [[ -n "$delete_list" && "$DRY_RUN" != "1" ]]; then
    if [[ "$ASSUME_YES" == "1" ]]; then
        fail "Deletions require interactive DELETE confirmation."
    fi
    confirm_word "Type DELETE to allow file deletions listed above: " "DELETE" || fail "Release blocked: deletions not confirmed"
fi

if [[ "$DRY_RUN" != "1" && "$ASSUME_YES" != "1" ]]; then
    confirm_word "Apply release changes to PROD main? type YES: " "YES" || fail "Release canceled"
fi

run_cmd "'${CHECKPOINT_SCRIPT}' $([[ "$DRY_RUN" == "1" ]] && echo --dry-run || true)"

if [[ "$DRY_RUN" == "1" ]]; then
    log "Dry-run completed. No release actions executed."
    exit 0
fi

TIMESTAMP="$(current_ts)"
RELEASE_ID="rel_${TIMESTAMP}"
PROD_OLD_HEAD="$(git -C "$PROD_ROOT" rev-parse HEAD)"
ROLLBACK_NEEDED=0
PUSHED_TO_ORIGIN=0
TMP_RELEASE_DIR=""
MERGED_HEAD=""

on_error() {
    local ec=$?
    warn "Release failed (exit=$ec)"
    if [[ "$ROLLBACK_NEEDED" == "1" ]]; then
        warn "Rolling back local PROD git state to $PROD_OLD_HEAD"
        git -C "$PROD_ROOT" reset --hard "$PROD_OLD_HEAD" || true
    fi
    if [[ "$PUSHED_TO_ORIGIN" == "1" ]]; then
        warn "origin/main already updated by release ${RELEASE_ID}."
        warn "SOURCE OF TRUTH: origin/main (current release commit)"
        warn "RECOVERY PLAYBOOK:"
        warn "  1) Freeze new releases and runtime sync operations"
        warn "  2) Diagnose local failure on PROD host and re-run deploy steps"
        warn "  3) If rollback approved, execute: git -C ${PROD_ROOT} push --force-with-lease origin ${PROD_OLD_HEAD}:main"
        warn "  4) Then run: ./scripts/deploy/rollback_prod_to_tag.sh <approved-tag> --yes"
    fi
    if [[ -n "$TMP_RELEASE_DIR" && -d "$TMP_RELEASE_DIR" ]]; then
        rm -rf "$TMP_RELEASE_DIR" || true
    fi
    exit "$ec"
}
trap on_error ERR

# Phase 1: Build release commit in isolated workspace and push first.
TMP_RELEASE_DIR="$(mktemp -d /tmp/kazutb-release-${TIMESTAMP}-XXXXXX)"
git clone --quiet "$PROD_ROOT" "$TMP_RELEASE_DIR/repo"
git -C "$TMP_RELEASE_DIR/repo" remote set-url origin "$(git -C "$PROD_ROOT" remote get-url origin)"
git -C "$TMP_RELEASE_DIR/repo" fetch origin --quiet
git -C "$TMP_RELEASE_DIR/repo" checkout -B main origin/main
git -C "$TMP_RELEASE_DIR/repo" merge --no-ff origin/dev -m "release(${RELEASE_ID}): merge dev into main"
MERGED_HEAD="$(git -C "$TMP_RELEASE_DIR/repo" rev-parse HEAD)"
git -C "$TMP_RELEASE_DIR/repo" push origin HEAD:main
PUSHED_TO_ORIGIN=1
run_failpoint_if_requested "after-push"

# Phase 2: Move live PROD checkout to the exact pushed release commit.
git -C "$PROD_ROOT" checkout main
git -C "$PROD_ROOT" fetch origin --quiet
git -C "$PROD_ROOT" reset --hard "$MERGED_HEAD"
ROLLBACK_NEEDED=1

(cd "$PROD_ROOT" && composer install --no-dev --optimize-autoloader)
if [[ "$SKIP_BUILD" != "1" ]]; then
    [[ -f "$PROD_ROOT/package-lock.json" ]] || fail "package-lock.json missing; refusing npm install in release"
    (cd "$PROD_ROOT" && npm ci)
    (cd "$PROD_ROOT" && npm run build)
fi

(cd "$PROD_ROOT" && php artisan migrate:status)
if [[ "$NO_MIGRATE" != "1" ]]; then
    (cd "$PROD_ROOT" && php artisan migrate --force)
fi
run_failpoint_if_requested "after-migrate"

(cd "$PROD_ROOT" && php artisan optimize:clear)
(cd "$PROD_ROOT" && php artisan config:cache)
(cd "$PROD_ROOT" && php artisan route:cache)
(cd "$PROD_ROOT" && php artisan view:cache)
(cd "$PROD_ROOT" && php artisan queue:restart)
sudo systemctl reload php8.3-fpm || true
sudo systemctl reload nginx || true
check_laravel_health "$PROD_ROOT"
check_storage_permissions "$PROD_ROOT"
if [[ "$SKIP_BUILD" != "1" ]]; then
    check_public_build "$PROD_ROOT"
fi

_prod_smoke_check() {
    local label="$1" url="$2"
    local code
    code="$(curl -sL -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$code" =~ ^5 ]]; then
        fail "PROD smoke test FAILED: ${label} returned HTTP ${code} (5xx server error)"
    fi
    info "  smoke: ${label} → HTTP ${code} OK"
}
_prod_smoke_check "/"                      "https://crm.kaztbu.edu.kz/"
_prod_smoke_check "/login"                 "https://crm.kaztbu.edu.kz/login"
_prod_smoke_check "/certificates"          "https://crm.kaztbu.edu.kz/certificates"
_prod_smoke_check "/certificates/registry" "https://crm.kaztbu.edu.kz/certificates/registry"
_prod_smoke_check "/templates"             "https://crm.kaztbu.edu.kz/templates"
run_failpoint_if_requested "after-health"

ROLLBACK_NEEDED=0
if [[ -n "$TMP_RELEASE_DIR" && -d "$TMP_RELEASE_DIR" ]]; then
    rm -rf "$TMP_RELEASE_DIR"
    TMP_RELEASE_DIR=""
fi

report_dir="${PROD_ROOT}/storage/app/deploy_reports"
mkdir -p "$report_dir"
report_file="${report_dir}/deploy_${TIMESTAMP}.txt"
report_json_file="${report_dir}/deploy_${TIMESTAMP}.json"
checkpoint_tag="$(git -C "$PROD_ROOT" tag --list 'pre-deploy-*' --sort=-creatordate | head -n1)"
backup_dir="$(ls -1dt "${PROD_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"

{
    echo "timestamp=$(date -Iseconds)"
    echo "release_id=${RELEASE_ID}"
    echo "prod_old_head=${PROD_OLD_HEAD}"
    echo "prod_new_head=$(git -C "$PROD_ROOT" rev-parse HEAD)"
    echo "release_commit=${MERGED_HEAD}"
    echo "origin_push_first=true"
    echo "dev_head=$(git -C "$DEV_ROOT" rev-parse origin/dev)"
    echo "files_created=$(echo "$create_list" | tr '\n' ';')"
    echo "files_modified=$(echo "$modify_list" | tr '\n' ';')"
    echo "files_deleted=$(echo "$delete_list" | tr '\n' ';')"
    echo "dangerous_migrations=$(echo "$dangerous_migrations" | tr '\n' ';')"
    echo "changed_seeders=$(echo "$changed_seeders" | tr '\n' ';')"
    echo "checkpoint_tag=${checkpoint_tag}"
    echo "backup_dir=${backup_dir}"
    echo "build_status=$([[ "$SKIP_BUILD" == "1" ]] && echo skipped || echo done)"
    echo "migrate_status=$([[ "$NO_MIGRATE" == "1" ]] && echo skipped || echo done)"
    echo "health_http_status=${prod_http_code}"
    echo "rollback_command=./scripts/deploy/rollback_prod_to_tag.sh ${checkpoint_tag} --yes"
} > "$report_file"

cat > "$report_json_file" <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "release_id": "${RELEASE_ID}",
    "prod_old_head": "${PROD_OLD_HEAD}",
    "prod_new_head": "$(git -C "$PROD_ROOT" rev-parse HEAD)",
    "release_commit": "${MERGED_HEAD}",
    "origin_push_first": true,
    "dev_head": "$(git -C "$DEV_ROOT" rev-parse origin/dev)",
    "checkpoint_tag": "${checkpoint_tag}",
    "backup_dir": "${backup_dir}",
    "build_status": "$( [[ "$SKIP_BUILD" == "1" ]] && echo skipped || echo done )",
    "migrate_status": "$( [[ "$NO_MIGRATE" == "1" ]] && echo skipped || echo done )",
    "health_http_status": "${prod_http_code}"
}
EOF

log "Release finished"
log "Report: $report_file"
log "Report JSON: $report_json_file"

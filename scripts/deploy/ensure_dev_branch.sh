#!/usr/bin/env bash
set -Eeuo pipefail

DEV_ROOT="/var/www/laravel-react-dev"
REMOTE_URL="https://github.com/kazutb-dev/crm-kazutb.git"
SAFECOMMIT_SCRIPT="/var/www/laravel-react/scripts/deploy/safecommit.sh"
DRY_RUN=0

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            cat <<'EOF'
Usage:
  /var/www/laravel-react/scripts/deploy/ensure_dev_branch.sh [--dry-run]
EOF
            exit 0
            ;;
        *)
            echo "[ensure-dev] ERROR: Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

log() {
    echo "[ensure-dev] $*"
}

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $*"
    else
        eval "$@"
    fi
}

[[ -d "$DEV_ROOT" ]] || { echo "[ensure-dev] ERROR: DEV root missing: $DEV_ROOT" >&2; exit 1; }

cd "$DEV_ROOT"

if ! git remote get-url origin >/dev/null 2>&1; then
    run_cmd "git remote add origin '$REMOTE_URL'"
fi

if [[ -n "$(git status --short)" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would checkpoint local DEV changes using safecommit"
    else
        if [[ ! -x "$SAFECOMMIT_SCRIPT" ]]; then
            echo "[ensure-dev] ERROR: safecommit wrapper is missing or not executable: $SAFECOMMIT_SCRIPT" >&2
            exit 1
        fi
        "$SAFECOMMIT_SCRIPT" "chore(dev): checkpoint local dev state before branch setup"
    fi
fi

run_cmd "git checkout -B dev"
run_cmd "git push -u origin dev"

echo "[ensure-dev] DEV branch ready: $(git branch --show-current)"

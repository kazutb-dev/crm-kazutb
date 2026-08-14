#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="/home/admaza/projects/laravel-react"
BACKUP_SCRIPT="${PROJECT_ROOT}/scripts/backup_prod.sh"
CHECKPOINT_DIR="${PROJECT_ROOT}/storage/app/deploy_checkpoints"
SAFECOMMIT_SCRIPT="${PROJECT_ROOT}/scripts/deploy/safecommit.sh"
DRY_RUN=0

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            cat <<'EOF'
Usage:
  ./scripts/deploy/pre_deploy_prod_checkpoint.sh [--dry-run]
EOF
            exit 0
            ;;
        *)
            echo "[checkpoint] ERROR: Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

log() {
    echo "[checkpoint] $*"
}

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $*"
    else
        eval "$@"
    fi
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

[[ -d "$PROJECT_ROOT" ]] || { echo "[checkpoint] ERROR: Project root not found: $PROJECT_ROOT" >&2; exit 1; }
[[ -f "$BACKUP_SCRIPT" ]] || { echo "[checkpoint] ERROR: backup script missing: $BACKUP_SCRIPT" >&2; exit 1; }

cd "$PROJECT_ROOT"
[[ "$(pwd)" == "$PROJECT_ROOT" ]] || { echo "[checkpoint] ERROR: wrong working directory" >&2; exit 1; }

branch="$(git branch --show-current)"
[[ "$branch" == "main" ]] || { echo "[checkpoint] ERROR: PROD must be on main, got: $branch" >&2; exit 1; }

git remote get-url origin >/dev/null 2>&1 || { echo "[checkpoint] ERROR: remote origin not configured" >&2; exit 1; }

if [[ -n "$(git status --short)" ]]; then
    log "Detected uncommitted changes in PROD"
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would run safecommit and push origin main"
    else
        if [[ ! -x "$SAFECOMMIT_SCRIPT" ]]; then
            echo "[checkpoint] ERROR: safecommit wrapper missing or not executable: $SAFECOMMIT_SCRIPT" >&2
            exit 1
        fi
        "$SAFECOMMIT_SCRIPT" "chore(prod): checkpoint direct production changes before deploy"
        git push origin main
    fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
    backup_dir="${PROJECT_ROOT}/backups/prod_backup_DRYRUN_full_snapshot"
    log "DRY-RUN: would run backup script with default retention policy"
else
    "$BACKUP_SCRIPT"
    backup_dir="$(ls -1dt "${PROJECT_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"
    [[ -n "$backup_dir" ]] || { echo "[checkpoint] ERROR: latest backup directory not found" >&2; exit 1; }

    db_file="$(ls -1 "$backup_dir"/database_*.sql.gz 2>/dev/null | head -n1 || true)"
    data_file="$(ls -1 "$backup_dir"/project_data_*.tar.gz 2>/dev/null | head -n1 || true)"
    env_file_bak="$(ls -1 "$backup_dir"/env_*.backup 2>/dev/null | head -n1 || true)"
    manifest_file="$(ls -1 "$backup_dir"/manifest_*.txt 2>/dev/null | head -n1 || true)"

    [[ -n "$db_file" && -f "$db_file" ]] || { echo "[checkpoint] ERROR: database backup missing" >&2; exit 1; }
    [[ -n "$data_file" && -f "$data_file" ]] || { echo "[checkpoint] ERROR: project_data archive missing" >&2; exit 1; }
    [[ -n "$env_file_bak" && -f "$env_file_bak" ]] || { echo "[checkpoint] ERROR: env backup missing" >&2; exit 1; }
    [[ -n "$manifest_file" && -f "$manifest_file" ]] || { echo "[checkpoint] ERROR: manifest missing" >&2; exit 1; }

    gzip -t "$db_file"
    tar -tzf "$data_file" >/dev/null
fi

tag="pre-deploy-$(date +%Y%m%d-%H%M%S)"
if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would create and push tag ${tag}"
else
    git tag "$tag"
    git push origin "$tag"
fi

mkdir -p "$CHECKPOINT_DIR"
checkpoint_file="${CHECKPOINT_DIR}/${tag}.txt"
if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would write checkpoint report: $checkpoint_file"
else
    {
        echo "tag=${tag}"
        echo "timestamp=$(date -Iseconds)"
        echo "git_head=$(git rev-parse HEAD)"
        echo "backup_dir=${backup_dir}"
        echo "operator_user=$(whoami)"
        echo "hostname=$(hostname)"
        echo "db_database=$(env_value DB_DATABASE "${PROJECT_ROOT}/.env")"
    } > "$checkpoint_file"
fi

echo
echo "TAG: ${tag}"
echo "Backup dir: ${backup_dir}"
echo "Rollback command: ./scripts/deploy/rollback_prod_to_tag.sh ${tag} --yes"

#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="/var/www/laravel-react"
BACKUP_SCRIPT="${PROJECT_ROOT}/scripts/backup_prod.sh"
CHECKPOINT_DIR="${PROJECT_ROOT}/storage/app/deploy_checkpoints"
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
[[ -f "$BACKUP_SCRIPT" ]] || { echo "[checkpoint] ERROR: backup script not found: $BACKUP_SCRIPT" >&2; exit 1; }

cd "$PROJECT_ROOT"

status_short="$(git status --short)"
if [[ -n "$status_short" ]]; then
    log "Detected uncommitted changes in PROD."

    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: would run safecommit and push origin main."
    else
        source ~/.bashrc || true
        if ! command -v safecommit >/dev/null 2>&1; then
            echo "[checkpoint] ERROR: safecommit command is not available. Aborting for safety." >&2
            exit 1
        fi

        safecommit "chore(prod): checkpoint direct production changes before deploy"
        git push origin main
    fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would run full backup: $BACKUP_SCRIPT"
    backup_dir="${PROJECT_ROOT}/backups/prod_backup_DRYRUN_full_snapshot"
else
    "$BACKUP_SCRIPT"

    backup_dir="$(ls -1dt "${PROJECT_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"
    [[ -n "$backup_dir" ]] || { echo "[checkpoint] ERROR: Unable to locate latest backup directory" >&2; exit 1; }

    db_file="$(ls -1 "$backup_dir"/database_*.sql.gz 2>/dev/null | head -n1 || true)"
    project_file="$(ls -1 "$backup_dir"/project_data_*.tar.gz 2>/dev/null | head -n1 || true)"
    env_file_bak="$(ls -1 "$backup_dir"/env_*.backup 2>/dev/null | head -n1 || true)"
    manifest_file="$(ls -1 "$backup_dir"/manifest_*.txt 2>/dev/null | head -n1 || true)"

    [[ -n "$db_file" && -f "$db_file" ]] || { echo "[checkpoint] ERROR: database backup is missing in $backup_dir" >&2; exit 1; }
    [[ -n "$project_file" && -f "$project_file" ]] || { echo "[checkpoint] ERROR: project_data backup is missing in $backup_dir" >&2; exit 1; }
    [[ -n "$env_file_bak" && -f "$env_file_bak" ]] || { echo "[checkpoint] ERROR: env backup is missing in $backup_dir" >&2; exit 1; }
    [[ -n "$manifest_file" && -f "$manifest_file" ]] || { echo "[checkpoint] ERROR: manifest file is missing in $backup_dir" >&2; exit 1; }

    gzip -t "$db_file"
    tar -tzf "$project_file" >/dev/null
fi

tag="pre-deploy-$(date +%Y%m%d-%H%M%S)"
if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would create and push tag: $tag"
else
    git tag "$tag"
    git push origin "$tag"
fi

mkdir -p "$CHECKPOINT_DIR"
checkpoint_file="$CHECKPOINT_DIR/${tag}.txt"
head_sha="$(git rev-parse HEAD)"
env_file="${PROJECT_ROOT}/.env"
db_database="$(env_value "DB_DATABASE" "$env_file")"

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would write checkpoint file: $checkpoint_file"
else
    {
        echo "tag=$tag"
        echo "git_head=$head_sha"
        echo "backup_dir=$backup_dir"
        echo "timestamp=$(date -Iseconds)"
        echo "git_status=$(git status --short | tr '\n' ';')"
        echo "database_name=$db_database"
        echo "operator_user=$(whoami)"
        echo "hostname=$(hostname)"
    } > "$checkpoint_file"
fi

echo
echo "TAG: $tag"
echo "Backup dir: $backup_dir"
echo "Rollback command: ./scripts/deploy/rollback_prod_to_tag.sh $tag"

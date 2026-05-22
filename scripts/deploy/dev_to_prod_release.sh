#!/usr/bin/env bash
set -Eeuo pipefail

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"
CHECKPOINT_SCRIPT="${PROD_ROOT}/scripts/deploy/pre_deploy_prod_checkpoint.sh"
DRY_RUN=0
ASSUME_YES=0
NO_MIGRATE=0
SKIP_BUILD=0
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes) ASSUME_YES=1 ;;
        --no-migrate) NO_MIGRATE=1 ;;
        --skip-build) SKIP_BUILD=1 ;;
        -h|--help)
            cat <<'EOF'
Usage:
  /var/www/laravel-react/scripts/deploy/dev_to_prod_release.sh [--dry-run] [--yes] [--no-migrate] [--skip-build]
EOF
            exit 0
            ;;
        *)
            echo "[release] ERROR: Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

log() {
    echo "[release] $*"
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

extract_up_block() {
    local file="$1"
    awk '
      /function up\(\)[: ]*void/ {in_up=1}
      in_up {print}
      /function down\(\)[: ]*void/ {in_up=0}
    ' "$file"
}

scan_dangerous_migration() {
    local file="$1"
    extract_up_block "$file" | grep -nE 'dropColumn|dropTable|Schema::drop|Schema::dropIfExists|truncate|delete\(|DB::statement|renameColumn|change\('
}

ensure_paths() {
    [[ -d "$PROD_ROOT" ]] || { echo "[release] ERROR: PROD path missing" >&2; exit 1; }
    [[ -d "$DEV_ROOT" ]] || { echo "[release] ERROR: DEV path missing" >&2; exit 1; }
    [[ -f "$CHECKPOINT_SCRIPT" ]] || { echo "[release] ERROR: checkpoint script missing" >&2; exit 1; }
}

ensure_paths

# A. Preflight
cd "$PROD_ROOT"
[[ "$(pwd)" == "$PROD_ROOT" ]] || { echo "[release] ERROR: wrong PROD path" >&2; exit 1; }
[[ "$(git branch --show-current)" == "main" ]] || { echo "[release] ERROR: PROD must be on main" >&2; exit 1; }
[[ -z "$(git status --short)" ]] || { echo "[release] ERROR: PROD must be clean before release" >&2; exit 1; }

git remote get-url origin >/dev/null 2>&1 || { echo "[release] ERROR: PROD origin missing" >&2; exit 1; }

cd "$DEV_ROOT"
[[ "$(git branch --show-current)" == "dev" ]] || { echo "[release] ERROR: DEV must be on dev branch" >&2; exit 1; }

dev_dirty=0
if [[ -n "$(git status --short)" ]]; then
    dev_dirty=1
fi

if (( dev_dirty == 1 )); then
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: DEV is dirty; would request checkpoint commit"
    elif [[ "$ASSUME_YES" == "1" ]]; then
        :
    else
        if ! confirm_word "DEV has uncommitted changes. Commit them to dev branch? type YES: " "YES"; then
            echo "[release] ERROR: aborted due to dirty DEV" >&2
            exit 1
        fi
    fi

    if [[ "$DRY_RUN" != "1" ]]; then
        source ~/.bashrc || true
        command -v safecommit >/dev/null 2>&1 || { echo "[release] ERROR: safecommit required" >&2; exit 1; }
        safecommit "chore(dev): checkpoint dev changes before prod release"
        git push origin dev
    fi
fi

# Sensitive tracked files checks
sensitive_pattern='(^|/)\.env$|(^|/)\.env\.|^backups/|\.sql$|\.sql\.gz$|\.dump$|\.tar\.gz$|^vendor/|^node_modules/|^skills/'
prod_sensitive="$(git -C "$PROD_ROOT" ls-files | grep -E "$sensitive_pattern" | grep -Ev '(^|/)\.env\.example$' || true)"
dev_sensitive="$(git -C "$DEV_ROOT" ls-files | grep -E "$sensitive_pattern" | grep -Ev '(^|/)\.env\.example$' || true)"
[[ -z "$prod_sensitive" ]] || { echo "[release] ERROR: sensitive files tracked in PROD" >&2; echo "$prod_sensitive"; exit 1; }
[[ -z "$dev_sensitive" ]] || { echo "[release] ERROR: sensitive files tracked in DEV" >&2; echo "$dev_sensitive"; exit 1; }

# Fetch and compare
run_cmd "git -C '$DEV_ROOT' push origin dev"
run_cmd "git -C '$PROD_ROOT' fetch origin"

# Build diff lists from origin/main -> origin/dev
changes="$(git -C "$PROD_ROOT" diff --name-status origin/main..origin/dev || true)"
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
            p="$path1"
            is_excluded_path "$p" && continue
            create_list+="$p"$'\n'
            ;;
        M)
            p="$path1"
            is_excluded_path "$p" && continue
            modify_list+="$p"$'\n'
            ;;
        D)
            p="$path1"
            is_excluded_path "$p" && continue
            delete_list+="$p"$'\n'
            ;;
        R*)
            p_old="$path1"
            p_new="$path2"
            is_excluded_path "$p_old" || delete_list+="$p_old"$'\n'
            is_excluded_path "$p_new" || create_list+="$p_new"$'\n'
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

if [[ -n "$delete_list" ]]; then
    echo ""
    echo "The following files would be deleted from PROD:"
    echo "$delete_list"
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: deletions present; deploy would be BLOCKED without DELETE confirmation"
    elif [[ "$ASSUME_YES" == "1" ]]; then
        echo "[release] ERROR: deletions require explicit DELETE confirmation in interactive mode" >&2
        exit 1
    else
        if ! confirm_word "Type DELETE to allow these deletions, or press Enter to keep them: " "DELETE"; then
            echo "[release] ERROR: deploy blocked because deletions are not confirmed" >&2
            exit 1
        fi
    fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would ask confirmation 'Apply these changes? type YES'"
else
    if [[ "$ASSUME_YES" != "1" ]]; then
        if ! confirm_word "Apply these changes? type YES: " "YES"; then
            echo "[release] ERROR: deploy aborted by operator" >&2
            exit 1
        fi
    fi
fi

# C. Migration safety
migration_candidates="$(comm -13 \
    <(find "$PROD_ROOT/database/migrations" -maxdepth 1 -type f -name '*.php' -printf '%f\n' | sort) \
    <(find "$DEV_ROOT/database/migrations" -maxdepth 1 -type f -name '*.php' -printf '%f\n' | sort) || true)"

danger_hits=""
while IFS= read -r mf; do
    [[ -n "$mf" ]] || continue
    file_path="$DEV_ROOT/database/migrations/$mf"
    [[ -f "$file_path" ]] || continue
    hits="$(scan_dangerous_migration "$file_path" || true)"
    if [[ -n "$hits" ]]; then
        danger_hits+="${file_path}"$'\n'"${hits}"$'\n'
    fi
done <<< "$migration_candidates"

if [[ -n "$danger_hits" ]]; then
    echo "[release] ERROR: dangerous migration patterns detected in up() blocks" >&2
    echo "$danger_hits" >&2
    exit 1
fi

# D. Seeder safety (warn only, never run seeders)
changed_seeders="$(git -C "$PROD_ROOT" diff --name-only origin/main..origin/dev -- database/seeders/*.php 2>/dev/null || true)"
if [[ -n "$changed_seeders" ]]; then
    echo ""
    echo "Changed/new seeders (will NOT be run on PROD):"
    echo "$changed_seeders"
fi

# E. PROD checkpoint
run_cmd "'${CHECKPOINT_SCRIPT}' $([[ "$DRY_RUN" == "1" ]] && echo --dry-run || true)"

# Stop after dry-run preflight
if [[ "$DRY_RUN" == "1" ]]; then
    log "Dry-run completed. No deploy actions executed."
    exit 0
fi

# F. Merge dev into main
cd "$PROD_ROOT"
prod_old_head="$(git rev-parse HEAD)"
run_cmd "git checkout main"
run_cmd "git fetch origin"
if ! git merge --no-ff origin/dev -m "release: merge dev into main"; then
    echo "[release] ERROR: merge conflict detected" >&2
    git diff --name-only --diff-filter=U >&2 || true
    exit 1
fi
run_cmd "git push origin main"
prod_new_head="$(git rev-parse HEAD)"

# G. PROD install/build/migrate
run_cmd "composer install --no-dev --optimize-autoloader"
if [[ "$SKIP_BUILD" != "1" ]]; then
    if [[ -f "${PROD_ROOT}/package-lock.json" ]]; then
        run_cmd "npm ci"
    else
        echo "[release] ERROR: package-lock.json missing; npm ci cannot run safely" >&2
        exit 1
    fi
    run_cmd "npm run build"
fi

run_cmd "php artisan migrate:status"
if [[ "$NO_MIGRATE" != "1" ]]; then
    run_cmd "php artisan migrate --force"
fi
run_cmd "php artisan optimize:clear"
run_cmd "php artisan config:cache"
run_cmd "php artisan route:cache"
run_cmd "php artisan view:cache"
run_cmd "php artisan queue:restart"
run_cmd "sudo systemctl reload php8.3-fpm || true"
run_cmd "sudo systemctl reload nginx || true"
run_cmd "php artisan about"

# H. Report
report_dir="${PROD_ROOT}/storage/app/deploy_reports"
run_cmd "mkdir -p '${report_dir}'"
report_file="${report_dir}/deploy_${TIMESTAMP}.txt"
checkpoint_tag="$(git tag --list 'pre-deploy-*' --sort=-creatordate | head -n1)"
backup_dir="$(ls -1dt "${PROD_ROOT}"/backups/prod_backup_*_full_snapshot 2>/dev/null | head -n1 || true)"

if [[ "$DRY_RUN" != "1" ]]; then
    {
        echo "timestamp=$(date -Iseconds)"
        echo "prod_old_head=${prod_old_head}"
        echo "dev_head=$(git -C "$DEV_ROOT" rev-parse origin/dev)"
        echo "prod_new_head=${prod_new_head}"
        echo "files_created=$(echo "$create_list" | tr '\n' ';')"
        echo "files_modified=$(echo "$modify_list" | tr '\n' ';')"
        echo "files_deleted=$(echo "$delete_list" | tr '\n' ';')"
        echo "migration_list=$(echo "$migration_candidates" | tr '\n' ';')"
        echo "checkpoint_tag=${checkpoint_tag}"
        echo "backup_dir=${backup_dir}"
        echo "build_status=$([[ "$SKIP_BUILD" == "1" ]] && echo skipped || echo done)"
        echo "migrate_status=$([[ "$NO_MIGRATE" == "1" ]] && echo skipped || echo done)"
        echo "health_check=php artisan about"
        echo "rollback_command=./scripts/deploy/rollback_prod_to_tag.sh ${checkpoint_tag} --yes"
    } > "$report_file"
fi

echo "Release finished."
echo "Report: ${report_file}"

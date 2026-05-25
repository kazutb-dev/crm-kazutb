#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="[sync-nav]"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib_deploy_common.sh"

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"

DRY_RUN=0
ASSUME_YES=0

usage() {
    cat <<'USAGE'
Usage:
  /var/www/laravel-react/scripts/deploy/sync_navigation_media_to_prod.sh [--dry-run] [--yes]

What it does:
- validates no duplicate (room,title) in DEV/PROD navigation_routes
- compares DEV vs PROD map_image_path/map_polyline
- backups PROD navigation_routes
- updates only map_image_path/map_polyline in PROD
- syncs only storage/app/public/nav from DEV to PROD
- verifies PROD map_image_path URLs over HTTPS
USAGE
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes) ASSUME_YES=1 ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown argument: $arg" ;;
    esac
done

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
        log "DRY-RUN: $(redact_command_for_log "$*")"
    else
        eval "$@"
    fi
}

confirm_yes() {
    local answer
    read -r -p "Type YES to continue: " answer
    [[ "$answer" == "YES" ]]
}

env_value() {
    local key="$1"
    local env_file="$2"
    grep -E "^${key}=" "$env_file" | tail -n1 | cut -d= -f2-
}

require_command mysql
require_command mysqldump
require_command gzip
require_command rsync
require_command curl
require_command php

[[ -d "$PROD_ROOT" ]] || fail "Missing PROD root: $PROD_ROOT"
[[ -d "$DEV_ROOT" ]] || fail "Missing DEV root: $DEV_ROOT"
[[ -f "$PROD_ROOT/.env" ]] || fail "Missing PROD .env"
[[ -f "$DEV_ROOT/.env" ]] || fail "Missing DEV .env"

PROD_DB="$(env_value DB_DATABASE "$PROD_ROOT/.env")"
DEV_DB="$(env_value DB_DATABASE "$DEV_ROOT/.env")"
DB_USER="$(env_value DB_USERNAME "$PROD_ROOT/.env")"
DB_PASS="$(env_value DB_PASSWORD "$PROD_ROOT/.env")"

[[ -n "$PROD_DB" ]] || fail "Unable to read PROD DB_DATABASE"
[[ -n "$DEV_DB" ]] || fail "Unable to read DEV DB_DATABASE"
[[ -n "$DB_USER" ]] || fail "Unable to read PROD DB_USERNAME"

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN mode enabled"
fi

check_duplicates() {
    local db_name="$1"
    local env_name="$2"
    local dup_sql dup_result

    dup_sql="
SELECT room, title, COUNT(*) AS dup_count
FROM ${db_name}.navigation_routes
GROUP BY room, title
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, room, title
LIMIT 100;
"

    dup_result="$(MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -N -B -e "$dup_sql")" || fail "Failed duplicate check query on ${env_name}"
    if [[ -n "$(printf '%s' "$dup_result" | tr -d '[:space:]')" ]]; then
        echo "$dup_result" | awk -F'\t' 'BEGIN {printf "%-20s | %-40s | %s\n", "room", "title", "count"; print "---------------------+------------------------------------------+-------"} {printf "%-20s | %-40s | %s\n", $1, $2, $3}'
        fail "Duplicate (room,title) rows detected in ${env_name}. Resolve duplicates before sync."
    fi
}

log "Checking duplicate route keys in DEV and PROD"
check_duplicates "$DEV_DB" "DEV"
check_duplicates "$PROD_DB" "PROD"

log "Comparing DEV and PROD navigation route map fields"
DIFF_SQL="
SELECT
  d.room,
  d.title,
  COALESCE(d.map_image_path, ''),
  COALESCE(p.map_image_path, ''),
  CASE
    WHEN COALESCE(d.map_image_path, '') <> COALESCE(p.map_image_path, '')
      OR COALESCE(d.map_polyline, '') <> COALESCE(p.map_polyline, '')
    THEN 'changed'
    ELSE 'same'
  END AS status
FROM ${DEV_DB}.navigation_routes d
LEFT JOIN ${PROD_DB}.navigation_routes p
  ON p.room = d.room
 AND p.title = d.title
WHERE
  COALESCE(p.map_image_path, '') <> COALESCE(d.map_image_path, '')
  OR COALESCE(p.map_polyline, '') <> COALESCE(d.map_polyline, '')
ORDER BY d.room, d.title;
"
DIFF_RESULT="$(MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -N -B -e "$DIFF_SQL")" || fail "Failed to query route diff"

if [[ -z "$(printf '%s' "$DIFF_RESULT" | tr -d '[:space:]')" ]]; then
    log "No navigation map differences found."
    log "Nothing to sync."
    exit 0
fi

DIFF_COUNT="$(printf '%s\n' "$DIFF_RESULT" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
log "Navigation map differences count: ${DIFF_COUNT}"
echo "$DIFF_RESULT" | awk -F'\t' 'BEGIN {printf "%-20s | %-35s | %-40s | %-40s | %s\n", "room", "title", "dev_map_image_path", "prod_map_image_path", "status"; print "---------------------+-------------------------------------+------------------------------------------+------------------------------------------+--------"} {printf "%-20s | %-35s | %-40s | %-40s | %s\n", $1, $2, $3, $4, $5}'

log "Collecting navigation media file copy plan (DEV -> PROD)"
RSYNC_PREVIEW="$(rsync -ani --delete "$DEV_ROOT/storage/app/public/nav/" "$PROD_ROOT/storage/app/public/nav/" 2>/dev/null || true)"
RSYNC_FILES="$(printf '%s\n' "$RSYNC_PREVIEW" | awk '/^(>f|cd|cL|hL|\.d)/ {print}')"
if [[ -n "$(printf '%s' "$RSYNC_FILES" | tr -d '[:space:]')" ]]; then
    echo "$RSYNC_FILES"
else
    log "No file-level changes detected in storage/app/public/nav"
fi

if [[ "$ASSUME_YES" != "1" && "$DRY_RUN" != "1" ]]; then
    confirm_yes || fail "Canceled by operator"
fi

TIMESTAMP="$(current_ts)"
BACKUP_DIR="$PROD_ROOT/backups/nav_fix_${TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/prod_navigation_routes_before_fix.sql.gz"

run_cmd "mkdir -p '$BACKUP_DIR'"
run_cmd "MYSQL_PWD='$DB_PASS' mysqldump -u '$DB_USER' --single-transaction --no-tablespaces '$PROD_DB' navigation_routes | gzip -c > '$BACKUP_FILE'"
if [[ "$DRY_RUN" != "1" ]]; then
    gzip -t "$BACKUP_FILE"
fi

UPDATE_SQL="
UPDATE ${PROD_DB}.navigation_routes p
JOIN ${DEV_DB}.navigation_routes d
  ON p.room = d.room
 AND p.title = d.title
SET
  p.map_image_path = d.map_image_path,
  p.map_polyline = d.map_polyline
WHERE
  COALESCE(p.map_image_path, '') <> COALESCE(d.map_image_path, '')
  OR COALESCE(p.map_polyline, '') <> COALESCE(d.map_polyline, '');
"
run_cmd "MYSQL_PWD='$DB_PASS' mysql -u '$DB_USER' -e \"$UPDATE_SQL\""

run_cmd "sudo rsync -av '$DEV_ROOT/storage/app/public/nav/' '$PROD_ROOT/storage/app/public/nav/'"
run_cmd "cd '$PROD_ROOT' && php artisan storage:link || true"
run_cmd "sudo chown -R admaza:www-data '$PROD_ROOT/storage/app/public/nav' '$PROD_ROOT/public/storage/nav'"
run_cmd "sudo find '$PROD_ROOT/storage/app/public/nav' -type d -exec chmod 775 {} \\;"
run_cmd "sudo find '$PROD_ROOT/storage/app/public/nav' -type f -exec chmod 664 {} \\;"
run_cmd "cd '$PROD_ROOT' && php artisan optimize:clear"

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN complete. No changes applied."
    exit 0
fi

log "Verifying PROD map_image_path HTTP 200"
PATH_SQL="SELECT DISTINCT map_image_path FROM ${PROD_DB}.navigation_routes WHERE map_image_path IS NOT NULL AND map_image_path <> '' ORDER BY 1;"
BAD_COUNT=0
while IFS= read -r map_path; do
    [[ -n "$map_path" ]] || continue
    code="$(curl -s -o /dev/null -w '%{http_code}' "https://crm.kaztbu.edu.kz${map_path}")"
    if [[ "$code" != "200" ]]; then
        warn "Broken navigation image ($code): $map_path"
        BAD_COUNT=$(( BAD_COUNT + 1 ))
    fi
done < <(MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -N -B -e "$PATH_SQL")

if [[ "$BAD_COUNT" -gt 0 ]]; then
    fail "Navigation sync completed with broken image links: ${BAD_COUNT}. Investigate before release."
fi

log "Navigation media/data sync completed"
log "Backup file: $BACKUP_FILE"

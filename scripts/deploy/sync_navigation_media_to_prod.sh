#!/usr/bin/env bash
set -Eeuo pipefail

LOG_PREFIX="[sync-nav]"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib_deploy_common.sh"

begin_operation_lock "sync-navigation-media"
trap 'end_operation_lock' EXIT

PROD_ROOT="/var/www/laravel-react"
DEV_ROOT="/var/www/laravel-react-dev"

DRY_RUN=0
ASSUME_YES=0

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --yes) ASSUME_YES=1 ;;
        -h|--help)
            cat <<'USAGE'
Usage:
  /var/www/laravel-react/scripts/deploy/sync_navigation_media_to_prod.sh [--dry-run] [--yes]

What it does:
- backups PROD navigation_routes
- shows DEV vs PROD diff for map_image_path/map_polyline
- updates only map_image_path and map_polyline in PROD
- syncs only storage/app/public/nav from DEV to PROD
- verifies image URLs return HTTP 200
USAGE
            exit 0
            ;;
        *)
            fail "Unknown argument: $arg"
            ;;
    esac
done

run_cmd() {
    if [[ "$DRY_RUN" == "1" ]]; then
    local display_cmd="$*"
    display_cmd="$(printf '%s' "$display_cmd" | sed -E "s/MYSQL_PWD='[^']*'/MYSQL_PWD='[REDACTED]'/g; s/MYSQL_PWD=\"[^\"]*\"/MYSQL_PWD=\"[REDACTED]\"/g")"
    log "DRY-RUN: $display_cmd"
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

SYNC_IDENTITY_KEY=""
JOIN_CONDITION=""

[[ -n "$PROD_DB" ]] || fail "Unable to read PROD DB_DATABASE"
[[ -n "$DEV_DB" ]] || fail "Unable to read DEV DB_DATABASE"
[[ -n "$DB_USER" ]] || fail "Unable to read PROD DB_USERNAME"

column_exists() {
  local db_name="$1"
  local table_name="$2"
  local column_name="$3"
  local q c
  q="SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='${db_name}' AND table_name='${table_name}' AND column_name='${column_name}';"
  c="$(MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -N -B -e "$q" 2>/dev/null || true)"
  [[ "$c" == "1" ]]
}

column_has_data() {
  local db_name="$1"
  local table_name="$2"
  local column_name="$3"
  local q c
  q="SELECT COUNT(*) FROM ${db_name}.${table_name} WHERE ${column_name} IS NOT NULL AND ${column_name} <> '' LIMIT 1;"
  c="$(MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -N -B -e "$q" 2>/dev/null || echo 0)"
  [[ "${c:-0}" -gt 0 ]]
}

select_identity_key() {
  local candidates=(route_uuid uuid external_id navigation_uid)
  for key in "${candidates[@]}"; do
    if column_exists "$DEV_DB" navigation_routes "$key" && column_exists "$PROD_DB" navigation_routes "$key"; then
      if column_has_data "$DEV_DB" navigation_routes "$key" && column_has_data "$PROD_DB" navigation_routes "$key"; then
        SYNC_IDENTITY_KEY="$key"
        JOIN_CONDITION="p.${key} = d.${key}"
        return 0
      fi
    fi
  done

  SYNC_IDENTITY_KEY="room+title"
  JOIN_CONDITION="p.room = d.room AND p.title = d.title"
  return 0
}

select_identity_key
log "Identity key strategy: ${SYNC_IDENTITY_KEY}"
if [[ "$SYNC_IDENTITY_KEY" == "room+title" ]]; then
  warn "Falling back to room+title matching. Introduce immutable route IDs for safer sync."
fi

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN mode enabled"
fi

log "Comparing DEV and PROD navigation route map fields"
DIFF_SQL="
SELECT
  d.room,
  d.title,
  COALESCE(p.map_image_path, ''),
  COALESCE(d.map_image_path, ''),
  CASE
    WHEN COALESCE(p.map_polyline, '') = COALESCE(d.map_polyline, '') THEN 'same'
    ELSE 'diff'
  END AS polyline_diff
FROM ${DEV_DB}.navigation_routes d
LEFT JOIN ${PROD_DB}.navigation_routes p
  ON ${JOIN_CONDITION}
WHERE
  COALESCE(p.map_image_path, '') <> COALESCE(d.map_image_path, '')
  OR COALESCE(p.map_polyline, '') <> COALESCE(d.map_polyline, '')
ORDER BY d.room, d.title
LIMIT 200;
"
DIFF_RESULT="$(MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -N -B -e "$DIFF_SQL")" || fail "Failed to query route diff"

if [[ -z "$(printf '%s' "$DIFF_RESULT" | tr -d '[:space:]')" ]]; then
    log "No navigation map differences found."
    log "Nothing to sync."
    exit 0
fi

log "Navigation differences found (room/title/prod_path/dev_path/polyline_diff):"
printf '%s\n' "$DIFF_RESULT"

if [[ "$ASSUME_YES" != "1" && "$DRY_RUN" != "1" ]]; then
    confirm_yes || fail "Canceled by operator"
fi

TIMESTAMP="$(current_ts)"
BACKUP_DIR="$PROD_ROOT/backups/nav_fix_${TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/prod_navigation_routes_before_fix.sql.gz"
NAV_MEDIA_BACKUP="$BACKUP_DIR/prod_nav_media_before_fix.tar.gz"

run_cmd "mkdir -p '$BACKUP_DIR'"
run_cmd "MYSQL_PWD='$DB_PASS' mysqldump -u '$DB_USER' --single-transaction --no-tablespaces '$PROD_DB' navigation_routes | gzip -c > '$BACKUP_FILE'"
if [[ "$DRY_RUN" != "1" ]]; then
    gzip -t "$BACKUP_FILE"
fi
run_cmd "tar -czf '$NAV_MEDIA_BACKUP' -C '$PROD_ROOT/storage/app/public' nav"
if [[ "$DRY_RUN" != "1" ]]; then
    tar -tzf "$NAV_MEDIA_BACKUP" >/dev/null
fi

UPDATE_SQL="
START TRANSACTION;
UPDATE ${PROD_DB}.navigation_routes p
JOIN ${DEV_DB}.navigation_routes d
  ON ${JOIN_CONDITION}
SET
  p.map_image_path = d.map_image_path,
  p.map_polyline = d.map_polyline
WHERE
  COALESCE(p.map_image_path, '') <> COALESCE(d.map_image_path, '')
  OR COALESCE(p.map_polyline, '') <> COALESCE(d.map_polyline, '');
COMMIT;
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

log "Verifying image URLs from PROD map_image_path"
PATH_SQL="SELECT DISTINCT map_image_path FROM ${PROD_DB}.navigation_routes WHERE map_image_path IS NOT NULL AND map_image_path <> '' ORDER BY 1;"
BAD_COUNT=0
while IFS= read -r map_path; do
    [[ -n "$map_path" ]] || continue
    code="$(curl -s -o /dev/null -w '%{http_code}' "https://crm.kaztbu.edu.kz${map_path}")"
    if [[ "$code" != "200" ]]; then
        warn "Image URL check failed ($code): $map_path"
        BAD_COUNT=$(( BAD_COUNT + 1 ))
    fi
done < <(MYSQL_PWD="$DB_PASS" mysql -u "$DB_USER" -N -B -e "$PATH_SQL")

[[ "$BAD_COUNT" -eq 0 ]] || fail "One or more map images are not reachable over HTTPS"

report_dir="${PROD_ROOT}/storage/app/deploy_reports"
mkdir -p "$report_dir"
journal_file="${report_dir}/runtime_sync_navigation_${TIMESTAMP}.json"
cat > "$journal_file" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "sync_type": "navigation",
  "identity_key": "${SYNC_IDENTITY_KEY}",
  "db_backup": "${BACKUP_FILE}",
  "media_backup": "${NAV_MEDIA_BACKUP}",
  "broken_links": ${BAD_COUNT},
  "source": "${DEV_ROOT}",
  "target": "${PROD_ROOT}"
}
EOF

log "Navigation media/data sync completed"
log "Backup file: $BACKUP_FILE"
log "Media backup: $NAV_MEDIA_BACKUP"
log "Journal: $journal_file"

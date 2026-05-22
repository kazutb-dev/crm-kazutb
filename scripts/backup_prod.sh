#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/var/www/laravel-react"
BACKUPS_ROOT="$PROJECT_ROOT/backups"
DRY_RUN="${BACKUP_DRY_RUN:-0}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$BACKUPS_ROOT/prod_backup_${TIMESTAMP}_full_snapshot"
MANIFEST_FILE="$BACKUP_DIR/manifest_${TIMESTAMP}.txt"

err() {
  echo "[backup_prod] ERROR: $*" >&2
  exit 1
}

log() {
  echo "[backup_prod] $*"
}

get_env_value() {
  local key="$1"
  local env_file="$2"
  local raw
  raw="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  raw="${raw#*=}"
  raw="${raw%$'\r'}"

  if [[ -z "$raw" ]]; then
    echo ""
    return 0
  fi

  if [[ "$raw" == '"'*'"' ]]; then
    raw="${raw:1:${#raw}-2}"
  elif [[ "$raw" == "'"*"'" ]]; then
    raw="${raw:1:${#raw}-2}"
  fi

  echo "$raw"
}

[[ -d "$PROJECT_ROOT" ]] || err "Project root not found: $PROJECT_ROOT"
[[ -d "$BACKUPS_ROOT" ]] || mkdir -p "$BACKUPS_ROOT"

ENV_FILE="$PROJECT_ROOT/.env"
[[ -f "$ENV_FILE" ]] || err ".env not found at $ENV_FILE"

mkdir -p "$BACKUP_DIR"
[[ -d "$BACKUP_DIR" ]] || err "Backup directory was not created: $BACKUP_DIR"

DB_CONNECTION="$(get_env_value "DB_CONNECTION" "$ENV_FILE")"
DB_HOST="$(get_env_value "DB_HOST" "$ENV_FILE")"
DB_PORT="$(get_env_value "DB_PORT" "$ENV_FILE")"
DB_DATABASE="$(get_env_value "DB_DATABASE" "$ENV_FILE")"
DB_USERNAME="$(get_env_value "DB_USERNAME" "$ENV_FILE")"
DB_PASSWORD="$(get_env_value "DB_PASSWORD" "$ENV_FILE")"

DB_CONNECTION="${DB_CONNECTION:-mysql}"

ENV_BACKUP_FILE="$BACKUP_DIR/env_${TIMESTAMP}.backup"
cp "$ENV_FILE" "$ENV_BACKUP_FILE"
chmod 600 "$ENV_BACKUP_FILE"

DB_BACKUP_FILE=""
STORAGE_BACKUP_FILE=""

if [[ "$DRY_RUN" == "1" ]]; then
  log "Running in DRY_RUN mode: database dump and large archives are skipped"

  if [[ "$DB_CONNECTION" == "sqlite" ]]; then
    [[ -n "$DB_DATABASE" ]] || err "DB_DATABASE is empty for sqlite"

    SQLITE_PATH="$DB_DATABASE"
    if [[ "$SQLITE_PATH" != /* ]]; then
      SQLITE_PATH="$PROJECT_ROOT/$SQLITE_PATH"
    fi

    [[ -f "$SQLITE_PATH" ]] || err "SQLite database file not found: $SQLITE_PATH"
  else
    [[ -n "$DB_DATABASE" ]] || err "DB_DATABASE is empty"
    [[ -n "$DB_HOST" ]] || err "DB_HOST is empty"
    [[ -n "$DB_PORT" ]] || err "DB_PORT is empty"
    [[ -n "$DB_USERNAME" ]] || err "DB_USERNAME is empty"
  fi

  [[ -d "$PROJECT_ROOT/storage/app" ]] || err "storage/app directory not found"

  if [[ -d "$PROJECT_ROOT/public/storage" ]]; then
    log "Detected public/storage directory"
  else
    log "public/storage directory not found (skipping in full mode if absent)"
  fi
else
  if [[ "$DB_CONNECTION" == "sqlite" ]]; then
    [[ -n "$DB_DATABASE" ]] || err "DB_DATABASE is empty for sqlite"

    SQLITE_PATH="$DB_DATABASE"
    if [[ "$SQLITE_PATH" != /* ]]; then
      SQLITE_PATH="$PROJECT_ROOT/$SQLITE_PATH"
    fi

    [[ -f "$SQLITE_PATH" ]] || err "SQLite database file not found: $SQLITE_PATH"

    SQLITE_COPY="$BACKUP_DIR/database_${TIMESTAMP}.sqlite"
    cp "$SQLITE_PATH" "$SQLITE_COPY"
    gzip -f "$SQLITE_COPY"
    DB_BACKUP_FILE="${SQLITE_COPY}.gz"
  else
    [[ -n "$DB_DATABASE" ]] || err "DB_DATABASE is empty"
    [[ -n "$DB_HOST" ]] || err "DB_HOST is empty"
    [[ -n "$DB_PORT" ]] || err "DB_PORT is empty"
    [[ -n "$DB_USERNAME" ]] || err "DB_USERNAME is empty"

    DB_BACKUP_FILE="$BACKUP_DIR/database_${TIMESTAMP}.sql.gz"

    MYSQL_PWD="$DB_PASSWORD" mysqldump \
      --single-transaction \
      --routines \
      --triggers \
      --events \
      --no-tablespaces \
      -h"$DB_HOST" \
      -P"$DB_PORT" \
      -u"$DB_USERNAME" \
      "$DB_DATABASE" | gzip -c > "$DB_BACKUP_FILE"
  fi

  [[ -n "$DB_BACKUP_FILE" ]] || err "Database backup file variable is empty"
  [[ -f "$DB_BACKUP_FILE" ]] || err "DB dump was not created: $DB_BACKUP_FILE"
  [[ -s "$DB_BACKUP_FILE" ]] || err "DB dump is zero size: $DB_BACKUP_FILE"
  gzip -t "$DB_BACKUP_FILE" || err "gzip test failed for database backup"

  storage_sources=()
  [[ -d "$PROJECT_ROOT/storage/app" ]] && storage_sources+=("storage/app")
  [[ -d "$PROJECT_ROOT/public/storage" ]] && storage_sources+=("public/storage")

  if [[ ${#storage_sources[@]} -gt 0 ]]; then
    STORAGE_BACKUP_FILE="$BACKUP_DIR/storage_app_${TIMESTAMP}.tar.gz"

    tar -czf "$STORAGE_BACKUP_FILE" \
      -C "$PROJECT_ROOT" \
      --exclude='.git' \
      --exclude='vendor' \
      --exclude='node_modules' \
      --exclude='backups' \
      --exclude='storage/logs' \
      --exclude='storage/framework/cache' \
      --exclude='storage/framework/sessions' \
      --exclude='storage/framework/views' \
      "${storage_sources[@]}"

    [[ -f "$STORAGE_BACKUP_FILE" ]] || err "Storage archive was not created"
    [[ -s "$STORAGE_BACKUP_FILE" ]] || err "Storage archive is zero size"
    tar -tzf "$STORAGE_BACKUP_FILE" >/dev/null || err "Storage archive integrity check failed"
  fi
fi

BRANCH_NAME="$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")"
GIT_HEAD="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")"
GIT_STATUS_SHORT="$(git -C "$PROJECT_ROOT" status --short 2>/dev/null || true)"
HOSTNAME_VALUE="$(hostname)"
USER_VALUE="$(whoami)"

{
  echo "timestamp=$TIMESTAMP"
  echo "hostname=$HOSTNAME_VALUE"
  echo "user=$USER_VALUE"
  echo "project_root=$PROJECT_ROOT"
  echo "git_branch=$BRANCH_NAME"
  echo "git_head=$GIT_HEAD"
  echo "db_connection=$DB_CONNECTION"
  echo "db_database=$DB_DATABASE"
  echo "dry_run=$DRY_RUN"
  echo
  echo "[git_status_short]"
  if [[ -n "$GIT_STATUS_SHORT" ]]; then
    echo "$GIT_STATUS_SHORT"
  else
    echo "clean"
  fi
  echo
  echo "[backup_files]"
  find "$BACKUP_DIR" -maxdepth 1 -type f -printf '%f\n' | sort
} > "$MANIFEST_FILE"

{
  echo
  echo "[sizes]"
  while IFS= read -r file_path; do
    [[ -n "$file_path" ]] || continue
    printf '%s\n' "$(du -h "$file_path" | awk '{print $1"\t"$2}')"
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f | sort)
} >> "$MANIFEST_FILE"

find "$BACKUP_DIR" -maxdepth 1 -type f ! -name 'SHA256SUMS' -print0 \
  | xargs -0 sha256sum > "$BACKUP_DIR/SHA256SUMS"

{
  echo
  echo "[sha256sum]"
  cat "$BACKUP_DIR/SHA256SUMS"
} >> "$MANIFEST_FILE"

TOTAL_SIZE="$(du -sh "$BACKUP_DIR" | awk '{print $1}')"

log "Backup completed"
log "backup directory: $BACKUP_DIR"
log "database backup file: ${DB_BACKUP_FILE:-not-created}"
log "storage backup file: ${STORAGE_BACKUP_FILE:-not-created}"
log "env backup file: $ENV_BACKUP_FILE"
log "manifest: $MANIFEST_FILE"
log "total size: $TOTAL_SIZE"

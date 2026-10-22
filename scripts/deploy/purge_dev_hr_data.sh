#!/usr/bin/env bash
# Clears the personal data of the HR hiring module («Приём на работу») from a DEV copy after it was refreshed
# from PROD: employee files, hirings, generated documents, previews and their files. The data is personal
# (IIN, ID cards, scans) and is encrypted with the PROD APP_KEY, which DEV does not have.
# Kept: templates, employer settings, case forms of the catalog (no personal data).
#
# Usage: purge_dev_hr_data.sh <dev_root> [--db] [--files]   (no flag = both)
set -Eeuo pipefail

LOG_PREFIX="[hr-purge]"
PROD_ROOT="/home/admaza/projects/du"

log() { printf '%s %s\n' "$LOG_PREFIX" "$*"; }
fail() { printf '%s ERROR: %s\n' "$LOG_PREFIX" "$*" >&2; exit 1; }

DEV_ROOT="${1:-}"
shift || true
[[ -n "$DEV_ROOT" && -d "$DEV_ROOT" ]] || fail "DEV root missing: ${DEV_ROOT:-<empty>}"

PURGE_DB=0
PURGE_FILES=0
for arg in "$@"; do
    case "$arg" in
        --db) PURGE_DB=1 ;;
        --files) PURGE_FILES=1 ;;
        *) fail "Unknown argument: $arg" ;;
    esac
done
if [[ "$PURGE_DB" == "0" && "$PURGE_FILES" == "0" ]]; then
    PURGE_DB=1
    PURGE_FILES=1
fi

DEV_ROOT="$(cd "$DEV_ROOT" && pwd -P)"
[[ "$DEV_ROOT" != "$(cd "$PROD_ROOT" 2>/dev/null && pwd -P || echo "$PROD_ROOT")" ]] || fail "Refusing to purge the PROD checkout"

ENV_FILE="$DEV_ROOT/.env"
[[ -f "$ENV_FILE" ]] || fail ".env missing: $ENV_FILE"
env_value() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
[[ "$(env_value APP_ENV)" != "production" ]] || fail "Refusing to purge an APP_ENV=production installation"

# Child tables first; FOREIGN_KEY_CHECKS is off for the TRUNCATE anyway.
HR_PERSONAL_TABLES=(
    hr_document_previews
    hr_documents
    hr_employment_contracts
    hr_hirings
    hr_employee_attachments
    hr_employee_educations
    hr_employee_children
    hr_employees
)
# Relative to the private disk root (storage/app/private); hr/templates stays.
HR_PERSONAL_DIRS=(hr/employees hr/documents hr/previews)

if [[ "$PURGE_DB" == "1" ]]; then
    [[ "$(env_value DB_CONNECTION)" == "mysql" ]] || fail "HR purge supports MySQL only (DB_CONNECTION=$(env_value DB_CONNECTION))"
    export MYSQL_PWD
    MYSQL_PWD="$(env_value DB_PASSWORD)"
    mysql_dev=(mysql -h"$(env_value DB_HOST)" -P"$(env_value DB_PORT)" -u"$(env_value DB_USERNAME)" "$(env_value DB_DATABASE)")

    in_list="$(printf "'%s'," "${HR_PERSONAL_TABLES[@]}")"
    existing="$("${mysql_dev[@]}" -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${in_list%,})")"

    if [[ -z "$existing" ]]; then
        log "No HR tables in DEV database, nothing to clear"
    else
        sql="SET FOREIGN_KEY_CHECKS=0;"
        for table in "${HR_PERSONAL_TABLES[@]}"; do
            if grep -qx "$table" <<< "$existing"; then
                sql+=" TRUNCATE TABLE \`$table\`;"
            fi
        done
        sql+=" SET FOREIGN_KEY_CHECKS=1;"
        "${mysql_dev[@]}" -e "$sql"
        log "Cleared HR tables: $(tr '\n' ' ' <<< "$existing")"
    fi
fi

if [[ "$PURGE_FILES" == "1" ]]; then
    for dir in "${HR_PERSONAL_DIRS[@]}"; do
        path="$DEV_ROOT/storage/app/private/$dir"
        if [[ -d "$path" ]]; then
            rm -rf "$path"
            log "Removed $path"
        fi
    done
fi

log "HR personal data cleared in $DEV_ROOT"

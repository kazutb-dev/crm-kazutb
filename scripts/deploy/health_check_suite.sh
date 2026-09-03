#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib_deploy_common.sh"

PROD_ROOT="/home/admaza/projects/du"
DEV_ROOT="/home/admaza/projects/laravel-react-dev"
TARGET="${1:-all}"
JSON_OUTPUT=0

if [[ "${TARGET}" == "--json" ]]; then
    TARGET="all"
    JSON_OUTPUT=1
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        prod|dev|all)
            TARGET="$1"
            shift
            ;;
        --json)
            JSON_OUTPUT=1
            shift
            ;;
        -h|--help)
            cat <<'USAGE'
Usage:
  ./scripts/deploy/health_check_suite.sh [prod|dev|all] [--json]
USAGE
            exit 0
            ;;
        *)
            echo "[health] ERROR: unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

PASS=0
WARN=0
FAIL=0
DETAILS=""

add_detail() {
    local level="$1"
    local check="$2"
    local msg="$3"
    DETAILS+="${level}|${check}|${msg}"$'\n'
}

pass_check() {
    local check="$1"
    local msg="$2"
    PASS=$((PASS + 1))
    add_detail "PASS" "$check" "$msg"
}

warn_check() {
    local check="$1"
    local msg="$2"
    WARN=$((WARN + 1))
    add_detail "WARN" "$check" "$msg"
}

fail_check() {
    local check="$1"
    local msg="$2"
    FAIL=$((FAIL + 1))
    add_detail "FAIL" "$check" "$msg"
}

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/}"
    printf '%s' "$s"
}

check_http_code() {
    local name="$1"
    local url="$2"
    local expected_regex="$3"
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"

    if [[ "$code" =~ $expected_regex ]]; then
        pass_check "$name" "HTTP $code for $url"
    elif [[ "$code" == "000" ]]; then
        fail_check "$name" "No HTTP response from $url"
    else
        warn_check "$name" "Unexpected HTTP $code for $url"
    fi
}

# Like check_http_code but uses fail_check (not warn_check) for any 5xx response.
# Use for routes that must never return a server error.
check_critical_route() {
    local name="$1"
    local url="$2"
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$code" == "000" ]]; then
        fail_check "$name" "No HTTP response (connection failed) for $url"
    elif [[ "$code" =~ ^5 ]]; then
        fail_check "$name" "HTTP $code (server error) for $url — route is broken"
    else
        pass_check "$name" "HTTP $code for $url"
    fi
}

check_db_connectivity() {
    local root="$1"
    local name="$2"
    local env_file="$root/.env"

    if [[ ! -f "$env_file" ]]; then
        fail_check "$name DB env" "Missing .env"
        return
    fi

    local db_connection db_host db_port db_name db_user db_pass
    db_connection="$(grep -E '^DB_CONNECTION=' "$env_file" | tail -n1 | cut -d= -f2-)"
    db_host="$(grep -E '^DB_HOST=' "$env_file" | tail -n1 | cut -d= -f2-)"
    db_port="$(grep -E '^DB_PORT=' "$env_file" | tail -n1 | cut -d= -f2-)"
    db_name="$(grep -E '^DB_DATABASE=' "$env_file" | tail -n1 | cut -d= -f2-)"
    db_user="$(grep -E '^DB_USERNAME=' "$env_file" | tail -n1 | cut -d= -f2-)"
    db_pass="$(grep -E '^DB_PASSWORD=' "$env_file" | tail -n1 | cut -d= -f2-)"

    if [[ "${db_connection:-mysql}" == "sqlite" ]]; then
        local sqlite_path="$db_name"
        [[ "$sqlite_path" == /* ]] || sqlite_path="$root/$sqlite_path"
        if [[ -f "$sqlite_path" ]]; then
            pass_check "$name DB" "sqlite file exists: $sqlite_path"
        else
            fail_check "$name DB" "sqlite file missing: $sqlite_path"
        fi
        return
    fi

    if ! command -v mysql >/dev/null 2>&1; then
        warn_check "$name DB" "mysql client not available"
        return
    fi

    local result
    result="$(MYSQL_PWD="$db_pass" mysql -h"$db_host" -P"$db_port" -u"$db_user" -N -B -e "SELECT 1" "$db_name" 2>/dev/null || true)"
    if [[ "$result" == "1" ]]; then
        pass_check "$name DB" "DB connectivity OK"
    else
        fail_check "$name DB" "DB connectivity failed"
    fi
}

check_env_root() {
    local root="$1"
    local name="$2"

    [[ -d "$root" ]] || { fail_check "$name root" "missing root $root"; return; }

    if [[ -f "$root/.env" ]]; then
        pass_check "$name env" ".env exists"
    else
        fail_check "$name env" ".env missing"
    fi

    if grep -E '^APP_KEY=' "$root/.env" >/dev/null 2>&1; then
        local app_key
        app_key="$(grep -E '^APP_KEY=' "$root/.env" | tail -n1 | cut -d= -f2-)"
        if [[ -n "$app_key" ]]; then
            pass_check "$name APP_KEY" "APP_KEY present"
        else
            fail_check "$name APP_KEY" "APP_KEY empty"
        fi
    else
        fail_check "$name APP_KEY" "APP_KEY missing"
    fi

    if [[ -f "$root/public/build/manifest.json" ]]; then
        pass_check "$name build manifest" "public/build/manifest.json exists"
    else
        fail_check "$name build manifest" "public/build/manifest.json missing"
    fi

    if [[ -w "$root/storage" && -w "$root/bootstrap/cache" ]]; then
        pass_check "$name storage perms" "storage and bootstrap/cache writable"
    else
        fail_check "$name storage perms" "storage or bootstrap/cache not writable"
    fi

    if (cd "$root" && php artisan about >/dev/null 2>&1); then
        pass_check "$name artisan" "php artisan about OK"
    else
        fail_check "$name artisan" "php artisan about failed"
    fi

    if (cd "$root" && php artisan migrate:status >/dev/null 2>&1); then
        pass_check "$name migrations" "php artisan migrate:status OK"
    else
        warn_check "$name migrations" "php artisan migrate:status failed"
    fi

    check_db_connectivity "$root" "$name"
}

if [[ "$TARGET" == "prod" || "$TARGET" == "all" ]]; then
    check_env_root "$PROD_ROOT" "PROD"
    check_http_code "PROD home" "https://crm.kaztbu.edu.kz/" '^(2|3|4)[0-9][0-9]$'
    check_http_code "PROD login" "https://crm.kaztbu.edu.kz/login" '^(2|3|4)[0-9][0-9]$'
    check_critical_route "PROD /certificates"          "https://crm.kaztbu.edu.kz/certificates"
    check_critical_route "PROD /certificates/registry" "https://crm.kaztbu.edu.kz/certificates/registry"
    check_critical_route "PROD /templates"             "https://crm.kaztbu.edu.kz/templates"
fi

if [[ "$TARGET" == "dev" || "$TARGET" == "all" ]]; then
    check_env_root "$DEV_ROOT" "DEV"
    check_http_code "DEV home" "https://dev-crm.kaztbu.edu.kz/" '^(2|3|4)[0-9][0-9]$'
    check_http_code "DEV login" "https://dev-crm.kaztbu.edu.kz/login" '^(2|3|4)[0-9][0-9]$'
fi

STATUS="PASS"
if [[ "$FAIL" -gt 0 ]]; then
    STATUS="FAIL"
elif [[ "$WARN" -gt 0 ]]; then
    STATUS="WARN"
fi

if [[ "$JSON_OUTPUT" == "1" ]]; then
    printf '{"status":"%s","pass":%d,"warn":%d,"fail":%d,"details":[' "$STATUS" "$PASS" "$WARN" "$FAIL"
    first=1
    while IFS='|' read -r level check msg; do
        [[ -n "$level" ]] || continue
        if [[ "$first" -eq 0 ]]; then
            printf ','
        fi
        first=0
        printf '{"level":"%s","check":"%s","message":"%s"}' "$(json_escape "$level")" "$(json_escape "$check")" "$(json_escape "$msg")"
    done <<< "$DETAILS"
    printf ']}'
    echo
else
    echo "=================================="
    echo "KazUTB CRM Health Check Summary"
    echo "=================================="
    echo "STATUS: $STATUS"
    echo "PASS:   $PASS"
    echo "WARN:   $WARN"
    echo "FAIL:   $FAIL"
    echo ""
    while IFS='|' read -r level check msg; do
        [[ -n "$level" ]] || continue
        echo "[$level] $check - $msg"
    done <<< "$DETAILS"
fi

if [[ "$STATUS" == "FAIL" ]]; then
    exit 2
fi

exit 0

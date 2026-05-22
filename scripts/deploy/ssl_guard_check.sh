#!/usr/bin/env bash
set -Eeuo pipefail

CERT_FILE="/var/www/laravel-react/ssl/fullchain.pem"
KEY_FILE="/var/www/laravel-react/ssl/private.key"
HOSTS=("crm.kaztbu.edu.kz" "dev-crm.kaztbu.edu.kz")
LOCAL_ENDPOINT="127.0.0.1:443"
PUBLIC_PORT="443"
EXPIRY_WARN_DAYS="${EXPIRY_WARN_DAYS:-21}"
RELOAD_ON_MISMATCH=0

if [[ "${1:-}" == "--reload-on-mismatch" ]]; then
    RELOAD_ON_MISMATCH=1
fi

log() {
    printf '[ssl-guard] %s\n' "$*"
}

fail() {
    printf '[ssl-guard] ERROR: %s\n' "$*" >&2
}

require_file() {
    local path="$1"
    if [[ ! -f "$path" ]]; then
        fail "File not found: $path"
        exit 1
    fi
}

get_fp_from_file() {
    openssl x509 -in "$1" -noout -fingerprint -sha256 | cut -d= -f2
}

get_fp_from_socket() {
    local target="$1"
    local sni="$2"
    echo | openssl s_client -connect "$target" -servername "$sni" 2>/dev/null \
        | openssl x509 -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2
}

cert_key_match() {
    local cert_md5 key_md5
    cert_md5="$(openssl x509 -noout -modulus -in "$CERT_FILE" | openssl md5 | awk '{print $2}')"
    key_md5="$(openssl rsa -noout -modulus -in "$KEY_FILE" | openssl md5 | awk '{print $2}')"
    [[ "$cert_md5" == "$key_md5" ]]
}

check_expiry() {
    local end_ts now_ts remaining_days
    end_ts="$(date -d "$(openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f2)" +%s)"
    now_ts="$(date +%s)"
    remaining_days="$(( (end_ts - now_ts) / 86400 ))"
    if (( remaining_days < EXPIRY_WARN_DAYS )); then
        log "WARN: certificate expires in ${remaining_days} days"
    else
        log "PASS: certificate expires in ${remaining_days} days"
    fi
}

check_live_against_file() {
    local expected="$1"
    local mismatches=0

    for host in "${HOSTS[@]}"; do
        local fp_local fp_public

        fp_local="$(get_fp_from_socket "$LOCAL_ENDPOINT" "$host" || true)"
        fp_public="$(get_fp_from_socket "${host}:${PUBLIC_PORT}" "$host" || true)"

        if [[ -z "$fp_local" ]]; then
            fail "Unable to read local certificate via SNI for ${host}"
            (( mismatches++ )) || true
        elif [[ "$fp_local" != "$expected" ]]; then
            fail "Local certificate mismatch for ${host}: ${fp_local}"
            (( mismatches++ )) || true
        else
            log "PASS: local certificate matches for ${host}"
        fi

        if [[ -z "$fp_public" ]]; then
            fail "Unable to read public certificate for ${host}"
            (( mismatches++ )) || true
        elif [[ "$fp_public" != "$expected" ]]; then
            fail "Public certificate mismatch for ${host}: ${fp_public}"
            (( mismatches++ )) || true
        else
            log "PASS: public certificate matches for ${host}"
        fi
    done

    return "$mismatches"
}

require_file "$CERT_FILE"
require_file "$KEY_FILE"

log "Starting SSL guard check"

if ! cert_key_match; then
    fail "Certificate and private key do not match"
    exit 1
fi
log "PASS: certificate and private key match"

check_expiry

EXPECTED_FP="$(get_fp_from_file "$CERT_FILE")"
if [[ -z "$EXPECTED_FP" ]]; then
    fail "Unable to read fingerprint from ${CERT_FILE}"
    exit 1
fi
log "Expected fingerprint: ${EXPECTED_FP}"

if check_live_against_file "$EXPECTED_FP"; then
    log "PASS: all live endpoints serve the expected certificate"
    exit 0
fi

if (( RELOAD_ON_MISMATCH == 0 )); then
    fail "Live endpoints mismatch expected certificate"
    exit 1
fi

log "Attempting nginx reload due to mismatch"
if ! systemctl reload nginx; then
    fail "nginx reload failed"
    exit 1
fi

sleep 1

if check_live_against_file "$EXPECTED_FP"; then
    log "PASS: nginx reload fixed certificate mismatch"
    exit 0
fi

fail "Mismatch persists after nginx reload"
exit 1

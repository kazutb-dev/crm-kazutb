#!/usr/bin/env bash
set -Eeuo pipefail

CERT_FILE="/home/admaza/projects/du/ssl/fullchain.pem"
KEY_FILE="/home/admaza/projects/du/ssl/private.key"
HOSTS=("crm.kaztbu.edu.kz")
SELECTED_HOSTS=()
LOCAL_ENDPOINT="127.0.0.1:443"
PUBLIC_PORT="443"
EXPIRY_WARN_DAYS="${EXPIRY_WARN_DAYS:-21}"
RELOAD_ON_MISMATCH=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --reload-on-mismatch)
            RELOAD_ON_MISMATCH=1
            shift
            ;;
        --domain)
            if [[ -z "${2:-}" ]]; then
                fail "--domain requires a hostname argument"
                exit 1
            fi
            SELECTED_HOSTS+=("$2")
            shift 2
            ;;
        *)
            fail "Unknown argument: $1"
            exit 1
            ;;
    esac
done

if (( ${#SELECTED_HOSTS[@]} == 0 )); then
    SELECTED_HOSTS=("${HOSTS[@]}")
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

get_verify_line_from_socket() {
    local target="$1"
    local sni="$2"
    echo | openssl s_client -connect "$target" -servername "$sni" 2>/dev/null \
        | grep -E 'Verify return code' | tail -n 1
}

get_san_from_socket() {
    local target="$1"
    local sni="$2"
    echo | openssl s_client -connect "$target" -servername "$sni" 2>/dev/null \
        | openssl x509 -noout -ext subjectAltName 2>/dev/null
}

host_matches_san() {
    local host="$1"
    local san_dump="$2"

    local san_entries
    san_entries="$(echo "$san_dump" | grep -o 'DNS:[^, ]*' | sed 's/^DNS://')"
    if [[ -z "$san_entries" ]]; then
        return 1
    fi

    while IFS= read -r dns_name; do
        [[ -z "$dns_name" ]] && continue

        if [[ "$dns_name" == "$host" ]]; then
            return 0
        fi

        if [[ "$dns_name" == \*.* ]]; then
            local suffix host_labels suffix_labels
            suffix="${dns_name#*.}"
            host_labels="$(awk -F. '{print NF}' <<< "$host")"
            suffix_labels="$(awk -F. '{print NF}' <<< "$suffix")"

            if [[ "$host" == *".${suffix}" ]] && (( host_labels == suffix_labels + 1 )); then
                return 0
            fi
        fi
    done <<< "$san_entries"

    return 1
}

check_https_head() {
    local host="$1"
    curl -I -sS --max-time 15 "https://${host}" >/dev/null
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

    for host in "${SELECTED_HOSTS[@]}"; do
        local fp_local fp_public local_verify public_verify local_san public_san

        fp_local="$(get_fp_from_socket "$LOCAL_ENDPOINT" "$host" || true)"
        fp_public="$(get_fp_from_socket "${host}:${PUBLIC_PORT}" "$host" || true)"
        local_verify="$(get_verify_line_from_socket "$LOCAL_ENDPOINT" "$host" || true)"
        public_verify="$(get_verify_line_from_socket "${host}:${PUBLIC_PORT}" "$host" || true)"
        local_san="$(get_san_from_socket "$LOCAL_ENDPOINT" "$host" || true)"
        public_san="$(get_san_from_socket "${host}:${PUBLIC_PORT}" "$host" || true)"

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

        if [[ "$local_verify" != *"Verify return code: 0 (ok)"* ]]; then
            fail "Local verify failed for ${host}: ${local_verify:-missing verify line}"
            (( mismatches++ )) || true
        else
            log "PASS: local verify return code is 0 for ${host}"
        fi

        if [[ "$public_verify" != *"Verify return code: 0 (ok)"* ]]; then
            fail "Public verify failed for ${host}: ${public_verify:-missing verify line}"
            (( mismatches++ )) || true
        else
            log "PASS: public verify return code is 0 for ${host}"
        fi

        if ! host_matches_san "$host" "$local_san"; then
            fail "Local SAN does not match host ${host}"
            (( mismatches++ )) || true
        else
            log "PASS: local SAN matches ${host}"
        fi

        if ! host_matches_san "$host" "$public_san"; then
            fail "Public SAN does not match host ${host}"
            (( mismatches++ )) || true
        else
            log "PASS: public SAN matches ${host}"
        fi

        if ! check_https_head "$host"; then
            fail "HTTPS HEAD request failed for ${host}"
            (( mismatches++ )) || true
        else
            log "PASS: HTTPS HEAD request succeeded for ${host}"
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

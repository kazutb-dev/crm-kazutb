#!/usr/bin/env bash
set -Eeuo pipefail

PROD_ROOT="/var/www/laravel-react"
BACKUP_ROOT="${PROD_ROOT}/backups"
MODE="list"
TARGET=""
JSON_OUTPUT=0

usage() {
    cat <<'USAGE'
Usage:
  ./scripts/deploy/backup_inventory.sh list [--json]
  ./scripts/deploy/backup_inventory.sh inspect <backup_dir_name> [--json]
USAGE
}

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/}"
    printf '%s' "$s"
}

[[ -d "$BACKUP_ROOT" ]] || { echo "[backup-inventory] ERROR: missing $BACKUP_ROOT" >&2; exit 1; }

if [[ $# -gt 0 ]]; then
    MODE="$1"
    shift
fi

case "$MODE" in
    list)
        ;;
    inspect)
        TARGET="${1:-}"
        [[ -n "$TARGET" ]] || { usage; exit 1; }
        shift || true
        ;;
    -h|--help)
        usage
        exit 0
        ;;
    *)
        usage
        exit 1
        ;;
esac

for arg in "$@"; do
    case "$arg" in
        --json) JSON_OUTPUT=1 ;;
        *) echo "[backup-inventory] ERROR: unknown arg $arg" >&2; exit 1 ;;
    esac
done

if [[ "$MODE" == "list" ]]; then
    mapfile -t dirs < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot*' -printf '%T@|%f|%p\n' | sort -t'|' -k1,1nr)

    if [[ "$JSON_OUTPUT" == "1" ]]; then
        printf '{"backups":['
        first=1
        for rec in "${dirs[@]}"; do
            ts="${rec%%|*}"
            rest="${rec#*|}"
            name="${rest%%|*}"
            path="${rec##*|}"
            size="$(du -sh "$path" 2>/dev/null | awk '{print $1}')"
            state="complete"
            [[ "$name" == *.incomplete ]] && state="incomplete"
            valid="unknown"
            if [[ "$state" == "complete" ]]; then
                if ls "$path"/database_*.sql.gz >/dev/null 2>&1 && ls "$path"/project_data_*.tar.gz >/dev/null 2>&1; then
                    valid="likely"
                else
                    valid="invalid"
                fi
            fi
            [[ "$first" -eq 0 ]] && printf ','
            first=0
            printf '{"name":"%s","size":"%s","state":"%s","valid":"%s"}' "$(json_escape "$name")" "$(json_escape "$size")" "$state" "$valid"
        done
        printf ']}'
        echo
        exit 0
    fi

    echo "=================================="
    echo "KazUTB Backup Inventory"
    echo "=================================="
    printf '%-46s | %-10s | %-10s | %-8s\n' "name" "size" "state" "valid"
    echo "----------------------------------------------------------------------------------------------"
    for rec in "${dirs[@]}"; do
        rest="${rec#*|}"
        name="${rest%%|*}"
        path="${rec##*|}"
        size="$(du -sh "$path" 2>/dev/null | awk '{print $1}')"
        state="complete"
        [[ "$name" == *.incomplete ]] && state="incomplete"
        valid="unknown"
        if [[ "$state" == "complete" ]]; then
            if ls "$path"/database_*.sql.gz >/dev/null 2>&1 && ls "$path"/project_data_*.tar.gz >/dev/null 2>&1; then
                valid="likely"
            else
                valid="invalid"
            fi
        fi
        printf '%-46s | %-10s | %-10s | %-8s\n' "$name" "${size:-n/a}" "$state" "$valid"
    done
    exit 0
fi

backup_path="$BACKUP_ROOT/$TARGET"
[[ -d "$backup_path" ]] || { echo "[backup-inventory] ERROR: backup not found: $TARGET" >&2; exit 1; }

manifest_file="$(ls -1 "$backup_path"/manifest_*.txt 2>/dev/null | head -n1 || true)"
sha_file="$backup_path/SHA256SUMS"
db_file="$(ls -1 "$backup_path"/database_*.sql.gz 2>/dev/null | head -n1 || true)"
project_file="$(ls -1 "$backup_path"/project_data_*.tar.gz 2>/dev/null | head -n1 || true)"

gzip_ok="no"
if [[ -n "$db_file" ]] && gzip -t "$db_file" >/dev/null 2>&1; then
    gzip_ok="yes"
fi

tar_ok="no"
if [[ -n "$project_file" ]] && tar -tzf "$project_file" >/dev/null 2>&1; then
    tar_ok="yes"
fi

sha_ok="no"
if [[ -f "$sha_file" ]] && (cd "$backup_path" && sha256sum -c SHA256SUMS >/dev/null 2>&1); then
    sha_ok="yes"
fi

if [[ "$JSON_OUTPUT" == "1" ]]; then
    printf '{"name":"%s","manifest_present":%s,"sha_present":%s,"gzip_ok":%s,"tar_ok":%s,"sha_ok":%s}' \
        "$(json_escape "$TARGET")" \
        "$([[ -n "$manifest_file" ]] && echo true || echo false)" \
        "$([[ -f "$sha_file" ]] && echo true || echo false)" \
        "$([[ "$gzip_ok" == "yes" ]] && echo true || echo false)" \
        "$([[ "$tar_ok" == "yes" ]] && echo true || echo false)" \
        "$([[ "$sha_ok" == "yes" ]] && echo true || echo false)"
    echo
    exit 0
fi

echo "=================================="
echo "Backup Inspection: $TARGET"
echo "=================================="
echo "path:             $backup_path"
echo "manifest present: $([[ -n "$manifest_file" ]] && echo yes || echo no)"
echo "sha present:      $([[ -f "$sha_file" ]] && echo yes || echo no)"
echo "gzip test:        $gzip_ok"
echo "tar test:         $tar_ok"
echo "sha verify:       $sha_ok"

if [[ -n "$manifest_file" ]]; then
    echo ""
    echo "Manifest: $manifest_file"
fi

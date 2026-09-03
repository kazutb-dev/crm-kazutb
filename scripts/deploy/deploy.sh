#!/usr/bin/env bash
# deploy.sh — KazUTB CRM interactive deployment platform
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_ROOT="/home/admaza/projects/du"
DEV_ROOT="/home/admaza/projects/laravel-react-dev"
PLATFORM_ROOT="${PROD_ROOT}/storage/app/deploy_platform"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/kazutb-deploy.lock}"
LOCK_META_FILE="${LOCK_FILE}.meta"
HISTORY_FILE="${PLATFORM_ROOT}/history/operations.jsonl"
REPORT_DIR="${PLATFORM_ROOT}/reports"

if [[ ! -w "$(dirname "$LOCK_FILE")" ]]; then
    LOCK_FILE="/tmp/kazutb-deploy.lock"
    LOCK_META_FILE="${LOCK_FILE}.meta"
fi

if [[ -t 1 ]]; then
    C_RESET='\033[0m'
    C_BOLD='\033[1m'
    C_RED='\033[31m'
    C_GREEN='\033[32m'
    C_YELLOW='\033[33m'
    C_BLUE='\033[34m'
    C_CYAN='\033[36m'
else
    C_RESET=''
    C_BOLD=''
    C_RED=''
    C_GREEN=''
    C_YELLOW=''
    C_BLUE=''
    C_CYAN=''
fi

info() { echo -e "${C_BLUE}[deploy]${C_RESET} $*"; }
warn() { echo -e "${C_YELLOW}[deploy] WARN:${C_RESET} $*"; }
err() { echo -e "${C_RED}[deploy] ERROR:${C_RESET} $*" >&2; }

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/}"
    printf '%s' "$s"
}

ensure_platform_dirs() {
    mkdir -p "${PLATFORM_ROOT}/history" "$REPORT_DIR"
}

acquire_lock() {
    local op="$1"
    ensure_platform_dirs
    touch "$LOCK_FILE"
    exec {DEPLOY_LOCK_FD}>"$LOCK_FILE"
    if ! flock -n "$DEPLOY_LOCK_FD"; then
        err "Another deployment operation is running."
        lock_status
        return 1
    fi
    cat > "$LOCK_META_FILE" <<EOF
operation=${op}
owner=$(whoami)
pid=$$
host=$(hostname)
started_at=$(date -Iseconds)
cwd=$(pwd)
EOF
    return 0
}

release_lock() {
    if [[ -n "${DEPLOY_LOCK_FD:-}" ]]; then
        rm -f "$LOCK_META_FILE" || true
        flock -u "$DEPLOY_LOCK_FD" || true
        eval "exec ${DEPLOY_LOCK_FD}>&-" || true
        unset DEPLOY_LOCK_FD
    fi
}

lock_status() {
    echo "Lock file: $LOCK_FILE"

    touch "$LOCK_FILE"
    exec {LOCK_STATUS_FD}>"$LOCK_FILE"
    if flock -n "$LOCK_STATUS_FD"; then
        flock -u "$LOCK_STATUS_FD" || true
        eval "exec ${LOCK_STATUS_FD}>&-" || true
        if [[ -f "$LOCK_META_FILE" ]]; then
            echo "status=unlocked (stale metadata present)"
            cat "$LOCK_META_FILE"
        else
            echo "status=unlocked"
        fi
    else
        eval "exec ${LOCK_STATUS_FD}>&-" || true
        if [[ -f "$LOCK_META_FILE" ]]; then
            cat "$LOCK_META_FILE"
        else
            echo "status=locked (metadata unavailable)"
        fi
    fi
}

force_unlock() {
    local confirm="${1:-}"
    [[ "$confirm" == "YES-FORCE-UNLOCK" ]] || {
        err "Force unlock requires exact token: YES-FORCE-UNLOCK"
        return 1
    }

    touch "$LOCK_FILE"
    exec {FORCE_UNLOCK_FD}>"$LOCK_FILE"
    if flock -n "$FORCE_UNLOCK_FD"; then
        # Lock is free now. Clean stale metadata only.
        rm -f "$LOCK_META_FILE"
        flock -u "$FORCE_UNLOCK_FD" || true
        eval "exec ${FORCE_UNLOCK_FD}>&-" || true
        info "Lock metadata cleared safely (no active lock holder)."
        return 0
    fi

    eval "exec ${FORCE_UNLOCK_FD}>&-" || true
    err "Active lock holder detected. Refusing unsafe force-unlock to prevent split-brain."
    err "Use lock-status and stop the running operation first."
    return 1
}

record_operation() {
    local op="$1"
    local status="$2"
    local risk="$3"
    local start_ts="$4"
    local end_ts="$5"
    local cmdline="$6"
    ensure_platform_dirs
    printf '{"ts":"%s","operation":"%s","status":"%s","risk":"%s","start":"%s","end":"%s","operator":"%s","host":"%s","command":"%s"}\n' \
        "$(date -Iseconds)" "$(json_escape "$op")" "$(json_escape "$status")" "$(json_escape "$risk")" \
        "$(json_escape "$start_ts")" "$(json_escape "$end_ts")" "$(json_escape "$(whoami)")" "$(json_escape "$(hostname)")" \
        "$(json_escape "$cmdline")" >> "$HISTORY_FILE"
}

run_locked_script() {
    local op="$1"
    local risk="$2"
    local script="$3"
    shift 3

    local start_ts end_ts rc
    start_ts="$(date -Iseconds)"

    acquire_lock "$op" || return 1

    info "Operation: $op"
    info "Risk level: $risk"
    info "Lock acquired: $LOCK_FILE"

    set +e
    DEPLOY_LOCK_HELD=1 \
    DEPLOY_LOCK_OPERATION="$op" \
    DEPLOY_ROUTED_BY_ENTRYPOINT=1 \
    DEPLOY_ENTRYPOINT_ROOT="$DEV_ROOT" \
    DEPLOY_ENTRYPOINT_COMMAND="$op" \
    "$script" "$@"
    rc=$?
    set -e

    end_ts="$(date -Iseconds)"
    if [[ "$rc" -eq 0 ]]; then
        record_operation "$op" "success" "$risk" "$start_ts" "$end_ts" "$script $*"
    else
        record_operation "$op" "failed($rc)" "$risk" "$start_ts" "$end_ts" "$script $*"
    fi

    release_lock
    return "$rc"
}

require_dev_checkout_for_mutation() {
    local cmd="$1"
    local current_root
    local expected_root
    current_root="$(pwd -P)"
    expected_root="$(cd "$DEV_ROOT" 2>/dev/null && pwd -P || echo "$DEV_ROOT")"

    if [[ "$current_root" != "$expected_root" ]]; then
        err "Command '$cmd' must be initiated from ${DEV_ROOT}."
        err "Re-run from ${DEV_ROOT}: ./scripts/deploy/deploy.sh $cmd ..."
        return 1
    fi
}

show_history() {
    ensure_platform_dirs
    if [[ ! -f "$HISTORY_FILE" ]]; then
        echo "No history yet: $HISTORY_FILE"
        return 0
    fi
    tail -n 30 "$HISTORY_FILE"
}

show_readiness() {
    local prod_clean dev_clean latest_backup health_status runtime_drift

    prod_clean="NO"
    dev_clean="NO"
    latest_backup="NO"
    health_status="UNKNOWN"
    runtime_drift="UNKNOWN"

    [[ -z "$(git -C "$PROD_ROOT" status --short 2>/dev/null || true)" ]] && prod_clean="YES"
    [[ -z "$(git -C "$DEV_ROOT" status --short 2>/dev/null || true)" ]] && dev_clean="YES"
    find "$PROD_ROOT/backups" -mindepth 1 -maxdepth 1 -type d -name 'prod_backup_*_full_snapshot' ! -name '*.incomplete' | head -n1 >/dev/null && latest_backup="YES"

    if "${SCRIPT_DIR}/health_check_suite.sh" prod >/dev/null 2>&1; then
        health_status="PASS"
    else
        health_status="WARN/FAIL"
    fi

    if "${SCRIPT_DIR}/incident_tools.sh" drift-runtime 2>/dev/null | grep -q "\[DRIFT\]"; then
        runtime_drift="YES"
    else
        runtime_drift="NO"
    fi

    echo "Current PROD state:"
    echo "- branch clean: $prod_clean"
    echo "- latest valid backup: $latest_backup"
    echo "- runtime drift: $runtime_drift"
    echo "- health baseline: $health_status"
    echo "Current DEV state:"
    echo "- branch clean: $dev_clean"
    echo ""

    if [[ "$prod_clean" == "YES" && "$latest_backup" == "YES" && "$runtime_drift" == "NO" ]]; then
        echo -e "Release readiness: ${C_GREEN}${C_BOLD}SAFE${C_RESET}"
    else
        echo -e "Release readiness: ${C_YELLOW}${C_BOLD}CAUTION${C_RESET}"
    fi
}

confirm_typed() {
    local prompt="$1"
    local token="$2"
    local answer
    read -r -p "$prompt (type $token): " answer
    [[ "$answer" == "$token" ]]
}

runtime_sync_menu() {
    echo ""
    echo "Runtime Sync"
    echo "1. navigation DEV -> PROD"
    echo "2. public-assets DEV -> PROD"
    echo "3. public-assets PROD -> DEV"
    echo "4. Back"
    read -r -p "Choose option: " opt
    case "$opt" in
        1) dispatch sync-runtime --type navigation ;;
        2) dispatch sync-runtime --type public-assets --direction dev-to-prod ;;
        3) dispatch sync-runtime --type public-assets --direction prod-to-dev ;;
        *) ;;
    esac
}

interactive_console() {
    while true; do
        clear 2>/dev/null || true
        echo "=================================="
        echo "KazUTB CRM Deployment Console"
        echo "=================================="
        show_readiness
        echo ""
        echo "1. Safety audit"
        echo "2. Release DEV -> PROD"
        echo "3. Backup PROD"
        echo "4. Runtime sync"
        echo "5. Rollback"
        echo "6. PROD -> DEV recovery"
        echo "7. Health checks"
        echo "8. SSL checks"
        echo "9. Incident tools"
        echo "10. Backup inventory"
        echo "11. Operation history"
        echo "12. Lock status"
        echo "13. Exit"
        echo ""
        read -r -p "Choose option: " choice

        case "$choice" in
            1) dispatch safety ;;
            2)
                echo "RISK: High (production release)"
                confirm_typed "Confirm release" "RELEASE-PROD" && dispatch release || warn "Release canceled"
                ;;
            3) dispatch backup-prod ;;
            4) runtime_sync_menu ;;
            5)
                read -r -p "Enter rollback tag (pre-deploy-...): " tag
                [[ -n "$tag" ]] && confirm_typed "Rollback is CODE-ONLY, DB restore is manual" "ROLLBACK-CODE-ONLY" && dispatch rollback --tag "$tag" --yes || warn "Rollback canceled"
                ;;
            6)
                echo "RISK: High (destructive DEV refresh)"
                confirm_typed "Confirm PROD->DEV" "REFRESH-DEV" && dispatch prod-to-dev || warn "Operation canceled"
                ;;
            7) dispatch health ;;
            8) dispatch ssl-check ;;
            9)
                echo "1. drift-git"
                echo "2. drift-runtime"
                echo "3. orphaned-nav"
                echo "4. broken-storage"
                echo "5. backup-validate"
                read -r -p "Incident command: " ic
                case "$ic" in
                    1) dispatch incident drift-git ;;
                    2) dispatch incident drift-runtime ;;
                    3) dispatch incident orphaned-nav ;;
                    4) dispatch incident broken-storage ;;
                    5) dispatch incident backup-validate ;;
                    *) ;;
                esac
                ;;
            10) dispatch backup-inventory list ;;
            11) dispatch history ;;
            12) dispatch lock-status ;;
            13) break ;;
            *) warn "Unknown option" ;;
        esac

        echo ""
        read -r -p "Press Enter to continue..." _
    done
}

usage() {
    cat <<'EOF'
deploy.sh — KazUTB CRM deployment platform

Usage:
  ./scripts/deploy/deploy.sh                 # interactive console
  ./scripts/deploy/deploy.sh <command> [options]

Core commands:
  safety
  health [prod|dev|all] [--json]
  release [--dry-run] [--yes] [--no-migrate] [--skip-build] [--force-protected-delete]
  backup-prod [--dry-run]
  rollback --tag TAG [--dry-run] [--yes]
  prod-to-dev [--dry-run] [--yes] [--skip-db] [--skip-files] [--skip-build] [--skip-migrate] [--no-auto-recover] [--fix-dev-app-key]
  sync-runtime --type navigation [--dry-run] [--yes]
  sync-runtime --type public-assets --direction dev-to-prod|prod-to-dev [--dry-run] [--yes]
  ssl-check

Platform commands:
  lock-status
  force-unlock --token YES-FORCE-UNLOCK
  history
  backup-inventory list|inspect <name>
  incident drift-git|drift-runtime|orphaned-nav|broken-storage|backup-validate
  interactive
  help

Compatibility:
  Legacy wrappers remain available:
  - deploy_dev_to_prod.sh
  - refresh_dev_from_prod.sh
EOF
}

dispatch() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        release|backup-prod|sync-runtime|prod-to-dev|rollback)
            require_dev_checkout_for_mutation "$cmd" || return 1
            ;;
    esac

    case "$cmd" in
        safety)
            "${SCRIPT_DIR}/check_deploy_safety.sh" "$@"
            ;;
        health)
            "${SCRIPT_DIR}/health_check_suite.sh" "$@"
            ;;
        release)
            run_locked_script "release" "high" "${SCRIPT_DIR}/dev_to_prod_release.sh" "$@"
            ;;
        backup-prod)
            local dry_run_flag=0
            local passthrough=()
            for a in "$@"; do
                [[ "$a" == "--dry-run" ]] && dry_run_flag=1 || passthrough+=("$a")
            done
            export BACKUP_DRY_RUN="$dry_run_flag"
            run_locked_script "backup-prod" "medium" "${PROD_ROOT}/scripts/backup_prod.sh" "${passthrough[@]}"
            ;;
        sync-runtime)
            local sync_type=""
            local sync_args=()
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --type)
                        sync_type="${2:-}"
                        shift 2
                        ;;
                    *)
                        sync_args+=("$1")
                        shift
                        ;;
                esac
            done

            case "$sync_type" in
                navigation)
                    run_locked_script "runtime-sync-navigation" "medium" "${SCRIPT_DIR}/sync_navigation_media_to_prod.sh" "${sync_args[@]}"
                    ;;
                public-assets)
                    run_locked_script "runtime-sync-public-assets" "medium" "${SCRIPT_DIR}/sync_public_assets.sh" "${sync_args[@]}"
                    ;;
                *)
                    err "sync-runtime requires --type navigation|public-assets"
                    return 1
                    ;;
            esac
            ;;
        prod-to-dev)
            run_locked_script "prod-to-dev" "high" "${SCRIPT_DIR}/prod_to_dev_sync.sh" "$@"
            ;;
        rollback)
            local rollback_tag=""
            local rb_args=()
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --tag)
                        rollback_tag="${2:-}"
                        shift 2
                        ;;
                    *)
                        rb_args+=("$1")
                        shift
                        ;;
                esac
            done
            [[ -n "$rollback_tag" ]] || { err "rollback requires --tag"; return 1; }
            run_locked_script "rollback" "critical" "${SCRIPT_DIR}/rollback_prod_to_tag.sh" "$rollback_tag" "${rb_args[@]}"
            ;;
        ssl-check)
            "${SCRIPT_DIR}/ssl_guard_check.sh" "$@"
            ;;
        incident)
            "${SCRIPT_DIR}/incident_tools.sh" "$@"
            ;;
        backup-inventory)
            "${SCRIPT_DIR}/backup_inventory.sh" "$@"
            ;;
        lock-status)
            lock_status
            ;;
        force-unlock)
            local token=""
            if [[ "${1:-}" == "--token" ]]; then
                token="${2:-}"
            fi
            force_unlock "$token"
            ;;
        history)
            show_history
            ;;
        interactive|console)
            interactive_console
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            err "Unknown command: $cmd"
            usage
            return 1
            ;;
    esac
}

if [[ $# -eq 0 ]]; then
    interactive_console
    exit 0
fi

dispatch "$@"

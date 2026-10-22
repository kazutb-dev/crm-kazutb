#!/usr/bin/env bash
# Deploy scripts run as separate processes and do not inherit deploy.sh's info(). A bare `info` call then runs
# /usr/bin/info (texinfo), which exits 1 and trips the ERR trap: the release of 2026-10-22 rolled itself back
# after a passing smoke check this way.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/scripts/deploy"

bash -n "${DEPLOY_DIR}/dev_to_prod_release.sh"

offenders=()
for script in "${DEPLOY_DIR}"/*.sh; do
    grep -qE '^\s*info\(\)' "$script" "${DEPLOY_DIR}/lib_deploy_common.sh" && continue
    if grep -nE '(^|[;&|(]|\s)info "' "$script" >/dev/null; then
        offenders+=("$(basename "$script")")
    fi
done

if (( ${#offenders[@]} > 0 )); then
    echo "info() is not defined in: ${offenders[*]} (use log from lib_deploy_common.sh)" >&2
    exit 1
fi

echo "phase003_release_log_helpers: ok"

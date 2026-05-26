#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

bash -n \
  "${ROOT_DIR}/scripts/deploy/deploy.sh" \
  "${ROOT_DIR}/scripts/deploy/lib_deploy_common.sh" \
  "${ROOT_DIR}/scripts/deploy/dev_to_prod_release.sh"

(cd /tmp && "${ROOT_DIR}/scripts/deploy/deploy.sh" release --dry-run --yes) 2>&1 | grep -q "/var/www/laravel-react-dev"
(cd "${ROOT_DIR}" && ./scripts/deploy/dev_to_prod_release.sh --dry-run) 2>&1 | grep -q "deploy.sh release"

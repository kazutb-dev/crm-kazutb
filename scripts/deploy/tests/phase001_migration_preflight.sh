#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

bash -n \
  "${ROOT_DIR}/scripts/deploy/lib_deploy_common.sh" \
  "${ROOT_DIR}/scripts/deploy/dev_to_prod_release.sh" \
  "${ROOT_DIR}/scripts/deploy/check_deploy_safety.sh"

grep -q "print_migration_preflight" "${ROOT_DIR}/scripts/deploy/lib_deploy_common.sh"
grep -q "print_migration_preflight" "${ROOT_DIR}/scripts/deploy/dev_to_prod_release.sh"
grep -q "print_migration_preflight" "${ROOT_DIR}/scripts/deploy/check_deploy_safety.sh"
grep -q "DIRTY PROD BLOCKER" "${ROOT_DIR}/scripts/deploy/dev_to_prod_release.sh"

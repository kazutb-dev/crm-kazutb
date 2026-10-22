#!/usr/bin/env bash
# The DEV purge of HR personal data must never run against PROD.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PURGE="${ROOT_DIR}/scripts/deploy/purge_dev_hr_data.sh"

bash -n "$PURGE" "${ROOT_DIR}/scripts/deploy/prod_to_dev_sync.sh"

prod_output="$(bash "$PURGE" /home/admaza/projects/du 2>&1 || true)"
grep -q "Refusing to purge the PROD checkout" <<< "$prod_output"

fake_root="$(mktemp -d)"
trap 'rm -rf "$fake_root"' EXIT
printf 'APP_ENV=production\nDB_CONNECTION=mysql\n' > "$fake_root/.env"
env_output="$(bash "$PURGE" "$fake_root" 2>&1 || true)"
grep -q "Refusing to purge an APP_ENV=production installation" <<< "$env_output"

grep -q 'purge_dev_hr_data.sh' "${ROOT_DIR}/scripts/deploy/prod_to_dev_sync.sh"

echo "phase002_hr_purge_guards: ok"

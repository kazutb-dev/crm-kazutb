---
status: testing
phase: phase-001-baseline-safety-enforcement
source: phase-001-01-SUMMARY.md
started: 2026-05-26T11:43:57Z
updated: 2026-05-26T11:43:57Z
---

## Current Test

number: 1
name: Release blocked outside dev checkout
expected: |
  Running `scripts/deploy/deploy.sh release --dry-run --yes` from a non-dev working directory fails
  with a blocking message that explicitly points to `/var/www/laravel-react-dev`.
awaiting: user response

## Tests

### 1. Release blocked outside dev checkout
expected: Running `scripts/deploy/deploy.sh release --dry-run --yes` outside `/var/www/laravel-react-dev` fails with explicit dev-path guidance.
result: [pending]

### 2. Direct release script execution is rejected
expected: Running `./scripts/deploy/dev_to_prod_release.sh --dry-run` directly is blocked and instructs to use `deploy.sh release`.
result: [pending]

### 3. Migration preflight appears in release dry-run
expected: `./scripts/deploy/deploy.sh release --dry-run --yes` prints a dedicated migration preflight section with pending migration and rollback-feasibility signal.
result: [pending]

### 4. Dirty PROD fail-fast is explicit
expected: If PROD tree is dirty, release dry-run exits before migration execution path and shows `DIRTY PROD BLOCKER` (or equivalent explicit blocker text).
result: [pending]

### 5. Operator docs enforce deploy entrypoint policy
expected: `docs/deployment.md` and `docs/release-policy.md` both describe deploy.sh from `/var/www/laravel-react-dev` as the authoritative release path.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

None yet.

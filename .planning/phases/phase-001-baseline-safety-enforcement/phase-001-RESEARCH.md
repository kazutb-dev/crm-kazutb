# Phase 1 Research — Baseline Safety Enforcement

**Date:** 2026-05-26  
**Phase:** 1 (Baseline Safety Enforcement)  
**Requirements:** MIGR-01, MIGR-02, RSEC-01

## Current State

### Deployment orchestration

- Canonical entrypoint is `scripts/deploy/deploy.sh`.
- `deploy.sh` routes high-risk operations via `dispatch release -> run_locked_script -> scripts/deploy/dev_to_prod_release.sh`.
- `deploy.sh` currently defines:
  - `DEV_ROOT="/var/www/laravel-react-dev"`
  - `PROD_ROOT="/var/www/laravel-react"`
  - readiness check showing PROD/DEV cleanliness (`show_readiness`).

### Release pipeline behavior (`scripts/deploy/dev_to_prod_release.sh`)

- Has hard preconditions already:
  - PROD on `main`, DEV on `dev`.
  - `require_clean_git_or_checkpoint "$PROD_ROOT" fail` (blocks dirty PROD).
  - dangerous migration and protected deletion checks using `origin/main..origin/dev`.
- Migration-related behavior:
  - Always prints `php artisan migrate:status` before migration.
  - Supports `--no-migrate`.
  - Runs `php artisan migrate --force` unless `--no-migrate`.
- Gap: no explicit preflight section that clearly summarizes migration readiness + rollback-feasibility signal before mutating steps.

### Safety audit behavior (`scripts/deploy/check_deploy_safety.sh`)

- Checks PROD cleanliness, branch state, dangerous migrations, changed seeders, backups, SSL, and HTTP probes.
- Gap: migration readiness output in safety path is not explicitly unified with release preflight presentation.

## Recommended Changes

### MIGR-01 — hard dirty-PROD block before migration execution

1. Keep `require_clean_git_or_checkpoint "$PROD_ROOT" fail` as non-bypassable release gate.
2. Add explicit log banner in release flow: "DIRTY PROD BLOCKER: migration and release halted" when failing.
3. Ensure gate runs before checkpoint/build/migration phases.

### MIGR-02 — migration preflight + rollback-feasibility signal

1. Add shared helper in `scripts/deploy/lib_deploy_common.sh`:
   - `release_migration_preflight <prod_root> <from_ref> <to_ref>`
2. Helper outputs:
   - pending migration status (`php artisan migrate:status` condensed signal)
   - dangerous migration detection result (reuse existing detector)
   - rollback-feasibility signal (heuristic based on migration file patterns in diff, flagged as `LOW|MEDIUM|HIGH` risk)
3. Call helper from:
   - `dev_to_prod_release.sh` before live mutation path
   - `check_deploy_safety.sh` to keep operator signals aligned

### RSEC-01 — enforce deploy entrypoint from dev repo

1. In `deploy.sh`, validate current working directory resolves under `/var/www/laravel-react-dev` for mutating commands (`release`, `prod-to-dev`, `rollback`, runtime sync).
2. In `dev_to_prod_release.sh`, add invocation provenance guard:
   - allow only when launched via `deploy.sh` dispatch (env marker or lock metadata signal).
   - reject direct script execution with remediation text: `./scripts/deploy/deploy.sh release ...`.
3. Keep read-only diagnostics (`help`, `history`, `lock-status`) available without cwd restriction.

## File-Level Impact

1. **`scripts/deploy/lib_deploy_common.sh`**
   - Add reusable migration preflight formatter and helper.
   - Optionally add invocation guard helper shared by release scripts.
2. **`scripts/deploy/deploy.sh`**
   - Add cwd guard for mutating commands.
   - Set and pass release-routing marker env var for downstream script provenance checks.
3. **`scripts/deploy/dev_to_prod_release.sh`**
   - Enforce deploy-entrypoint-only invocation.
   - Emit migration preflight block before mutate path.
4. **`scripts/deploy/check_deploy_safety.sh`**
   - Reuse/reflect migration preflight signal output for consistency.
5. **Docs (`docs/deployment.md`, `docs/release-policy.md`)**
   - Ensure only deploy.sh-from-dev instructions are described as valid production release path.

## Risks & Mitigations

1. **Risk:** Over-strict cwd/provenance checks block valid operational usage.
   - **Mitigation:** Restrict checks to mutating commands, provide explicit remediation command.
2. **Risk:** Rollback-feasibility heuristic gives false confidence.
   - **Mitigation:** Label as signal/heuristic, not guarantee; keep manual DBA recovery path documented.
3. **Risk:** Duplicated logic between safety and release scripts diverges over time.
   - **Mitigation:** centralize preflight helper in `lib_deploy_common.sh`.

## Verification Strategy

1. Syntax validation:
   - `bash -n scripts/deploy/deploy.sh scripts/deploy/lib_deploy_common.sh scripts/deploy/dev_to_prod_release.sh scripts/deploy/check_deploy_safety.sh`
2. Behavior checks:
   - Running release from wrong cwd fails with explicit message.
   - Direct execution of `dev_to_prod_release.sh` fails unless routed by deploy entrypoint.
   - `./scripts/deploy/deploy.sh release --dry-run --yes` prints migration preflight block before release path.
   - Dirty PROD state blocks release before migration path.
3. Documentation checks:
   - release docs contain deploy.sh-from-dev authoritative path and mention dirty-PROD + preflight interpretation.

## Open Questions (RESOLVED)

1. **Should direct execution of `dev_to_prod_release.sh` remain allowed for emergencies?**  
   **Resolution:** No for Phase 1. Production mutation flow is standardized through `deploy.sh` only (RSEC-01); emergency handling still goes through `deploy.sh` with explicit confirmations.
2. **Is rollback-feasibility a guarantee?**  
   **Resolution:** No. It is an advisory preflight signal; runbook/manual DBA rollback procedures remain authoritative.
3. **Do we need to rework lock/typed confirmation logic in this phase?**  
   **Resolution:** No. Existing controls remain as-is in Phase 1; deeper guardrail hardening is deferred to Phase 2 by roadmap design.

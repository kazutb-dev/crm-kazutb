# Validation Strategy — Phase 1 Baseline Safety Enforcement

**Phase:** 1  
**Requirements:** MIGR-01, MIGR-02, RSEC-01  
**Date:** 2026-05-26

## Validation Architecture

Validation is executed at three levels:

1. **Static/script integrity checks**
   - Shell syntax and command wiring checks for deploy scripts.
2. **Behavioral gate checks**
   - Entry-point and cwd guard behavior for release initiation.
   - Dirty-PROD fail-fast release behavior.
3. **Operator-output checks**
   - Migration preflight visibility and ordering in release dry-run/safety output.

## Requirement-to-Validation Mapping

| Requirement | Validation approach | Evidence signal |
|---|---|---|
| MIGR-01 | Simulate dirty PROD and assert release exits before migration path | Command exits non-zero; no migration execution log path reached |
| MIGR-02 | Run release dry-run and inspect preflight block content/order | Output contains pending migration + rollback-feasibility before release mutate sequence |
| RSEC-01 | Execute release from wrong cwd and direct-script path | Guarded errors instruct using `scripts/deploy/deploy.sh` from dev repo |

## Deterministic Checks

1. `bash -n scripts/deploy/deploy.sh scripts/deploy/lib_deploy_common.sh scripts/deploy/dev_to_prod_release.sh scripts/deploy/check_deploy_safety.sh`
2. Wrong-cwd guard check:
   - `(cd /tmp && /var/www/laravel-react-dev/scripts/deploy/deploy.sh release --dry-run --yes)` must fail with dev-repo guidance.
3. Direct-script guard check:
   - `(cd /var/www/laravel-react-dev && ./scripts/deploy/dev_to_prod_release.sh --dry-run)` must fail with deploy.sh routing guidance.
4. Preflight signal check:
   - `./scripts/deploy/deploy.sh release --dry-run --yes` must print migration preflight fields including rollback-feasibility signal.

## Failure Criteria

Any of the following fails validation:

- Release path can be initiated outside `/var/www/laravel-react-dev`.
- Direct execution of `dev_to_prod_release.sh` can mutate or proceed without deploy router context.
- Dirty PROD does not block release before migration path.
- Migration preflight output is missing, ambiguous, or appears after mutate steps.

## Exit Condition

Phase 1 plan is validation-ready when all deterministic checks are defined and directly tied to MIGR-01, MIGR-02, and RSEC-01.

# Phase Context — Phase 1: Baseline Safety Enforcement

**Source:** /gsd-plan-phase 1  
**Phase:** 1  
**Phase directory:** `.planning/phases/phase-001-baseline-safety-enforcement`

## Phase Boundary

This phase focuses only on baseline safety enforcement for release operations:
1. Hard-block releases when production git tree is dirty (MIGR-01).
2. Add/strengthen migration preflight checks before production release (MIGR-02).
3. Enforce deployment path discipline: run deploy operations from dev repo via `scripts/deploy/deploy.sh` (RSEC-01).

Do not include broader release telemetry, advanced migration canaries, or architecture rewrites in this phase.

## Implementation Decisions

1. **Dev/Prod boundary is strict:** GSD artifacts and implementation planning remain in `/var/www/laravel-react-dev`; production checkout `/var/www/laravel-react` is deploy/sync verification only.
2. **Entrypoint-first policy:** `scripts/deploy/deploy.sh` is the authoritative deployment interface; safety gates should be centralized there or delegated scripts it invokes.
3. **Fail-fast safety:** safety checks should stop release before side effects if hard gates fail.
4. **Operator clarity:** preflight status must be visible in command output before proceeding.

## Success Criteria

1. Release attempt exits before migration/release when PROD tree has uncommitted changes.
2. Migration preflight surfaces actionable state (pending migrations + rollback feasibility signal) before release operation starts.
3. Team workflow documentation/instructions clearly points to dev-repo deploy entrypoint only.

## Risk Summary

- **R1:** False positives in clean-tree checks may block valid releases.
- **R2:** Preflight checks may miss edge cases and provide false confidence.
- **R3:** Operators may bypass entrypoint if guidance is unclear.

## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/codebase/CONCERNS.md`
- `scripts/deploy/deploy.sh`
- `scripts/deploy/dev_to_prod_release.sh`
- `scripts/deploy/check_deploy_safety.sh`
- `scripts/deploy/health_check_suite.sh`

## Specific Ideas

- Introduce a shared hard-gate helper for "PROD git clean" consumed by release path.
- Add explicit migration-preflight output block immediately before release command dispatch.
- Ensure safety checks run in non-interactive mode too (not only console UI path).

## Deferred Ideas

- RSEC-02/RSEC-03 enhancements beyond existing typed confirmations and lock behavior (Phase 2).
- Broader readiness telemetry refactor and history schema enhancements (Phase 3).

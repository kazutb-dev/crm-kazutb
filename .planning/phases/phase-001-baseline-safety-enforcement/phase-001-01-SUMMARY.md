---
phase: phase-001-baseline-safety-enforcement
plan: 01
subsystem: infra
tags: [deploy, release-safety, migrations, bash]
requires: []
provides:
  - Enforced deploy entrypoint discipline for mutating production commands
  - Migration preflight block with pending/rollback-feasibility signals in release and safety flows
  - Operator docs aligned to deploy.sh-only production release policy
affects: [phase-002-migration-control-and-critical-operation-guardrails]
tech-stack:
  added: []
  patterns:
    - Shared shell helper for release invocation and migration preflight
    - Fail-fast dirty PROD blocker before migration execution path
key-files:
  created:
    - scripts/deploy/tests/phase001_entrypoint_guards.sh
    - scripts/deploy/tests/phase001_migration_preflight.sh
  modified:
    - scripts/deploy/deploy.sh
    - scripts/deploy/lib_deploy_common.sh
    - scripts/deploy/dev_to_prod_release.sh
    - scripts/deploy/check_deploy_safety.sh
    - docs/deployment.md
    - docs/release-policy.md
key-decisions:
  - "Release mutation commands are blocked unless deploy.sh is invoked from /var/www/laravel-react-dev."
  - "Migration preflight is emitted before dirty-tree hard fail so operators always see readiness signals."
patterns-established:
  - "deploy.sh sets explicit routing context for downstream scripts to reject direct invocation."
requirements-completed: [MIGR-01, MIGR-02, RSEC-01]
duration: 6min
completed: 2026-05-26
---

# Phase 1 Plan 1: Baseline Safety Enforcement Summary

**Deploy entrypoint-only release routing with migration preflight visibility and dirty-PROD fail-fast hard gate.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-26T11:04:21Z
- **Completed:** 2026-05-26T11:10:42Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Enforced mutating deploy command execution from `/var/www/laravel-react-dev` only via `deploy.sh`.
- Blocked direct `dev_to_prod_release.sh` execution unless routed through deploy entrypoint context.
- Added shared migration preflight output (`pending migration`, `rollback-feasibility`) and aligned safety/release messaging with explicit `DIRTY PROD BLOCKER`.

## Task Commits

1. **Task 1: Enforce deploy entrypoint discipline from dev checkout** - `8aa917e`, `4879637` (test, feat)
2. **Task 2: Add fail-fast migration preflight and rollback-feasibility signal** - `d1f4804`, `9166f6b` (test, feat)
3. **Task 3: Update operator policy docs to match hard gates** - `91f12e7` (docs)

## Files Created/Modified
- `scripts/deploy/deploy.sh` - Added mutating-command cwd guard and release routing env context.
- `scripts/deploy/lib_deploy_common.sh` - Added release routing guard and shared migration preflight helpers.
- `scripts/deploy/dev_to_prod_release.sh` - Enforced deploy routing guard, migration preflight output, and explicit dirty-PROD fail-fast blocker.
- `scripts/deploy/check_deploy_safety.sh` - Reused shared migration preflight output for aligned operator safety view.
- `docs/deployment.md` - Updated release runbook to deploy.sh-only production release path and preflight interpretation.
- `docs/release-policy.md` - Updated non-negotiable policy and gates for preflight and dirty-PROD blocking.
- `scripts/deploy/tests/phase001_entrypoint_guards.sh` - Added shell regression checks for entrypoint guards.
- `scripts/deploy/tests/phase001_migration_preflight.sh` - Added shell regression checks for migration preflight integration.

## Decisions Made
- Enforced release routing using explicit environment markers from deploy router to downstream script.
- Emitted migration preflight before dirty-tree hard fail to keep operator visibility deterministic in dry-run flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjusted test strategy to static shell checks for migration preflight integration**
- **Found during:** Task 2
- **Issue:** Full safety/release runtime checks were non-deterministic in this environment due long-running external probes.
- **Fix:** Added deterministic shell checks that assert preflight helper wiring and dirty-blocker contract in relevant scripts.
- **Files modified:** `scripts/deploy/tests/phase001_migration_preflight.sh`
- **Verification:** `./scripts/deploy/tests/phase001_migration_preflight.sh`
- **Committed in:** `d1f4804`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** No scope expansion; behavior and safety outcomes remain aligned with plan requirements.

## Issues Encountered
- Existing environment has dirty PROD state; release dry-run correctly failed with `DIRTY PROD BLOCKER` after preflight output.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 release safety baseline is enforced in scripts and policy docs.
- Ready for Phase 2 migration control and critical-operation guardrail enhancements.

## Self-Check: PASSED

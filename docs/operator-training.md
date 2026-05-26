# Operator Training (Deploy Platform)

Audience: engineers/operators who execute releases, rollback, sync, and recovery operations.

## Training Goals

- Use only `deploy.sh` for operational actions.
- Understand lock, rollback, and release semantics.
- Distinguish code release from runtime sync and from database recovery.
- Execute dry-runs before any high-risk operation.

## Golden Rules

- Entry point: `./scripts/deploy/deploy.sh` only.
- Never bypass lock system for mutating operations.
- Treat rollback as code-only unless incident lead approves DB restore.
- Do not run manual one-off deploy commands on PROD.

## Core Commands Every Operator Must Know

- `./scripts/deploy/deploy.sh safety`
- `./scripts/deploy/deploy.sh release --dry-run`
- `./scripts/deploy/deploy.sh release`
- `./scripts/deploy/deploy.sh rollback --tag <tag> --dry-run`
- `./scripts/deploy/deploy.sh prod-to-dev --dry-run`
- `./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod --dry-run`
- `./scripts/deploy/deploy.sh lock-status`
- `./scripts/deploy/deploy.sh history`

## Operator Readiness Checklist

- Can explain force-unlock safety behavior and split-brain risk.
- Can explain push-first release source-of-truth semantics.
- Can explain why backup existence is not equal to restore guarantee.
- Can execute dry-run flows and interpret output without escalation.

## Escalation Conditions

- Safety check FAIL.
- Active lock holder with unclear owner.
- Missing or invalid backup before release.
- Runtime drift or health check failures after release.

## Minimum Rehearsal Cadence

- Weekly: safety + release dry-run.
- Weekly: lock-status + lock contention simulation.
- Bi-weekly: backup validation and rollback dry-run.
- Monthly: controlled restore drill in non-production window.

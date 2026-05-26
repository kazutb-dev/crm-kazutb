# Release Policy

Status: Architecture Freeze + Controlled Hardening

Purpose: protect production stability by enforcing one release path and strict pre-release gates.

## Non-Negotiable Rules

- Use only `./scripts/deploy/deploy.sh` for all deployment operations.
- Production release must be initiated from `/var/www/laravel-react-dev` only.
- Manual direct deploy commands are forbidden for routine operations.
- No release without explicit operator approval.
- Rollback is code-only by default; database restore is a separate manual incident action.

## Mandatory Gates Before Release

- `./scripts/deploy/deploy.sh safety` must pass with no FAIL checks.
- `./scripts/deploy/deploy.sh release --dry-run` must be reviewed by operator.
- Dry-run output must include `Migration Preflight` with:
  - `pending migration` (whether unapplied migrations are detected)
  - `rollback-feasibility` (LOW/MEDIUM/HIGH advisory signal for origin/main..origin/dev)
- Latest backup must exist and be valid.
- PROD working tree must be clean.
- If PROD tree is dirty, release must fail immediately with `DIRTY PROD BLOCKER` before any migration execution path.
- Lock status must be clear (`./scripts/deploy/deploy.sh lock-status`).

## Release Flow (Production)

1. Run safety checks.
2. Run release dry-run and review planned creates/modifies/deletes.
3. Confirm backup freshness and health status.
4. Get operator approval.
5. Run release via `deploy.sh`.
6. Verify health and operation history immediately after release.

## Forbidden During Release Window

- Running legacy scripts directly for state-changing operations.
- Running `./scripts/deploy/dev_to_prod_release.sh` directly.
- Mixing deployment with ad-hoc manual file edits on PROD.
- Running destructive DB commands without incident process.

## Required Post-Release Verification

- `./scripts/deploy/deploy.sh health prod`
- `./scripts/deploy/deploy.sh history`
- `./scripts/deploy/deploy.sh incident drift-git`

## Open Risk Register (Not a blocker for small disciplined team)

- Offsite backups are still required.
- Restore drills must be scheduled and repeated.
- Deploy isolation and staging are still missing.
- Immutable artifacts are still missing.

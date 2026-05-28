# Controlled Rehearsal Plan

Objective: validate failure-aware operational behavior without performing a real release.

Scope: no PROD mutation beyond read-only checks and dry-run operations.

## Scenario Set

1. Release dry-run
2. Lock contention visibility
3. Backup validation
4. Rollback dry-run
5. Runtime sync dry-run

## Rehearsal Commands

1. Safety baseline

```bash
./scripts/deploy/deploy.sh safety
```

1. Release dry-run

```bash
./scripts/deploy/deploy.sh release --dry-run
```

1. Lock status

```bash
./scripts/deploy/deploy.sh lock-status
```

1. Backup inventory and validation

```bash
./scripts/deploy/deploy.sh backup-inventory list
./scripts/deploy/deploy.sh incident backup-validate
```

1. Rollback dry-run (replace TAG)

```bash
./scripts/deploy/deploy.sh rollback --tag TAG --dry-run
```

1. Runtime sync dry-run (navigation + public assets)

```bash
./scripts/deploy/deploy.sh sync-runtime --type navigation --dry-run
./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod --dry-run
```

## Pass Criteria

- No unexpected write operations occurred.
- Dry-run output is understandable and complete.
- Operators can describe next action for each warning/failure.
- Backup validation reports at least one valid recoverable snapshot.

## After Rehearsal

- Save command outputs in incident notes.
- Capture action items and assign owners.
- Schedule the next rehearsal date before closing the session.

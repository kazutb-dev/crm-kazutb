# KazUTB CRM Deployment Platform

## 1. Overview

This platform redesign turns deployment scripts into an interactive, lock-aware operational console.

Main entrypoint:

- ./scripts/deploy/deploy.sh

Modes:

- Interactive console mode (no args)
- Command mode (fully backward compatible)

## 2. Architecture

```text
+-----------------------------------------------------------+
| deploy.sh (interactive + command router)                  |
+-------------------+-------------------+-------------------+
                    |                   |
                    v                   v
        +--------------------+  +-----------------------+
        | Lock Manager       |  | Operation Journal     |
        | - lock-status      |  | - JSON history        |
        | - force-unlock     |  | - per-operation logs  |
        +--------------------+  +-----------------------+
                    |
                    v
+-----------------------------------------------------------+
| Managers                                                   |
| - safety: check_deploy_safety.sh                          |
| - health: health_check_suite.sh                           |
| - release: dev_to_prod_release.sh                         |
| - rollback: rollback_prod_to_tag.sh                       |
| - prod-to-dev: prod_to_dev_sync.sh                        |
| - runtime-sync: navigation/public-assets                  |
| - backup: backup_prod.sh + backup_inventory.sh            |
| - incidents: incident_tools.sh                            |
+-----------------------------------------------------------+
```

## 3. Safety Boundaries

- Deploy lock prevents concurrent mutating operations:
  - release
  - rollback
  - prod-to-dev
  - runtime sync
  - backup-prod
- Force-unlock is safety-guarded:
  - it cleans stale metadata only when no active lock holder exists
  - it refuses unlock while holder is active (prevents split-brain)
- Mutating scripts enforce lock at script level too (direct calls cannot bypass router lock)
- Interactive typed confirmations for dangerous flows.
- Operation history persisted to:
  - /var/www/laravel-react/storage/app/deploy_platform/history/operations.jsonl
- Risk-aware console readiness view before actions.

## 4. Release Redesign

Updated release flow in dev_to_prod_release.sh:

1. Preflight and checkpoint
2. Build merge commit in isolated temp workspace
3. Push merged commit to origin/main first
4. Fast-forward local PROD checkout to exact pushed commit
5. Run build, migrate, cache, health
6. Write TXT + JSON release reports

This removes the old "mutate live PROD before final push" pattern.

Failure policy for push-first releases:

- source-of-truth after push is origin/main
- if local PROD steps fail after push, freeze new releases first
- recover by either:
  - completing deploy steps to converge PROD host to pushed commit, or
  - approved rollback to a known commit/tag
- manual emergency rollback command is emitted by script on failure

Simulated failpoint support (for controlled drills):

- set env var RELEASE_FAILPOINT to one of:
  - after-push
  - after-migrate
  - after-health
- example:
  - RELEASE_FAILPOINT=after-push ./scripts/deploy/deploy.sh release --yes

## 5. Runtime Sync Redesign

### Navigation sync

- Identity strategy prefers immutable keys when available:
  - route_uuid, uuid, external_id, navigation_uid
- Falls back to room+title with explicit warning
- Backs up:
  - PROD navigation_routes SQL
  - PROD nav media tar
- Transactional DB update phase (START TRANSACTION/COMMIT)
- JSON sync journal written to deploy reports

### Public-assets sync

- Keeps manifest-driven list
- Creates file-level target backup before overwrite when hashes differ
- Writes JSON sync journal

## 6. Backup Redesign

backup_prod.sh now includes:

- Projected disk safety check before backup starts
- Metadata JSON artifact in each snapshot
- Optional offsite hook support:
  - BACKUP_OFFSITE_HOOK=/path/to/hook.sh

backup_inventory.sh adds:

- list snapshots
- inspect snapshot integrity status

## 7. Rollback Truthfulness

rollback_prod_to_tag.sh now enforces explicit truthfulness:

- Typed confirmation states rollback is code-only
- DB rollback remains manual by design
- TXT + JSON rollback reports include db_restore_reference and migration status hint

## 8. Health System

health_check_suite.sh runs:

- app root checks (env/app key/storage/build manifest)
- artisan checks (about, migrate:status)
- DB connectivity check
- HTTP route checks (home/login)
- PASS/WARN/FAIL summary

## 9. Incident Toolkit

incident_tools.sh commands:

- drift-git
- drift-runtime
- orphaned-nav
- broken-storage
- backup-validate

## 10. Migration Plan (Old -> New)

1. Operators continue existing commands unchanged.
2. Start using interactive console for daily operations:
   - ./scripts/deploy/deploy.sh
3. For automation, keep command mode.
4. For auditing, use:
   - ./scripts/deploy/deploy.sh history
   - ./scripts/deploy/deploy.sh backup-inventory list
   - ./scripts/deploy/deploy.sh incident drift-git
5. Keep legacy wrappers; they remain compatibility shims.

## 11. New Command Reference

- ./scripts/deploy/deploy.sh
- ./scripts/deploy/deploy.sh safety
- ./scripts/deploy/deploy.sh health [prod|dev|all]
- ./scripts/deploy/deploy.sh release [...]
- ./scripts/deploy/deploy.sh backup-prod [--dry-run]
- ./scripts/deploy/deploy.sh sync-runtime --type navigation [...]
- ./scripts/deploy/deploy.sh sync-runtime --type public-assets --direction dev-to-prod|prod-to-dev [...]
- ./scripts/deploy/deploy.sh rollback --tag TAG [...]
- ./scripts/deploy/deploy.sh prod-to-dev [...]
- ./scripts/deploy/deploy.sh lock-status
- ./scripts/deploy/deploy.sh force-unlock --token YES-FORCE-UNLOCK
- ./scripts/deploy/deploy.sh history
- ./scripts/deploy/deploy.sh backup-inventory list
- ./scripts/deploy/deploy.sh backup-inventory inspect SNAPSHOT_NAME
- ./scripts/deploy/deploy.sh incident INCIDENT_COMMAND

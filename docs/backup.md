# Production Backup

## Overview

The `scripts/backup_prod.sh` script creates a local production backup in:

`/var/www/laravel-react/backups/prod_backup_YYYYMMDD_HHMMSS_full_snapshot`

Each full backup contains:

- Database dump (all tables/rows, routines, triggers, events)
- Full project data archive
- `.env` backup (separate file, `chmod 600`)
- Manifest with warnings and cleanup details
- `SHA256SUMS`

Backups are local-only and must not be committed to Git.

## Commands

Full backup:

```bash
cd /var/www/laravel-react
./scripts/backup_prod.sh
```

Dry-run (no DB dump, no archive):

```bash
BACKUP_DRY_RUN=1 ./scripts/backup_prod.sh
```

Cleanup-only (no new backup creation):

```bash
./scripts/backup_prod.sh --cleanup-only
```

or:

```bash
BACKUP_CLEANUP_ONLY=1 ./scripts/backup_prod.sh
```

Retention override examples:

```bash
BACKUP_KEEP_COUNT=1 ./scripts/backup_prod.sh --cleanup-only
BACKUP_KEEP_COUNT=2 ./scripts/backup_prod.sh
BACKUP_KEEP_COUNT=3 ./scripts/backup_prod.sh
```

## Retention Policy

Default: keep latest **2** backup sets.

Cleanup removes old items only inside `/var/www/laravel-react/backups`:

- backup directories matching `prod_backup_*`, `pre_seeder_backup_*`, `pre_deploy_*`
- old loose backup files (groups):
	- `db_backup_*`
	- `laravel_react_*`
	- `pre_deploy_*`
	- `*.manifest`
	- `*.sql.gz`
	- `*.tar.gz`

Safety guards prevent deletion outside backup root and prevent deleting the current backup directory.

## What Is Included In `project_data_*.tar.gz`

If present, the archive includes:

- `storage/` (including `storage/app`, `storage/logs`, runtime files)
- `public/` (including `public/storage`, `public/uploads`)
- `bootstrap/cache/`
- `database/`, `routes/`, `config/`, `app/`, `resources/`, `scripts/`, `docs/`
- `artisan`
- `.env.example`
- `composer.json`, `composer.lock`
- `package.json`, `package-lock.json`
- `vite.config.js`, `tailwind.config.js`, `postcss.config.js`
- optional `uploads/`, `data/`

## What Is Excluded From `project_data_*.tar.gz`

- `.git/`
- `backups/`
- `node_modules/`
- `vendor/`
- `.env` (backed up separately as `env_*.backup`)
- `.DS_Store`

## Tar Warning Handling

If tar reports non-fatal read-change warnings like:

- `file changed as we read it`
- `File removed before we read it`
- `Cannot stat`

then backup continues and warning is recorded in:

- `tar_warnings_YYYYMMDD_HHMMSS.log`
- `manifest_YYYYMMDD_HHMMSS.txt`

Critical tar failures still stop the script.

## Verify Backups

```bash
ls -lah /var/www/laravel-react/backups
du -sh /var/www/laravel-react/backups/*
```

## Manifest And Checksums

For each backup directory:

- `manifest_*.txt` contains metadata, file list, sizes, warnings, cleanup result
- `SHA256SUMS` contains checksum for every file in backup directory

## Safety Notes

- Backups are not committed to Git.
- Do not stage backup artifacts (`backups/`, `*.sql.gz`, `*.tar.gz`, `*.manifest`).
- Script never deletes anything outside `/var/www/laravel-react/backups`.

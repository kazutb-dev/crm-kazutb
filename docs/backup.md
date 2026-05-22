# Production Backup

## Overview

The `scripts/backup_prod.sh` script creates a full production backup of:

- `.env` (permissions: 600)
- Database (MySQL/MariaDB via `mysqldump`, or SQLite copy — both compressed with gzip)
- File storage (`storage/app` and `public/storage` — compressed tar.gz)

Backups are stored **locally only** and are **never committed to Git**.

---

## Quick Start

```bash
cd /var/www/laravel-react
./scripts/backup_prod.sh
```

---

## Dry-Run (No Dump / No Archive)

Validates `.env`, DB credentials, and storage paths without creating large files.
The temporary dry-run directory is removed automatically at the end.

```bash
BACKUP_DRY_RUN=1 ./scripts/backup_prod.sh
```

---

## Where Backups Are Stored

```
/var/www/laravel-react/backups/prod_backup_YYYYMMDD_HHMMSS_full_snapshot/
```

Example contents:

```
env_20260522_061500.backup        # .env copy (chmod 600)
database_20260522_061500.sql.gz   # MySQL dump (gzip)
storage_app_20260522_061500.tar.gz
manifest_20260522_061500.txt
SHA256SUMS
```

---

## Automatic Retention (Keeps Last 2 Backups)

After every successful full backup the script automatically:

1. Finds all `prod_backup_*_full_snapshot` directories inside `/var/www/laravel-react/backups/`
2. Sorts them oldest-first
3. Deletes all except the newest **2** directories
4. Never deletes the backup that was just created
5. Never touches files outside `/var/www/laravel-react/backups/`

```
backups/
├── prod_backup_20260520_100000_full_snapshot/   ← removed (old)
├── prod_backup_20260521_100000_full_snapshot/   ← kept  (2nd newest)
└── prod_backup_20260522_100000_full_snapshot/   ← kept  (newest / just created)
```

### Change the Number of Kept Backups

```bash
BACKUP_KEEP_COUNT=3 ./scripts/backup_prod.sh
```

---

## Verify Backups

```bash
# List backup directories and sizes
ls -lah /var/www/laravel-react/backups

# Disk usage per backup
du -sh /var/www/laravel-react/backups/*
```

---

## Run From Anywhere

```bash
/var/www/laravel-react/scripts/backup_prod.sh
```

---

## Safety

> **Backups are NOT committed to Git.**
> The `/backups/` directory is listed in `.gitignore`.
> Never run `git add backups/`, `git add *.sql.gz`, or `git add *.tar.gz`.

The cleanup logic only removes directories whose paths match **all** of:

- start with `/var/www/laravel-react/backups/prod_backup_`
- end with `_full_snapshot`
- are actual directories (not symlinks or files)
- are not the current backup just created

---

## Environment Variables

| Variable           | Default | Description                                      |
|--------------------|---------|--------------------------------------------------|
| `BACKUP_DRY_RUN`   | `0`     | Set to `1` for dry-run (no dump/archive)         |
| `BACKUP_KEEP_COUNT`| `2`     | Number of most recent backups to keep            |

# PROJECT_CONTEXT.md — KazUTB CRM

> **Canonical single source of truth** for architecture, operations, development
> workflow, deployment model, and long-term maintenance of the KazUTB CRM platform.
>
> Intended audience: engineers, operators, AI coding agents.
> Keep this document up to date when making structural or operational changes.

**Last updated:** 2026-05-27
**Version:** 1.0 (post-restructure)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [DEV vs PROD Philosophy](#3-dev-vs-prod-philosophy)
4. [Deployment Model](#4-deployment-model)
5. [Runtime Sync Model](#5-runtime-sync-model)
6. [Backup Model](#6-backup-model)
7. [Release Workflow](#7-release-workflow)
8. [Git Workflow](#8-git-workflow)
9. [Operational Rules](#9-operational-rules)
10. [Forbidden Operations](#10-forbidden-operations)
11. [Platform Maturity](#11-platform-maturity)
12. [Repository Structure](#12-repository-structure)
13. [Important Scripts](#13-important-scripts)
14. [Storage and Runtime Model](#14-storage-and-runtime-model)
15. [Frontend and Backend Organization](#15-frontend-and-backend-organization)
16. [Database Model](#16-database-model)
17. [Environment Configuration](#17-environment-configuration)
18. [Future Roadmap](#18-future-roadmap)
19. [Team Workflow](#19-team-workflow)
20. [Incident Handling](#20-incident-handling)
21. [Release SOP](#21-release-sop)
22. [Runtime Drift Handling](#22-runtime-drift-handling)
23. [Backup Retention Policy](#23-backup-retention-policy)
24. [Recovery Philosophy](#24-recovery-philosophy)
25. [Technical Debt Register](#25-technical-debt-register)

---

## 1. Project Overview

**KazUTB CRM** is a web-based CRM system for Kazakh University of Technology and
Business (КазУТБ). It automates staff and student workflows across the university.

**Core modules:**

| Module | Status | Description |
|--------|--------|-------------|
| Authentication / RBAC | Production | Role-based access: student, teacher (ПГС), department head (зав. кафедрой), dean, admin, superadmin |
| KPI System | Production | KPI entry, confirmation, rating calculation for academic staff |
| Smart Calendar | Active development | Timetable, events, scheduling |
| Survey Module | Production | Student course quality surveys (анкетирование) |
| Navigation / Catalog | Production | University structural units navigation |
| Tickets | Production | Internal request/ticket system |
| Time Tracker | Production | Work time logging |
| Departments | Production | Department management |
| AI KPI Assistant | Production | AI Q&A assistant for KPI data |

**Production URL:** https://crm.kaztbu.edu.kz
**DEV URL:** https://dev-crm.kaztbu.edu.kz (internal DNS only; NXDOMAIN on public DNS)

**GitHub:** https://github.com/kazutb-dev/crm-kazutb.git

---

## 2. Architecture

**Stack:**

| Layer | Technology |
|-------|-----------|
| Backend | Laravel 11 (PHP 8.3) |
| Frontend | React 18 + Inertia.js |
| Build tool | Vite 5.x |
| CSS | Tailwind CSS 3.x + shadcn/ui |
| Database | MySQL (UTF8MB4) |
| HTTP server | Nginx (PHP-FPM 8.3) |
| Node | 18.19.1 (upgrade to 20 LTS required) |
| Package manager | Composer + npm |
| Queue | Laravel queue (sync driver, cron-based worker) |
| Scheduler | Laravel scheduler (cron-based, flock) |

**Architecture pattern:**
- Laravel monolith with Inertia.js SPA pages
- No API-only backend; all routes server-side rendered through Inertia
- React components as page-level views, shared layouts via Inertia
- RBAC enforced at middleware + policy level

**Key directories:**
```
app/Http/Controllers/   — controllers per module
app/Models/             — Eloquent models
app/Policies/           — authorization policies
resources/js/Pages/     — React page components (Inertia pages)
resources/js/Components/— reusable React components
resources/js/Layouts/   — shared Inertia layouts
routes/web.php          — all web routes
routes/api.php          — API routes (minimal)
database/migrations/    — versioned schema migrations
database/seeders/       — idempotent seeders only
```

---

## 3. DEV vs PROD Philosophy

**Two separate server environments. Two separate repo worktrees. One Git repository.**

| | DEV | PROD |
|--|-----|------|
| Path | `/var/www/laravel-react-dev` | `/var/www/laravel-react` |
| Git branch | `dev` | `main` |
| Nginx vhost | `laravel-react-dev` | `laravel-react` |
| URL | dev-crm.kaztbu.edu.kz | crm.kaztbu.edu.kz |
| Role | Development + staging | Production |
| DB | DEV database (synced from PROD on demand) | Source of truth for user data |
| .env | admaza:www-data 640 | admaza:www-data 640 (target) |

**Core principle:**
- DEV is the **canonical source of truth** for code development.
- All changes are made in DEV first, then released to PROD via the formal release flow.
- PROD is never edited directly for feature work. PROD is only touched via the
  deploy.sh release command or emergency hotfix process.
- DEV database is always a snapshot of PROD (not the other way around).
- PROD database is never overwritten from DEV.

---

## 4. Deployment Model

**Single entrypoint:** `./scripts/deploy/deploy.sh`

All deployment operations go through this script. Direct execution of sub-scripts
for state-changing operations is forbidden for routine work.

**Architecture:**
```
deploy.sh (interactive console + command router)
    ├── Lock Manager (prevents concurrent operations)
    ├── Operation Journal (JSONL history)
    ├── safety      → check_deploy_safety.sh
    ├── health      → health_check_suite.sh
    ├── release     → dev_to_prod_release.sh
    ├── rollback    → rollback_prod_to_tag.sh
    ├── prod-to-dev → prod_to_dev_sync.sh
    ├── runtime-sync → sync_navigation_media_to_prod.sh + sync_public_assets.sh
    ├── backup-prod → backup_prod.sh
    ├── backup-inventory → backup_inventory.sh
    └── incident    → incident_tools.sh
```

**Release model (push-first):**
1. Build merge commit in isolated temp workspace
2. Push merged commit to `origin/main` **first**
3. Fast-forward local PROD checkout to the exact pushed commit
4. Run build → migrate → cache → health
5. Write TXT + JSON release reports

After a push, `origin/main` is the source of truth even if local PROD steps fail.

**Operation lock:** Deploy.sh uses a lock file to prevent concurrent state-changing
operations. Force-unlock is safety-guarded and refuses to unlock while a holder is
active.

**Operation history:** All operations logged to:
```
/var/www/laravel-react/storage/app/deploy_platform/history/operations.jsonl
```

---

## 5. Runtime Sync Model

Some assets are not tracked in Git and must be synced separately:

| Category | Sync command | Notes |
|----------|-------------|-------|
| Navigation / media uploads | `deploy.sh runtime-sync` | Images, files uploaded via CRM UI |
| Public static assets | `deploy.sh sync-public-assets` | Compiled JS/CSS, image assets |

**Manifest-based sync:**
- `scripts/deploy/runtime_public_assets_manifest.txt` defines which public paths are runtime-managed.
- Sync scripts are safe to re-run; they are additive/overwrite only.
- Sync does NOT touch `.env`, `storage/logs`, database.

---

## 6. Backup Model

**Tool:** `./scripts/backup_prod.sh` (also callable via `deploy.sh backup-prod`)

**Each backup snapshot contains:**
- Full database dump (all tables, routines, triggers, events) → `*.sql.gz`
- Full project data archive → `*.tar.gz`
- `.env` backup (mode 600)
- Manifest with warnings
- SHA256 checksums

**Backup path:** `/var/www/laravel-react/backups/prod_backup_YYYYMMDD_HHMMSS_full_snapshot/`

**Retention:** Default keep=2 latest full snapshots.
Override: `BACKUP_KEEP_COUNT=N ./scripts/backup_prod.sh`

**DEV backup:** `scripts/deploy/prod_to_dev_sync.sh` creates a pre-sync DEV backup at:
`/var/www/laravel-react-dev/backups/dev_before_prod_sync_YYYYMMDD_HHMMSS/`
Retention: keep=1 (one pre-sync DEV snapshot at a time)

**Critical gap (open risk):** Backups are **local-only**. No offsite backup solution
is configured. This is the highest-priority unresolved operational risk. Offsite
backup (S3, rclone, remote SFTP) must be implemented before the system is considered
fully production-hardened.

---

## 7. Release Workflow

**Standard release flow:**

```
1. Work on feature branch in DEV (or commit directly to dev branch)
2. Run: deploy.sh safety          # all checks must pass (no FAIL)
3. Run: deploy.sh release --dry-run   # review planned changes
4. Operator approves dry-run output
5. Run: deploy.sh release             # execute release
6. Verify: deploy.sh health prod
7. Verify: deploy.sh incident drift-git
8. Verify: deploy.sh history
```

**Mandatory gates before release:**
- `deploy.sh safety` must show PASS (no FAIL, WARN is acceptable for known issues)
- Dry-run Migration Preflight must be reviewed
- Latest PROD backup must be valid and recent
- PROD working tree must be clean
- Deploy lock must be clear

**Known WARN in safety check (acceptable):**
- Node 18.19.1 below Vite 5.x recommendation (upgrade to Node 20 LTS pending)

---

## 8. Git Workflow

**Branch strategy:**
- `main` — production branch. Reflects exactly what is deployed to PROD.
- `dev` — development branch. All new features and fixes start here.
- Feature branches — short-lived branches off `dev` for larger features (optional).

**Commit discipline:**
- Conventional commits format (type(scope): message)
- Never commit: `.env`, `vendor/`, `node_modules/`, backup archives, SQL dumps, generated output files
- `.gitignore` enforces exclusion of the above

**Pre-commit hook:** `scripts/git-hooks/pre-commit` — validates staged files before commit.

**Safe commit helper:** `scripts/deploy/safecommit.sh` — commit wrapper with safety checks.

**Branch protection rules:**
- `main` receives commits only through the release flow (push from dev_to_prod_release.sh)
- Never `git push --force` on `main`
- Never `git reset --hard` on PROD worktree without a checkpoint tag and backup

---

## 9. Operational Rules

1. **All changes go through DEV first.** No direct feature work on PROD.
2. **Deploy.sh is the only approved entrypoint** for state-changing operations.
3. **Backups before any state change.** Release, rollback, and prod-to-dev create backups automatically.
4. **Dry-run before release.** Always review the dry-run output.
5. **PROD database is sacrosanct.** Never overwrite PROD DB from DEV.
6. **Seeders must be idempotent.** Use `updateOrCreate`, `firstOrCreate`, `upsert`.
7. **No destructive DB commands without backup and explicit confirmation.**
8. **Health check after every release.** Verify PROD is healthy immediately after deploy.
9. **Lock check before operations.** Never force-unlock while a holder is active.
10. **PROD .env is admaza:www-data 640.** Never widen permissions.
11. **Scheduled tasks use cron + flock.** Do not modify without understanding the cron setup.

---

## 10. Forbidden Operations

| Operation | Why Forbidden |
|-----------|--------------|
| `git push --force` on `main` | Destroys release history |
| `git reset --hard` on PROD without checkpoint | Unrecoverable state loss |
| Running `dev_to_prod_release.sh` directly | Bypasses lock, journal, dry-run gate |
| Running `refresh_dev_from_prod.sh` directly | Bypasses backup and safety checks |
| Copying DEV database over PROD | Data loss risk |
| `php artisan migrate:fresh` on PROD | Destroys all production data |
| `php artisan db:seed` with non-idempotent seeders on PROD | Data corruption |
| Committing `.env` files | Security breach |
| Committing `vendor/` or `node_modules/` | Repository bloat |
| Committing SQL dumps or backup archives | Repository bloat + secret exposure |
| Editing PROD files directly for feature work | Bypasses review, creates drift |
| Disabling APP_DEBUG on DEV without restoring | Masks errors during development |
| Running tests on PROD in deploy scripts | Performance + data risk |

---

## 11. Platform Maturity

**Current status: Production with Controlled Hardening**

| Area | Status | Notes |
|------|--------|-------|
| Release flow | ✅ Mature | Push-first model, lock-aware, journaled |
| Safety checks | ✅ Active | 26 PASS, 1 WARN (Node version) |
| Health checks | ✅ Active | health_check_suite.sh |
| Backup (local) | ✅ Active | Full snapshots with SHA256 |
| Backup (offsite) | ❌ Missing | **Critical open risk** |
| Restore drills | ❌ Not done | Required to validate backup usability |
| Deploy isolation / staging | ❌ Missing | DEV serves as staging |
| Immutable build artifacts | ❌ Missing | No artifact registry |
| Node 20 LTS upgrade | ⚠️ Pending | Node 18.19.1 in use |
| PROD APP_DEBUG | ⚠️ Requires fix | Must be false in PROD .env |
| PROD .env permissions | ⚠️ Requires fix | Must be 640 admaza:www-data |
| HSTS / nginx security headers | ⚠️ Missing | Requires privileged nginx edit |
| Cron / queue scheduler | ✅ Configured | User crontab with flock |

---

## 12. Repository Structure

```
laravel-react-dev/          ← DEV repo root (canonical source of truth)
├── app/
│   ├── Console/            ← Artisan commands, scheduler
│   ├── Http/Controllers/   ← Route controllers
│   ├── Models/             ← Eloquent models
│   ├── Policies/           ← Authorization policies
│   └── Services/           ← Business logic services
├── config/                 ← Laravel config files
├── database/
│   ├── migrations/         ← Schema migrations (versioned)
│   └── seeders/            ← Idempotent seeders only
├── docs/                   ← Project documentation (canonical)
│   ├── PROJECT_CONTEXT.md  ← This file (master context)
│   ├── architecture/       ← UI/UX standards, system architecture
│   ├── deployment/         ← deployment.md, deployment-platform.md, release-policy.md
│   ├── operations/         ← backup.md, operator-training.md, controlled-rehearsal.md
│   ├── modules/
│   │   ├── kpi/            ← KPI module technical docs
│   │   └── survey/         ← Survey module technical docs
│   ├── guides/             ← User-facing guides and manuals
│   ├── audits/             ← Pre-production certification, active audits
│   ├── backlogs/           ← Feature backlogs (Smart Calendar etc.)
│   ├── assets/             ← PDF/DOCX user guides for distribution
│   └── archive/            ← Superseded docs (read-only historical)
├── public/                 ← Web root (compiled assets, images)
├── resources/
│   ├── js/                 ← React frontend source
│   │   ├── Pages/          ← Inertia page components
│   │   ├── Components/     ← Shared React components
│   │   └── Layouts/        ← Inertia layouts
│   └── views/              ← Blade templates (app.blade.php only)
├── routes/
│   ├── web.php             ← All web routes
│   └── api.php             ← API routes
├── scripts/
│   ├── backup_prod.sh      ← PROD backup script
│   ├── dev-workflow.sh     ← DEV workflow helpers
│   ├── deploy/             ← Deploy toolchain (see Section 13)
│   └── git-hooks/          ← Pre-commit hook
├── storage/                ← App storage (logs, uploads, cache)
├── tests/                  ← PHPUnit tests
├── .env                    ← Environment config (not in Git)
├── composer.json           ← PHP dependencies
├── package.json            ← Node dependencies
├── vite.config.js          ← Vite build config
└── tailwind.config.js      ← Tailwind config
```

---

## 13. Important Scripts

All scripts reside in `scripts/deploy/`. Primary entrypoint: **`deploy.sh`**.

| Command | Script | Description |
|---------|--------|-------------|
| `deploy.sh` (interactive) | deploy.sh | Interactive operational console |
| `deploy.sh safety` | check_deploy_safety.sh | Pre-release safety checks |
| `deploy.sh health prod` | health_check_suite.sh | PROD health check |
| `deploy.sh health dev` | health_check_suite.sh | DEV health check |
| `deploy.sh release` | dev_to_prod_release.sh | Release DEV → PROD |
| `deploy.sh release --dry-run` | dev_to_prod_release.sh | Dry-run release (non-mutating) |
| `deploy.sh rollback` | rollback_prod_to_tag.sh | Rollback PROD to prior tag |
| `deploy.sh prod-to-dev` | prod_to_dev_sync.sh | Sync PROD → DEV |
| `deploy.sh runtime-sync` | sync_navigation_media_to_prod.sh | Sync media/navigation to PROD |
| `deploy.sh sync-public-assets` | sync_public_assets.sh | Sync public assets to PROD |
| `deploy.sh backup-prod` | backup_prod.sh | Create PROD backup |
| `deploy.sh backup-inventory` | backup_inventory.sh | List PROD backups |
| `deploy.sh incident drift-git` | incident_tools.sh | Check git drift between envs |
| `deploy.sh incident drift-runtime` | incident_tools.sh | Check runtime drift |
| `deploy.sh lock-status` | lib_deploy_common.sh | Show deploy lock status |
| `deploy.sh force-unlock` | lib_deploy_common.sh | Force-unlock (guarded) |
| `deploy.sh history` | lib_deploy_common.sh | Show operation history |

**Root-level backup script:** `scripts/backup_prod.sh` — standalone PROD backup,
also called internally by deploy.sh backup-prod.

---

## 14. Storage and Runtime Model

**Storage directories (NOT tracked in Git):**

| Path | Contents | Managed By |
|------|----------|-----------|
| `storage/app/` | App uploads, deploy history | Application |
| `storage/logs/` | Laravel logs, cron logs | Application |
| `storage/framework/` | Cache, sessions, views | Application |
| `public/storage/` | Symlinked to storage/app/public | `php artisan storage:link` |
| `public/assets/images/` | Uploaded images (navigation etc.) | Runtime sync |
| `public/build/` | Vite compiled assets | `npm run build` |
| `backups/` | Local backup snapshots | backup_prod.sh |

**Runtime sync:** Navigation images, uploaded media, and public assets are NOT in
Git. They must be synced via `deploy.sh runtime-sync` when DEV is refreshed from
PROD or when a release happens.

**Cache management:** After any `.env` change or config modification:
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

**Queue worker:** Runs via user crontab with flock:
```
* * * * * flock /tmp/queue_worker.lock php artisan queue:work --stop-when-empty >> storage/logs/queue-cron.log 2>&1
```

**Scheduler:** Runs via user crontab with flock:
```
* * * * * flock /tmp/scheduler.lock php artisan schedule:run >> storage/logs/scheduler-cron.log 2>&1
```

---

## 15. Frontend and Backend Organization

**Inertia.js bridge:** Laravel renders the initial HTML with Inertia. React takes
over on the client. Page transitions are handled client-side by Inertia.

**Page naming convention:**
- Backend route → Controller → `return Inertia::render('Module/PageName', $data)`
- Frontend: `resources/js/Pages/Module/PageName.jsx`

**Shared components:** `resources/js/Components/`
- UI primitives: shadcn/ui components (Button, Table, Dialog, etc.)
- Business components: KpiTable, SurveyForm, etc.

**Layouts:**
- `resources/js/Layouts/AuthenticatedLayout.jsx` — main authenticated layout
- `resources/js/Layouts/GuestLayout.jsx` — guest/auth layout

**Asset pipeline:**
- `npm run dev` — Vite dev server with HMR (DEV only)
- `npm run build` — Vite production build → `public/build/`
- Build manifest: `public/build/manifest.json`

**UI standards:** See `docs/architecture/DESIGN.md`
- Primary color: #1E40AF (KazUTB blue)
- Accent: #F59E42 (orange)
- Framework: Tailwind CSS + shadcn/ui

---

## 16. Database Model

**Key tables:**

| Table | Purpose |
|-------|---------|
| `users` | Authentication, RBAC (roles via Spatie or custom) |
| `kpi_entries` | KPI data entries per teacher per period |
| `kpi_structural_units` | University structural units (departments, faculties) |
| `kpi_structural_confirmations` | KPI confirmations by structural units |
| `surveys` / `survey_questions` / `survey_answers` | Student survey module |
| `departments` | Department records |
| `tickets` | Internal request tickets |

**Important naming notes (avoid common mistakes):**
- KPI base table is `kpi_entries` (NOT `kpi_records`)
- Structural units table is `kpi_structural_units` (NOT `structural_units`)
- `kpi_structural_confirmations` FKs must reference `kpi_entries` and `kpi_structural_units`

**Migrations:** All schema changes via versioned migrations in `database/migrations/`.
Never run `migrate:fresh` on PROD.

**Seeders:** PROD-safe only. All seeders use `updateOrCreate` / `firstOrCreate` /
`upsert`. Never `truncate()` or `DB::table()->delete()` without explicit incident process.

---

## 17. Environment Configuration

**Key `.env` variables:**

| Variable | PROD Value | DEV Value |
|----------|-----------|----------|
| `APP_ENV` | production | local |
| `APP_DEBUG` | false (⚠️ currently true — must fix) | true |
| `APP_URL` | https://crm.kaztbu.edu.kz | https://dev-crm.kaztbu.edu.kz |
| `DB_DATABASE` | crm_prod | crm_dev |
| `DB_USERNAME` | prod_user | dev_user |
| `VITE_APP_ENV` | production | development |

**File permissions:**
- PROD `.env`: target `admaza:www-data 640`
- DEV `.env`: `admaza:www-data 640`
- PROD `.env` must never be committed to Git

**Preflight check:** `./env-preflight-check.sh` — validates required env variables
before deployment.

---

## 18. Future Roadmap

**Priority order (recommended):**

### P0 — Critical (before next major release)
1. **Fix PROD APP_DEBUG=true** → set to false, recache config
2. **Fix PROD .env permissions** → 640 admaza:www-data
3. **Fix script execute bits** → chmod +x on all deploy helper scripts after git pull

### P1 — High (before next month)
4. **Offsite backup** — implement rclone/S3/remote SFTP automated backup
5. **Restore drill** — execute full restore from backup to validate procedure
6. **HSTS / nginx security headers** — requires nginx root access
7. **Disk space management** — root filesystem at 94%; plan cleanup or expansion

### P2 — Important (next quarter)
8. **Node 20 LTS upgrade** — Node 18 is reaching end-of-maintenance
9. **Deploy isolation** — introduce a true staging environment
10. **Smart Calendar** — complete production-ready implementation (see `docs/backlogs/SMART_CALENDAR_BACKLOG.md`)
11. **KPI export** — Excel export functionality for KPI reports

### P3 — Long-term
12. **Immutable build artifacts** — introduce artifact registry (S3 + versioned builds)
13. **CI/CD pipeline** — automate safety/build/test gates in GitHub Actions
14. **Health monitoring** — external uptime monitoring, alerting
15. **Database replicas** — read replica for reporting queries

---

## 19. Team Workflow

**Daily development cycle:**

```
1. Work in DEV repo (/var/www/laravel-react-dev, branch: dev)
2. Commit with conventional commit messages
3. Test manually in DEV environment
4. When ready for release:
   a. ./scripts/deploy/deploy.sh safety
   b. ./scripts/deploy/deploy.sh release --dry-run
   c. Review dry-run output
   d. ./scripts/deploy/deploy.sh release
   e. Verify health + drift after release
```

**Refreshing DEV from PROD (when needed):**
```bash
./scripts/deploy/deploy.sh prod-to-dev
```
This creates a DEV backup, syncs PROD DB to DEV, restores DEV .env, and aligns
code to origin/main on the dev branch.

**After any manual PROD touch:**
```bash
./scripts/deploy/pre_deploy_prod_checkpoint.sh
```
Creates a checkpoint tag and backup before further operations.

---

## 20. Incident Handling

**Drift detection:**
```bash
./scripts/deploy/deploy.sh incident drift-git        # git commit drift
./scripts/deploy/deploy.sh incident drift-runtime    # file/runtime drift
```

**Health check:**
```bash
./scripts/deploy/deploy.sh health prod
./scripts/deploy/deploy.sh health dev
```

**Lock status / stuck operations:**
```bash
./scripts/deploy/deploy.sh lock-status
./scripts/deploy/deploy.sh force-unlock   # only if no active holder
```

**Emergency rollback:**
```bash
./scripts/deploy/deploy.sh rollback
# Follow prompts — selects from available git tags
```

**Recovery philosophy:**
1. Freeze new releases first (`lock-status`, do not force-unlock)
2. Diagnose root cause (drift-git, drift-runtime, health)
3. Restore from backup if data was affected
4. Approve rollback via proper channel
5. Execute rollback with backup pre-check
6. Verify health post-rollback
7. Document incident in operation journal

---

## 21. Release SOP

**Standard Operating Procedure:**

```
[ STEP 1 ] Pre-release preparation
  - Ensure DEV is up to date (git pull / merge latest main into dev)
  - Ensure PROD backup is recent (< 24h)
  - ./scripts/deploy/deploy.sh backup-prod  (if needed)

[ STEP 2 ] Safety check
  - ./scripts/deploy/deploy.sh safety
  - Must show: PASS=26 WARN=0..1 FAIL=0
  - Known acceptable WARN: Node 18 version

[ STEP 3 ] Dry-run
  - ./scripts/deploy/deploy.sh release --dry-run
  - Review: Migration Preflight section
    → pending migration: yes/no
    → rollback-feasibility: LOW/MEDIUM/HIGH
  - Review: planned file creates/modifies/deletes

[ STEP 4 ] Operator approval
  - At least one operator must review dry-run output
  - No auto-approval for migrations with rollback-feasibility: LOW

[ STEP 5 ] Execute release
  - ./scripts/deploy/deploy.sh release
  - Follow interactive prompts

[ STEP 6 ] Post-release verification
  - ./scripts/deploy/deploy.sh health prod     → all checks GREEN
  - ./scripts/deploy/deploy.sh incident drift-git → no drift
  - ./scripts/deploy/deploy.sh history         → release entry visible
  - Manual smoke test: https://crm.kaztbu.edu.kz/
```

---

## 22. Runtime Drift Handling

**Drift types:**

| Type | Detection | Resolution |
|------|-----------|-----------|
| Git commit drift | `deploy.sh incident drift-git` | Re-release or prod-to-dev sync |
| Runtime file drift | `deploy.sh incident drift-runtime` | `deploy.sh runtime-sync` |
| Config drift | `php artisan config:cache` mismatch | `php artisan config:cache` on PROD |
| Build manifest drift | manifest hash comparison | `npm run build` + `deploy.sh release` |

**Acceptable drift:**
- Navigation media files may differ between DEV and PROD (user uploads)
- This is expected and managed via `runtime-sync`, not release

---

## 23. Backup Retention Policy

**PROD backups (local):**
- Location: `/var/www/laravel-react/backups/`
- Pattern: `prod_backup_YYYYMMDD_HHMMSS_full_snapshot/`
- Retention: **keep 2 latest** (configurable via `BACKUP_KEEP_COUNT`)
- Auto-cleanup on new backup creation

**DEV pre-sync backups:**
- Location: `/var/www/laravel-react-dev/backups/`
- Pattern: `dev_before_prod_sync_YYYYMMDD_HHMMSS/`
- Retention: **keep 1 latest**

**Offsite backups:** ❌ Not yet implemented. **Critical open risk.**
Target: automated daily offsite sync to S3-compatible storage or remote SFTP.

**Backup validation:**
- SHA256SUMS included in each backup set
- Verify with: `sha256sum -c SHA256SUMS` inside backup directory

---

## 24. Recovery Philosophy

**Principle: conservative, checkpoint-driven, no heroics.**

1. **Never rush recovery.** A wrong recovery action can cause more damage than the
   original incident.
2. **Freeze first.** When something breaks, stop new deployments immediately.
3. **Diagnose before acting.** Use drift-git, drift-runtime, health to understand
   scope before taking action.
4. **Always have a rollback path.** Every release creates a git tag. Every
   state-changing operation creates a backup.
5. **Database restore is a last resort.** Code rollback is cheap; DB restore affects
   user data. Prefer code-only recovery whenever possible.
6. **Validate after recovery.** Run full health suite + smoke test after any recovery
   action.
7. **Document the incident.** Write an incident note (even brief) in operation history.

**Rollback decision matrix:**

| Scenario | Recommended Action |
|----------|-------------------|
| Build failure after push | Fix forward (push fix to main, re-release) |
| Migration failure, reversible | `deploy.sh rollback` (code + reverse migration) |
| Migration failure, irreversible | Freeze, restore DB from backup, rollback code |
| Nginx/PHP-FPM failure | Restart services, check config, do NOT rollback code |
| Data corruption | Freeze, restore DB from backup, full incident review |

---

## 25. Technical Debt Register

| Item | Severity | Description | Owner |
|------|----------|-------------|-------|
| Offsite backups | 🔴 Critical | No offsite backup. Local backup only. | Platform |
| PROD APP_DEBUG=true | 🔴 Critical | Production has debug mode enabled | Ops |
| PROD .env permissions | 🟡 High | .env is 644 instead of 640 | Ops |
| Execute bits on scripts | 🟡 High | Some deploy helper scripts lose +x after git pull | Platform |
| Node 18 → 20 upgrade | 🟡 High | Node 18 EOL approaching; Vite recommends 20+ | Dev |
| Restore drill | 🟡 High | No restore drill has been performed | Ops |
| Disk space | 🟡 High | Root filesystem 94% used (13G free / 194G) | Ops |
| HSTS headers | 🟠 Medium | No HTTP Strict Transport Security | Ops |
| Cron/queue validation | 🟠 Medium | Cron entries present but not periodically verified | Ops |
| Staging environment | 🟠 Medium | DEV doubles as staging; no true isolated staging | Platform |
| CI/CD automation | 🟢 Low | Safety/build/test gates not automated in GitHub Actions | Dev |
| Smart Calendar completion | 🟢 Low | Feature in active development | Dev |
| KPI Excel export | 🟢 Low | Export exploration done; implementation pending | Dev |

---

*This document is the canonical reference for the KazUTB CRM platform.*
*Update it whenever you make architectural, operational, or structural changes.*

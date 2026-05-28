# FULL PROJECT RESTRUCTURING AUDIT — KazUTB CRM DEV Environment

**Date:** 2025-05-27  
**Auditor:** Copilot Agent (automated analysis)  
**Scope:** `/var/www/laravel-react-dev` (DEV), cross-referenced with `/var/www/laravel-react` (PROD)  
**Environment:** Ubuntu Linux, nginx + PHP-FPM, Laravel 11 + React/Inertia + Vite  

---

## Section 1: Full Project Inventory

### Root-Level Structure

| Path | Type | Size | Owner | Notes |
|---|---|---|---|---|
| `app/` | dir | ~2.2 MB | admaza | Backend PHP logic |
| `backups/` | dir | **53 GB** | admaza | Backup storage — grossly oversized |
| `bootstrap/` | dir | ~40 KB | admaza | Laravel bootstrap cache |
| `config/` | dir | ~100 KB | admaza | 20 config files |
| `database/` | dir | ~500 KB | admaza | Migrations + seeders |
| `docs/` | dir | ~18 MB | admaza | Project documentation |
| `node_modules/` | dir | 234 MB | admaza | JS dependencies (not tracked in git) |
| `public/` | dir | ~50 KB | admaza | Web root; `public/build/` by www-data |
| `resources/` | dir | ~5 MB | admaza | Frontend source (JS/CSS/views) |
| `routes/` | dir | ~110 KB | admaza | `web.php` = 99 KB (CRITICAL) |
| `scripts/` | dir | ~300 KB | admaza | Deploy/backup bash scripts |
| `storage/` | dir | 9.9 GB | admaza | App data, logs, framework cache |
| `tests/` | dir | ~50 KB | admaza | PHPUnit tests |
| `vendor/` | dir | 128 MB | admaza | Composer dependencies (not tracked) |
| `.git/` | dir | 45 MB | admaza | Git repository |
| `output.json` | file | 77 KB | admaza | **TRACKED IN GIT — should not be** |
| `pluc` | file | 0 bytes | admaza | **TRACKED IN GIT — empty junk file** |
| `artisan` | file | 1.8 KB | admaza | Laravel CLI |
| `composer.json` | file | ~5 KB | admaza | PHP dependencies definition |
| `package.json` | file | ~3 KB | admaza | JS dependencies definition |
| `tailwind.config.js` | file | ~4 KB | admaza | Tailwind CSS config |
| `vite.config.js` | file | ~2 KB | admaza | Vite bundler config |
| `jsconfig.json` | file | ~1 KB | admaza | JS path aliases |
| `components.json` | file | ~1 KB | admaza | shadcn/ui components registry |
| `phpunit.xml` | file | ~1 KB | admaza | PHPUnit config |
| `env-preflight-check.sh` | file | ~15 KB | admaza | Pre-flight env validation script |
| `pluc` | file | 0 bytes | admaza | Empty stub tracked in git |

### Key Sizes Summary

| Directory | Size |
|---|---|
| `backups/` | **53 GB** (6× ~9.4 GB `dev_before_prod_sync_*` dirs) |
| `storage/app/public/` | 9.9 GB (prod files — see CRITICAL BUG §4) |
| `node_modules/` | 234 MB |
| `vendor/` | 128 MB |
| `.git/` | 45 MB |
| `docs/` | 18 MB |
| `storage/logs/` | 4.7 MB |
| `storage/kpi_knowledge_base.json` | 80 KB (tracked in git) |

---

## Section 2: Repository Hygiene Audit

### Git-Tracked Files Classification

| File | Tracked? | Should Be? | Verdict |
|---|---|---|---|
| `output.json` (77 KB) | ✅ YES | ❌ NO | **REMOVE FROM GIT** — in `.gitignore` but already tracked |
| `pluc` (0 bytes) | ✅ YES | ❌ NO | **REMOVE FROM GIT** — empty junk artifact |
| `storage/kpi_knowledge_base.json` | ✅ YES | ⚠️ MAYBE | Large data file (80 KB); should be seeded via migrations |
| All PHP source files | ✅ YES | ✅ YES | Correct |
| All JS/JSX/CSS files | ✅ YES | ✅ YES | Correct |
| `config/*.php` | ✅ YES | ✅ YES | Correct |
| `database/migrations/` | ✅ YES | ✅ YES | Correct |
| `backups/` | ❌ NO | ❌ NO | Correct — in `.gitignore` |
| `vendor/` | ❌ NO | ❌ NO | Correct |
| `node_modules/` | ❌ NO | ❌ NO | Correct |
| `.env` | ❌ NO | ❌ NO | Correct |

### Shell Redirect Artifacts in .gitignore

The `.gitignore` file contains lines that appear to be accidental shell redirections, not valid glob patterns:

```
= DB::connection*
as $c)*
as $t)*
ql -u*
```

These are **malformed gitignore entries** caused by accidental terminal output being written to the file. They do not harm functionality but are noise.

### .gitignore Gaps

| Pattern | Status |
|---|---|
| `output.json` | ✅ In `.gitignore` BUT file is already tracked in git |
| `/backups/` | ✅ Correctly ignored |
| `*.sql.gz` | ✅ Ignored |
| `*.tar.gz` | ✅ Ignored |
| `pluc` | ❌ NOT in `.gitignore` — empty file tracked |

**Action Required:**
```bash
git rm --cached output.json
git rm --cached pluc
echo "pluc" >> .gitignore
git commit -m "chore: untrack output.json and pluc junk artifacts"
```

---

## Section 3: Suspicious/Junk File Audit

| File | Size | Issue | Recommendation |
|---|---|---|---|
| `output.json` | 77 KB | AI debug dump tracked in git | Untrack from git; keep in `.gitignore` |
| `pluc` | 0 bytes | Empty file, unknown purpose | Remove from repo |
| `AdminSurveyController.php` | 0 bytes | Empty stub controller | Implement or delete |
| `TelegramWebhookController.php` | 0 bytes | Empty stub controller | Implement or delete (see memory note: Telegram needs chat_id, not phone) |
| `ai-chat.html` | 32 KB | Standalone HTML in `public/` | Investigate if still needed; likely dev artifact |
| `storage/app/recovery-backup-20260515-075541/` | 208 KB | Old recovery backup in storage | Move to `/backups/` or delete after manual review |
| `storage/app/recovery-restore-20260515-075541.tsv` | 12 KB | Old recovery restore log | Move to `/backups/` or delete |
| `storage/app/deploy_checkpoints/` | 20 KB | Deploy state in wrong location | Move to `backups/` or `scripts/state/` |
| `storage/app/deploy_platform/` | 20 KB | Deploy state in wrong location | Move to `backups/` or `scripts/state/` |
| `storage/app/deploy_reports/` | 24 KB | Deploy reports in wrong location | Move to `backups/` or `docs/` |

### Shell Artifact Lines in .gitignore (Malformed)

```
= DB::connection*  ← accidental shell paste
as $c)*            ← accidental shell paste
as $t)*            ← accidental shell paste
ql -u*             ← accidental shell paste (fragment of "mysql -u")
```

These should be removed from `.gitignore` during next cleanup.

---

## Section 4: Ownership / Permission Audit

### Permission Overview

All source directories are owned by `admaza:admaza` with `rw-rw-r--` (664) for files and `rwxrwxr-x` (775) for directories. This is correct for a development setup.

Web-accessible runtime directories:

| Path | Owner | Permissions | Correct? |
|---|---|---|---|
| `storage/app/public/` | admaza:www-data | drwxrwx--- | ✅ Correct |
| `public/build/` | admaza:www-data | drwxr-xr-x | ✅ Correct |
| `/var/www/` (parent) | admaza:www-data | drwxr-xr-x | ✅ Correct |

### ⚠️ PERMISSION ANOMALY

| Path | Owner | Issue |
|---|---|---|
| `/var/www/laravel-react/backups/nginx_ssl_fix_20260522_144011/` | **root:root** | Created by root during SSL fix; **not writable by admaza**; scripts that try to clean/list this dir will fail silently |

**Fix:**
```bash
sudo chown -R admaza:admaza /var/www/laravel-react/backups/nginx_ssl_fix_20260522_144011/
```

### 🚨 CRITICAL BUG: DEV Public Storage Symlink Points to PROD

```
/var/www/laravel-react-dev/public/storage
  → /var/www/laravel-react/storage/app/public   ← PRODUCTION path!
```

**The dev environment is reading and writing files directly from/to PRODUCTION storage.** This means:
- Certificate uploads, KPI attachments, announcements, nav images written via DEV will overwrite PROD files
- File deletions in DEV will delete PROD files
- Developers testing uploads will see PROD user data

**Fix immediately:**
```bash
rm /var/www/laravel-react-dev/public/storage
ln -s /var/www/laravel-react-dev/storage/app/public /var/www/laravel-react-dev/public/storage
```

---

## Section 5: Architecture Audit

### Overall Architecture

```
┌─────────────────────────────────────────────────────┐
│              KazUTB CRM — Laravel + React            │
│                                                     │
│  nginx (SSL termination)                            │
│    ├── PROD: crm.kaztbu.edu.kz → laravel-react/     │
│    └── DEV:  dev-crm.kaztbu.edu.kz → laravel-react-dev/ │
│                                                     │
│  PHP-FPM → Laravel 11 (monolith)                    │
│    ├── Inertia.js (SSR bridge PHP↔React)            │
│    ├── React 18 / Vite (frontend)                   │
│    ├── MySQL (database)                             │
│    └── Active Directory (LDAP auth)                 │
└─────────────────────────────────────────────────────┘
```

### Architecture Concerns

| Concern | Severity | Details |
|---|---|---|
| `routes/web.php` is 99 KB / ~2500+ lines | HIGH | Monolithic route file — unmaintainable; should be split into `routes/web/kpi.php`, `routes/web/users.php`, etc. |
| `KpiEntryController.php` = 107 KB / 2542 lines | HIGH | God controller — violates SRP; needs extraction to Services + smaller controllers |
| `KpiSummaryController.php` = 104 KB / 2443 lines | HIGH | Same issue |
| `PercoController.php` = 88 KB / 2212 lines | HIGH | Same issue |
| `DirectoryUserController.php` = 74 KB / 1823 lines | MEDIUM | Same issue |
| DEV public/storage symlink → PROD storage | **CRITICAL** | Security/data integrity risk (see §4) |
| No service layer for 3 of 4 giant controllers | MEDIUM | Business logic mixed into HTTP layer |

---

## Section 6: Frontend Structure Audit

### Directory Structure

```
resources/js/
├── app.jsx                    # Entry point
├── bootstrap.js               # Axios/Echo setup
├── i18n.js                   # Internationalization (11 KB — supports KZ/RU/EN)
├── components/                # lowercase: shadcn/ui components
│   └── ui/                   # Radix-based UI primitives
├── Components/                # UPPERCASE: domain components (naming conflict!)
│   └── Surveys/
├── hooks/                    # Custom React hooks
├── Layouts/                  # Page layout wrappers
├── lib/                      # Utility functions (e.g., cn())
├── Pages/                    # Inertia page components (27 domains)
│   ├── Kpi/                  # Largest domain — 4 files, 2 oversized
│   ├── Calendar/
│   ├── Questionnaire/Admin/
│   ├── Users/
│   └── ...23 more
├── utils/                    # Misc helpers
└── _legacy/                  # Legacy calendar code — ORPHANED
    └── root-calendar/
```

### ⚠️ Naming Conflict: `components/` vs `Components/`

There are TWO component directories with different casing:
- `components/ui/` — shadcn/ui primitives (lowercase)
- `Components/Surveys/` — domain components (PascalCase)

This causes confusion and potential import errors on case-sensitive Linux filesystems. Should be unified to `components/` (lowercase) following the `jsconfig.json` alias.

### Oversized Frontend Pages

| File | Lines | Issue |
|---|---|---|
| `Pages/Kpi/TeacherDashboard.jsx` | 2406 | Monolithic page; should decompose into sub-components |
| `Pages/Kpi/Summary.jsx` | 2319 | Same |
| `Pages/Calendar/Index.jsx` | 1585 | Large calendar implementation |
| `Pages/Users/Index.jsx` | 1243 | Large user management page |
| `Pages/Questionnaire/Admin/TeacherDisciplines.jsx` | 1167 | Complex form |
| `Pages/Welcome.jsx` | 781 | Login/welcome page — suspiciously large |

### _legacy Directory

`resources/js/_legacy/root-calendar/` contains old calendar code. It is not imported anywhere (assumed orphaned). Should be confirmed and deleted.

---

## Section 7: Backend Structure Audit

### Controller Map

```
app/Http/Controllers/
├── [ROOT LEVEL — 37 controllers]
│   ├── KpiEntryController.php         107 KB  ← GOD CONTROLLER
│   ├── KpiSummaryController.php       104 KB  ← GOD CONTROLLER
│   ├── PercoController.php             88 KB  ← GOD CONTROLLER
│   ├── DirectoryUserController.php     74 KB  ← LARGE
│   ├── DashboardController.php         20 KB
│   ├── CertificateRegistryController.php  20 KB
│   ├── ProfileController.php           20 KB
│   ├── AdminSurveyController.php        0 bytes ← EMPTY STUB
│   └── ... 29 more
├── Api/
│   ├── AiChatController.php           16 KB
│   ├── NavigationRouteController.php   9 KB
│   ├── Questionnaire/
│   │   └── AdminDictionaryController.php  36 KB
│   ├── TelegramWebhookController.php    0 bytes ← EMPTY STUB
│   └── ... 8 more
├── Auth/
│   └── [auth flow controllers]
└── Questionnaire/
    └── [questionnaire controllers]
```

### Services Layer

| Service | Size | Notes |
|---|---|---|
| `KpiEntryService.php` | 737 lines | Exists — partially extracted from controller |
| `ActiveDirectoryAuthenticator.php` | 690 lines | AD/LDAP auth — complex but focused |
| `QuestionnaireSurveyService.php` | 413 lines | Good extraction |
| `KpiCalculationService.php` | 324 lines | Good extraction |
| `TopicSimilarityService.php` | 346 lines | AI similarity logic |

**Gap:** `KpiSummaryController`, `PercoController`, `DirectoryUserController` have NO corresponding service — all business logic in controller.

### Empty Stub Controllers (Action Required)

| File | Location | Action |
|---|---|---|
| `AdminSurveyController.php` | `Controllers/` | Implement or delete |
| `TelegramWebhookController.php` | `Controllers/Api/` | Implement or delete |

### Config Files

20 config files in `config/`:

| File | Notes |
|---|---|
| `kpi.php` | Custom KPI domain config |
| `ad.php` | Active Directory config |
| `l5-swagger.php` | API docs (Swagger) |
| `scramble.php` | API docs alternative |
| `telescope.php` | Debug tools (should be prod-disabled) |
| `pulse.php` | Laravel Pulse monitoring |
| `activitylog.php` | Activity logging |

⚠️ Both `telescope.php` and `scramble.php` are present — two API doc tools simultaneously. Verify which is actively used.

---

## Section 8: Deployment / Ops Structure Audit

### Scripts Directory

```
scripts/
├── backup_prod.sh          24 KB  Main backup script (prod → dev sync source)
├── env-audit.sh            ~5 KB  Environment validation
├── fix-ownership.sh        ~3 KB  Permission repair
├── pluc                    0 bytes ← JUNK (also exists at root)
└── deploy/
    ├── prod_to_dev_sync.sh 12 KB  PROD→DEV sync (main deploy script)
    └── [other deploy scripts]
```

### Deploy Script Issues (FIXED in this audit)

| Issue | File | Fix Applied |
|---|---|---|
| `BACKUP_KEEP_COUNT=2` kept 2 prod snapshots | `prod_to_dev_sync.sh` | ✅ Changed to `1` |
| `cleanup_runtime_backups_by_prefix "dev_before_prod_sync_" 2` kept 2 | `backup_prod.sh` (×2 occurrences) | ✅ Changed to `1` |
| `TMP_EXTRACT_DIR` never deleted after extraction | `prod_to_dev_sync.sh` | ✅ Added `rm -rf "$TMP_EXTRACT_DIR"` |

### Backup Structure Analysis

**PROD** (`/var/www/laravel-react/backups/`):

| Item | Type | Issue |
|---|---|---|
| `prod_backup_20260526_183759_full_snapshot/` | dir | ✅ Correct structure — inside subfolder |
| `prod_backup_20260526_191330_full_snapshot/` | dir | ✅ Correct — last snapshot |
| `cleanup_only_20260522_064021/` | dir | ⚠️ Empty cleanup-run artifacts |
| `cleanup_only_20260522_064053/` | dir | ⚠️ Empty cleanup-run artifacts |
| `nav_fix_20260524_191321/` | dir | ⚠️ Old runtime backup — can be cleaned |
| `nav_fix_20260525_050122/` | dir | ⚠️ Old runtime backup |
| `nginx_ssl_fix_20260522_144011/` | dir | 🔴 Owned by `root:root` — permission bug |
| `env_20260527_131252.pre_remediation.backup` | file | ⚠️ **LOOSE FILE** — not inside a subfolder |
| `laravel_react_prod_snapshot_20260518_130041.sql.gz` | file | ⚠️ **LOOSE FILE** — naked SQL dump |
| `pre_deploy_7d4cd80_20260521083454.manifest` | file | ⚠️ **LOOSE FILE** — deploy manifest |
| `ops/` | dir | ⚠️ Contains a zero-byte file; unclear purpose |

**DEV** (`/var/www/laravel-react-dev/backups/`):

| Item | Type | Notes |
|---|---|---|
| `dev_before_prod_sync_*/` (×6) | dirs | Each ~9.4 GB — **53 GB total** — BLOAT |

**Root Cause of 53 GB bloat:** Previous cleanup config kept 2 copies (`"dev_before_prod_sync_" 2`) and the sync script passed `BACKUP_KEEP_COUNT=2`. Both have been fixed to `1`. After next sync, 5 old backups will be removed (~47 GB freed).

---

## Section 9: Large / Heavy File Audit

| File/Dir | Size | Risk | Action |
|---|---|---|---|
| `backups/dev_before_prod_sync_*/` (×6) | 53 GB | HIGH — disk exhaustion | Fixed by script changes; next sync will prune to 1 |
| `storage/app/public/` | 9.9 GB | — | Normal (user-uploaded files from prod) |
| `node_modules/` | 234 MB | — | Normal, not tracked in git |
| `vendor/` | 128 MB | — | Normal, not tracked in git |
| `.git/` | 45 MB | MEDIUM | Contains history of large files; consider `git gc` |
| `docs/` | 18 MB | — | Documentation; check if any large binaries |
| `output.json` | 77 KB | LOW | Tracked in git — untrack it |
| `storage/kpi_knowledge_base.json` | 80 KB | LOW | Tracked in git — should be seeded data |
| `routes/web.php` | 99 KB | MEDIUM | Code maintainability issue |
| `KpiEntryController.php` | 107 KB | MEDIUM | Code maintainability issue |
| `KpiSummaryController.php` | 104 KB | MEDIUM | Code maintainability issue |
| `PercoController.php` | 88 KB | MEDIUM | Code maintainability issue |

---

## Section 10: Cleanup Safety Matrix

| Item | Safe to Delete? | Command | Notes |
|---|---|---|---|
| `backups/dev_before_prod_sync_*` (×5 oldest) | ✅ YES after next sync | auto-pruned by fixed script | Keep most recent 1 |
| `/var/www/laravel-react/backups/cleanup_only_*` | ✅ YES | `rm -rf cleanup_only_*` | Empty dirs, no data |
| `/var/www/laravel-react/backups/nav_fix_*` | ⚠️ REVIEW | manual | Contains backups from nav fix — confirm no longer needed |
| `/var/www/laravel-react/backups/nginx_ssl_fix_*` | ⚠️ REVIEW | manual (as sudo) | Owned by root; fix permissions first |
| `output.json` | ✅ YES (from git) | `git rm --cached output.json` | Keep file, just untrack |
| `pluc` | ✅ YES | `git rm pluc && rm pluc` | Empty junk file |
| `AdminSurveyController.php` (0 bytes) | ✅ YES if no routes reference it | check routes first | Empty stub |
| `TelegramWebhookController.php` (0 bytes) | ✅ YES if no routes reference it | check routes first | Empty stub |
| `resources/js/_legacy/` | ⚠️ REVIEW | manual | Verify no imports before deleting |
| `storage/app/recovery-backup-*/` | ⚠️ REVIEW | manual | Old recovery artifacts — confirm restored |
| `storage/app/deploy_checkpoints/` | ⚠️ REVIEW | manual | May be needed by deploy scripts |
| `ai-chat.html` in `public/` | ⚠️ REVIEW | manual | Dev artifact or live tool? |
| Malformed lines in `.gitignore` | ✅ YES | edit file | Visual noise only |

---

## Section 11: Future Restructuring Plan

### Priority 1 — IMMEDIATE (Security/Data Integrity)

1. **Fix DEV `public/storage` symlink** (points to PROD — CRITICAL BUG):
   ```bash
   rm /var/www/laravel-react-dev/public/storage
   ln -s /var/www/laravel-react-dev/storage/app/public /var/www/laravel-react-dev/public/storage
   php artisan storage:link  # or run in dev root
   ```

2. **Fix root:root ownership on prod backup dir:**
   ```bash
   sudo chown -R admaza:admaza /var/www/laravel-react/backups/nginx_ssl_fix_20260522_144011/
   ```

### Priority 2 — SHORT TERM (Hygiene)

3. **Untrack junk files from git:**
   ```bash
   cd /var/www/laravel-react-dev
   git rm --cached output.json
   git rm --cached pluc
   rm pluc
   echo "pluc" >> .gitignore
   git commit -m "chore: untrack output.json and remove pluc"
   ```

4. **Clean malformed .gitignore entries** — remove lines: `= DB::connection*`, `as $c)*`, `as $t)*`, `ql -u*`

5. **Run next prod→dev sync** to trigger backup pruning (will free ~47 GB from old `dev_before_prod_sync_*` dirs)

6. **Consolidate loose PROD backup files** into a dated subfolder:
   ```bash
   cd /var/www/laravel-react/backups
   mkdir loose_files_pre_20260527
   mv env_20260527_131252.pre_remediation.backup laravel_react_prod_snapshot_*.sql.gz pre_deploy_*.manifest loose_files_pre_20260527/
   ```

### Priority 3 — MEDIUM TERM (Architecture)

7. **Split `routes/web.php`** (99 KB monolith) into domain-specific route files:
   ```
   routes/web/
   ├── kpi.php
   ├── users.php
   ├── calendar.php
   ├── certificates.php
   ├── questionnaire.php
   └── ...
   ```
   Include them in `routes/web.php` via `require`/`Route::group` with `include`.

8. **Extract `KpiSummaryController`** into Service + smaller controllers — target: <300 lines per controller.

9. **Extract `PercoController`** into Service.

10. **Extend `DirectoryUserController`** service extraction pattern.

11. **Unify `components/` vs `Components/`** naming in `resources/js/` — choose one convention.

12. **Move `storage/kpi_knowledge_base.json`** out of git into a seeder or S3-style storage.

### Priority 4 — LONG TERM

13. **Audit `docs/`** — 18 MB suggests possible large binary assets (PDFs, images); move to external storage.

14. **Decompose oversized frontend pages** — `Kpi/TeacherDashboard.jsx` (2406 lines), `Kpi/Summary.jsx` (2319 lines).

15. **Implement stub controllers** or delete: `AdminSurveyController`, `TelegramWebhookController`.

---

## Section 12: Recommended Target Structure

```
/var/www/laravel-react-dev/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Kpi/
│   │   │   │   ├── KpiEntryController.php     ← split from 107KB god controller
│   │   │   │   ├── KpiSummaryController.php   ← split from 104KB
│   │   │   │   └── KpiSettingsController.php
│   │   │   ├── Users/
│   │   │   │   └── DirectoryUserController.php  ← 74KB → split
│   │   │   ├── HR/
│   │   │   │   └── PercoController.php          ← 88KB → split
│   │   │   ├── Calendar/, Certificates/, Questionnaire/ ...
│   │   │   └── Api/
│   │   ├── Middleware/
│   │   └── Requests/
│   ├── Services/
│   │   ├── Kpi/
│   │   ├── HR/
│   │   └── Users/
│   ├── Models/
│   ├── Policies/
│   └── Support/
├── backups/                   ← max 1 prod snapshot + 1 dev snapshot (FIXED ✅)
│   └── [one dated subfolder per backup run]
├── config/                    ← 20 files — acceptable
├── database/
│   └── seeders/               ← move kpi_knowledge_base.json here as seeder
├── docs/
├── resources/
│   └── js/
│       ├── app.jsx
│       ├── components/        ← unified lowercase (merge Components/)
│       │   ├── ui/            ← shadcn primitives
│       │   └── [domain]/
│       ├── hooks/
│       ├── Layouts/
│       ├── Pages/
│       │   └── [domain]/      ← each page file <500 lines
│       ├── lib/
│       └── utils/
├── routes/
│   ├── web.php                ← thin — only includes domain routes
│   ├── web/
│   │   ├── kpi.php
│   │   ├── users.php
│   │   └── ...
│   └── api.php
├── scripts/
│   ├── backup_prod.sh         ← FIXED ✅
│   └── deploy/
│       └── prod_to_dev_sync.sh  ← FIXED ✅
├── public/
│   └── storage → ../storage/app/public   ← MUST POINT TO OWN STORAGE (CRITICAL FIX)
└── storage/
    ├── app/
    │   └── public/            ← own uploaded files (not prod's)
    ├── framework/
    └── logs/
```

---

## Section 13: Operational Cleanup Roadmap

### Phase 1: Critical Fixes (Do NOW — Day 1)

| Task | Command | Risk |
|---|---|---|
| Fix public/storage symlink in DEV | `rm /var/www/laravel-react-dev/public/storage && ln -s /var/www/laravel-react-dev/storage/app/public /var/www/laravel-react-dev/public/storage` | LOW |
| Fix root:root backup dir permissions | `sudo chown -R admaza:admaza /var/www/laravel-react/backups/nginx_ssl_fix_20260522_144011/` | LOW |
| Untrack output.json from git | `git rm --cached output.json && git commit -m "chore: untrack output.json"` | LOW |
| Remove pluc junk file | `git rm pluc && rm pluc && git commit -m "chore: remove pluc"` | LOW |

### Phase 2: Disk Cleanup (Day 1–3)

| Task | Expected Gain |
|---|---|
| Run next `prod_to_dev_sync.sh` (scripts now fixed) | **~47 GB freed** (5 old `dev_before_prod_sync_*` pruned) |
| Consolidate loose PROD backup files into subfolder | Hygiene |
| Verify and possibly remove `nav_fix_*` dirs in prod | ~few MB |
| Verify and possibly remove `cleanup_only_*` dirs in prod | Minimal |

### Phase 3: Code Hygiene (Week 1–2)

| Task | Effort |
|---|---|
| Fix `.gitignore` malformed entries | 5 min |
| Split `routes/web.php` into domain files | 2–4 hours |
| Move `kpi_knowledge_base.json` to seeder | 1 hour |
| Implement or delete `AdminSurveyController.php` | 30 min |
| Implement or delete `TelegramWebhookController.php` | 30 min |
| Unify `components/` / `Components/` naming | 1–2 hours |
| Verify and remove `_legacy/` directory | 30 min |

### Phase 4: Architecture Refactoring (Sprint-based)

| Task | Effort | Priority |
|---|---|---|
| Extract `KpiSummaryController` to Service | 1–2 days | HIGH |
| Extract `PercoController` to Service | 1–2 days | HIGH |
| Extract `DirectoryUserController` to Service | 1 day | MEDIUM |
| Decompose `Kpi/TeacherDashboard.jsx` | 1 day | MEDIUM |
| Decompose `Kpi/Summary.jsx` | 1 day | MEDIUM |
| Decompose `routes/web.php` fully | 4 hours | HIGH |

---

## Section 14: Final Report

### Executive Summary

The KazUTB CRM DEV environment has **one critical security/data integrity bug**, **multiple hygiene issues**, and **significant architectural debt** that needs attention in priority order.

### 🚨 CRITICAL (Fix Immediately)

1. **DEV `public/storage` symlink points to PRODUCTION storage** — dev uploads/deletions directly affect prod files. Fix: recreate symlink to point to DEV's own storage directory.

### 🔴 HIGH SEVERITY

2. **53 GB backup bloat in DEV** — 6 copies of `dev_before_prod_sync_*` at ~9.4 GB each. **Script fixes have been applied** (BACKUP_KEEP_COUNT 2→1 in both `backup_prod.sh` and `prod_to_dev_sync.sh`). Next sync will prune to 1 copy (~47 GB freed).
3. **God controllers** — `KpiEntryController` (107 KB), `KpiSummaryController` (104 KB), `PercoController` (88 KB) are unmaintainable and should be refactored.
4. **Monolithic `routes/web.php`** — 99 KB / ~2500 lines, impossible to navigate.

### 🟠 MEDIUM SEVERITY

5. **root:root owned backup dir** in prod — `nginx_ssl_fix_20260522_144011/` not manageable by admaza.
6. **Git junk files** — `output.json` (77 KB) and `pluc` (0 bytes) are tracked in git and shouldn't be.
7. **Duplicate component directories** — `components/` vs `Components/` naming conflict in frontend.
8. **Loose backup files in PROD** — 3 files not inside a dated subfolder in `/var/www/laravel-react/backups/`.
9. **`TMP_EXTRACT_DIR` never cleaned up** during sync — fixed in this audit.

### 🟡 LOW SEVERITY

10. **Empty stub controllers** — `AdminSurveyController.php` and `TelegramWebhookController.php` are 0 bytes.
11. **Malformed `.gitignore` entries** — 4 lines from accidental shell redirects.
12. **Oversized frontend pages** — `TeacherDashboard.jsx` (2406 lines), `Summary.jsx` (2319 lines).
13. **Legacy orphaned code** — `resources/js/_legacy/root-calendar/`.
14. **Deploy state artifacts in storage** — `deploy_checkpoints/`, `deploy_platform/`, `deploy_reports/` in `storage/app/` instead of `backups/`.

### Changes Applied in This Audit

| File | Change |
|---|---|
| `scripts/backup_prod.sh` (DEV + PROD) | `dev_before_prod_sync_` keep count: `2` → `1` (×2 occurrences each) |
| `scripts/deploy/prod_to_dev_sync.sh` (DEV + PROD) | `BACKUP_KEEP_COUNT`: `2` → `1` |
| `scripts/deploy/prod_to_dev_sync.sh` (DEV + PROD) | Added `rm -rf "$TMP_EXTRACT_DIR"` cleanup after extraction |

**Total: 6 changes across 4 files.** No data deleted, no destructive operations performed.

---

*Audit generated: 2025-05-27 | Environment: KazUTB CRM DEV | Files: 4 scripts fixed | Next action: Fix DEV public/storage symlink*

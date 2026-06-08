# Concerns

## 1) High-Risk Areas

| Area | Concern | Evidence |
|------|---------|----------|
| KPI access and workflow | Role, grants, org scope, period scopes and status transitions interact in many files | `User.php`, `KpiEntryPolicy.php`, `KpiEntryService.php`, `EnsurePanelRoleAccess.php` |
| Calendar workflow | Much of the business logic lives in `routes/web.php` closures | `routes/web.php`, `docs/backlogs/SMART_CALENDAR_BACKLOG.md` |
| User identity/source-of-truth | AD fields, local profile edits, admin edits, role/role_id normalization can drift | `User.php`, `ActiveDirectoryAuthenticator.php`, `DirectoryUserController.php`, `docs/audits/as-is-security-source-of-truth-2026-06-03.md` |
| Certificates access | Uses controller-local admin/email checks rather than formal policy | `CertificateRegistryController.php`, `CertificateTemplateController.php`, `EnsurePanelRoleAccess.php` |
| Large files | Several files mix many responsibilities | `KpiSummaryController.php`, `KpiEntryController.php`, `DirectoryUserController.php`, `Kpi/Summary.jsx`, `TeacherDashboard.jsx` |
| Operations | Local backups exist; offsite backup documented as missing | `docs/PROJECT_CONTEXT.md`, `scripts/backup_prod.sh` |

## 2) Technical Debt

- `docs/PROJECT_CONTEXT.md` stack section is stale: it says Laravel 11/Vite 5, while manifests/runtime show Laravel 12/Vite 7.
- `routes/web.php` has 1858 lines and contains calendar closures with validation, conflict detection, notifications and audit.
- `KpiSummaryController.php` has 3017 lines and owns aggregation plus exports.
- `KpiEntryController.php` has 2612 lines and mixes form payloads, validation helpers, queue payloads and entry actions.
- `DirectoryUserController.php` has 1940 lines and affects roles, bindings and admin grants.
- React pages `Kpi/Summary.jsx` and `Kpi/TeacherDashboard.jsx` exceed 2400 lines each.
- JavaScript lint/format config was not found.
- Tests do not yet cover the riskiest KPI permission matrix deeply enough.
- `resources/js/_legacy/root-calendar` remains in source tree; `[ASK USER]` confirm whether it is historical only.

## 3) Security Concerns

- Access rules are distributed across middleware, policies, controllers, model helpers and React sidebar.
- Hardcoded special cases remain, for example `/special/login-image` checks user id/login in `routes/web.php`.
- Certificate/template access includes hardcoded email fallback and config allowlist.
- `.env` is readable in this workspace and contains secret variable keys; values must never be copied into docs or prompts.
- `ImportPhonebookBackup` supports `--truncate`, which is isolated to phonebook tables but still destructive.

## 4) Performance Concerns

- Large summary/export controllers may run heavy aggregations; each export path should be profiled before scaling.
- Calendar event conflict detection in route closures queries events/slots per request; indexes exist, but edge cases need load testing.
- Inertia shared props query calendar counts and grants on many authenticated requests.
- Large runtime/backups and `storage/app/public/kpi/entries` files can create disk pressure.

## 5) High-Churn Files

Recent git history flags these as fragile:

- `app/Http/Controllers/KpiEntryController.php`
- `resources/js/Pages/Kpi/TeacherDashboard.jsx`
- `resources/js/components/app-sidebar.jsx`
- `routes/web.php`
- `resources/js/Pages/Kpi/EntryShow.jsx`
- `DirectoryUserController.php`
- `AuthenticatedLayout.jsx`
- `scripts/backup_prod.sh`
- `scripts/deploy/check_deploy_safety.sh`

## 6) Evidence

- `docs/codebase/.codebase-scan.txt`
- `docs/PROJECT_CONTEXT.md`
- `docs/audits/as-is-security-source-of-truth-2026-06-03.md`
- `routes/web.php`
- `app/Models/User.php`
- `app/Policies/KpiEntryPolicy.php`
- `app/Http/Middleware/EnsurePanelRoleAccess.php`
- `app/Http/Controllers/KpiEntryController.php`
- `app/Http/Controllers/KpiSummaryController.php`
- `app/Console/Commands/ImportPhonebookBackup.php`

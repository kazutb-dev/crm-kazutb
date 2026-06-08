# Architecture

## 1) Architectural Style

- Primary style: Laravel monolith with Inertia-powered React pages.
- Classification: one Laravel app owns routing, auth, models, services, React page selection, API routes and deploy scripts.
- Primary constraints:
  - The system is role/scope heavy: many actions depend on `User::resolvedRoleSlug()`, org bindings and KPI grants.
  - DEV and PROD are separate worktrees, with deploy controlled by `scripts/deploy/deploy.sh`.
  - Runtime uploads and generated files live outside Git and are synced/backed up separately.

## 2) System Flow

```text
Browser -> Laravel route/middleware -> Controller/closure -> Service/Policy/Model -> MySQL/storage/external API -> Inertia/JSON/redirect
```

1. Browser requests a route from `routes/web.php` or `routes/api.php`.
2. Middleware such as `auth`, `panel.role.access`, `calendar.access`, `track.last-seen` filters access.
3. Controllers call policies and services, for example `KpiEntryController` -> `KpiEntryPolicy` -> `KpiEntryService`.
4. Services use Eloquent models and transactions, for example KPI period activation and KPI entry workflow.
5. Integrations use config/env, for example AD, Green API WhatsApp, Zoom, OpenAI, library catalog, Perco.
6. Response returns either an Inertia React page, JSON, streamed export, or redirect with flash messages.

## 3) Layer/Module Responsibilities

| Layer or module | Owns | Must not own | Evidence |
|-----------------|------|--------------|----------|
| Auth/RBAC | Login, roles, user state, route gates | Business-specific UI layout | `routes/auth.php`, `User.php`, `EnsurePanelRoleAccess.php` |
| KPI | Periods, indicators, entries, status flow, scoring, exports, structural confirmation | Calendar scheduling | `KpiEntryService.php`, `KpiCalculationService.php`, `KpiEntryPolicy.php` |
| Smart Calendar | Events, slots, secretary access, leadership access, WhatsApp/Zoom hooks | KPI approval rules | `routes/web.php`, `CalendarEvent.php`, `EnsureCalendarLeadershipAccess.php` |
| Questionnaire/Survey | Student surveys, dictionaries, answers, reports | User authority source-of-truth | `routes/api.php`, `QuestionnaireSurveyService.php`, `docs/modules/survey/questionnaire-module.md` |
| Certificates/Templates | Template versions, certificate generation, QR verification, CSV export | General RBAC model | `CertificateRegistryController.php`, `CertificateTemplateController.php` |
| Governance/Authority | Org units, scoped grants, delegations, authority ledger | UI-only route hiding | `KpiAccessEvaluatorService.php`, `GovernanceAccessRequestController.php` |
| Frontend shell | Sidebar, page titles, flash toasts, shared layout | Server-side authorization | `AuthenticatedLayout.jsx`, `app-sidebar.jsx` |
| Operations | Backup, release, health, sync, safety checks | Feature code | `scripts/deploy/*.sh`, `docs/PROJECT_CONTEXT.md` |

## 4) Reused Patterns

| Pattern | Where found | Why it exists |
|---------|-------------|---------------|
| Controller -> Service -> Model | KPI period/entry/calculation flows | Keeps transaction-heavy business logic out of controllers |
| Policy authorization | `KpiEntryPolicy`, `KpiPeriodPolicy` | Checks per-action permissions beyond route-level access |
| Middleware guardrail | `EnsurePanelRoleAccess`, `EnsureCalendarLeadershipAccess` | Blocks whole route groups early |
| Inertia page mapping | `Inertia::render('Module/Page')` + `resources/js/Pages/Module/Page.jsx` | Server chooses page, React renders UI |
| Config-driven integrations | `config/services.php`, `.env.example` | Keeps credentials and endpoints out of code |
| Operational scripts | `deploy.sh`, `safecommit.sh`, safety checks | Reduces risky manual deployment steps |

## 5) Known Architectural Risks

- `routes/web.php` contains large calendar business logic in route closures; refactoring needs tests first.
- `KpiEntryController.php`, `KpiSummaryController.php`, `DirectoryUserController.php` and several React pages exceed 1500 lines; small edits can have hidden side effects.
- Access control exists in several places: `User`, middleware, policies, controller helper methods, grants, sidebar. This can drift.
- Certificates still use controller-local `ensureAdmin()` plus email allowlist; this is less formal than policy/permission based access.
- Documentation has stale stack data in `docs/PROJECT_CONTEXT.md` (Laravel 11/Vite 5) while manifests/runtime show Laravel 12/Vite 7.

## 6) Evidence

- `composer.json`
- `package.json`
- `routes/web.php`
- `routes/api.php`
- `app/Models/User.php`
- `app/Http/Middleware/EnsurePanelRoleAccess.php`
- `app/Services/KpiEntryService.php`
- `app/Services/KpiAccessEvaluatorService.php`
- `resources/js/app.jsx`
- `scripts/deploy/check_deploy_safety.sh`

# Codebase Structure

**Analysis Date:** 2026-05-26

## Directory Layout

```text
laravel-react-dev/
├── app/                    # Laravel application code (controllers, models, services, middleware)
├── bootstrap/              # App bootstrap and middleware/route wiring
├── config/                 # Framework and service configuration
├── database/               # Migrations, seeders, factories
├── public/                 # Web root and built assets
├── resources/              # React/Inertia frontend, CSS, Blade root view
├── routes/                 # Web/API/auth/console route definitions
├── storage/                # Runtime storage, logs, generated/public files
├── tests/                  # PHPUnit Feature/Unit tests
├── docs/                   # Product and technical documentation
├── scripts/                # Dev/deploy/git-hook scripts
├── composer.json           # PHP dependencies and scripts
├── package.json            # JS dependencies and Vite scripts
└── vite.config.js          # Frontend build configuration
```

## Directory Purposes

**`app/`:**
- Purpose: Main backend application layer.
- Contains: `Http/Controllers`, `Http/Middleware`, `Models`, `Services`, `Repositories`, `Policies`, `Observers`, `Console/Commands`.
- Key files: `app/Http/Controllers/DashboardController.php`, `app/Http/Middleware/EnsurePanelRoleAccess.php`, `app/Services/KpiEntryService.php`, `app/Models/User.php`.

**`resources/js/`:**
- Purpose: Inertia React frontend.
- Contains: Bootstrapping (`app.jsx`), layouts, pages, reusable components, UI primitives.
- Key files: `resources/js/app.jsx`, `resources/js/Layouts/AuthenticatedLayout.jsx`, `resources/js/components/app-sidebar.jsx`, `resources/js/Pages/*`.

**`routes/`:**
- Purpose: Routing entrypoints.
- Contains: Web panel routes (`web.php`), API routes (`api.php`), auth routes (`auth.php`), console routes (`console.php`).
- Key files: `routes/web.php`, `routes/api.php`.

**`database/`:**
- Purpose: Schema and seed lifecycle.
- Contains: `migrations/`, `seeders/`, `factories/`.
- Key files: `database/migrations/*`.

**`tests/`:**
- Purpose: Automated PHP tests.
- Contains: `tests/Feature/*`, `tests/Unit/*`.
- Key files: `tests/Feature/*`, `tests/Unit/*`.

**`docs/`:**
- Purpose: Internal project documentation.
- Contains: audits, backlogs, implementation notes, guides.
- Key files: `docs/technical/*`, `docs/implementation/*`.

## Key File Locations

**Entry Points:**
- `bootstrap/app.php`: Laravel app bootstrap, route registration, middleware aliases, scheduler hooks.
- `routes/web.php`: Main authenticated web panel + module actions.
- `routes/api.php`: API endpoints (public + `auth:sanctum` protected).
- `resources/js/app.jsx`: Inertia React app bootstrap and dynamic page resolution.
- `resources/views/app.blade.php`: Root Blade template mounting Inertia app.

**Configuration:**
- `composer.json`: PHP runtime/package scripts and autoload map.
- `package.json`: Frontend scripts/dependencies.
- `vite.config.js`: Vite + laravel plugin setup and dev server behavior.
- `jsconfig.json`: JS tooling compiler excludes.

**Core Logic:**
- `app/Http/Controllers/*`: Request orchestration per module.
- `app/Services/*`: Domain logic and integration orchestration.
- `app/Models/*`: Entity relationships and domain constants/scopes.
- `app/Repositories/Kpi/KpiAnalyticsRepository.php`: KPI analytics query layer.

**Testing:**
- `tests/Feature/`: HTTP/integration behavior tests.
- `tests/Unit/`: Domain/service unit-level tests.
- `phpunit.xml`: PHPUnit test configuration.

## Naming Conventions

**Files:**
- PHP classes use `PascalCase.php` by class name (e.g., `KpiEntryController.php`, `KpiAnalyticsService.php`).
- React page/component files mostly `PascalCase.jsx` (e.g., `Pages/Kpi/Summary.jsx`).
- Some legacy/new coexistence uses `_new` suffix (`resources/js/Pages/Calendar/Index_new.jsx`, `Settings_new.jsx`).

**Directories:**
- Backend follows Laravel defaults (`app/Http/Controllers`, `app/Http/Middleware`, `app/Models`).
- Frontend feature directories are grouped by page domain under `resources/js/Pages/*` (e.g., `Pages/Kpi`, `Pages/Calendar`, `Pages/Questionnaire`).
- UI primitives are in lowercase path `resources/js/components/ui/*`; legacy Laravel Breeze components still exist in `resources/js/Components/*`.

## Where to Add New Code

**New Feature (web module):**
- Primary code: add route in `routes/web.php`, controller in `app/Http/Controllers/`, service in `app/Services/` when business logic is non-trivial.
- Frontend page: add Inertia page in `resources/js/Pages/<Module>/<Page>.jsx`.
- Shared UI: add reusable component in `resources/js/components/` or `resources/js/components/ui/`.
- Tests: add feature tests in `tests/Feature/` and unit tests in `tests/Unit/`.

**New API module:**
- Route definitions: `routes/api.php`.
- Controller: `app/Http/Controllers/Api/<Module>Controller.php`.
- Domain logic: `app/Services/<Module>Service.php` (and repository under `app/Repositories/` if query-heavy).

**New Component/Module:**
- Implementation: keep backend module cohesive across `app/Models`, `app/Http/Controllers`, `app/Services`.
- Inertia page mapping must match `resources/js/Pages/...` convention used by `resources/js/app.jsx:14-18`.

**Utilities:**
- Backend helper/service: `app/Services/` or `app/Support/`.
- Frontend shared helper: `resources/js/lib/` or `resources/js/utils/`.

## Special Directories

**`storage/`:**
- Purpose: Runtime logs/cache/sessions and uploaded/generated files.
- Generated: Yes.
- Committed: No (except framework placeholders).

**`public/build/`:**
- Purpose: Vite build artifacts served to clients.
- Generated: Yes.
- Committed: Typically yes in this repository snapshot (directory present).

**`vendor/`:**
- Purpose: Composer-installed PHP dependencies.
- Generated: Yes.
- Committed: No.

**`node_modules/`:**
- Purpose: npm-installed JS dependencies.
- Generated: Yes.
- Committed: No.

**`backups/` and `storage/app/recovery-backup-*`:**
- Purpose: Local recovery/migration backup artifacts.
- Generated: Yes.
- Committed: Repository policy should keep these out of source changes unless explicitly required.

---

*Structure analysis: 2026-05-26*

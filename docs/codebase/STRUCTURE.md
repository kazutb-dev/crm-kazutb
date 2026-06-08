# Codebase Structure

## 1) Top-Level Map

| Path | Purpose | Evidence |
|------|---------|----------|
| `app/` | Laravel application code: controllers, models, middleware, policies, services, console commands | `app/Http/Controllers`, `app/Models`, `app/Services` |
| `routes/` | Web, API, auth, console route definitions | `routes/web.php`, `routes/api.php`, `routes/auth.php`, `routes/console.php` |
| `resources/js/` | React/Inertia frontend source | `resources/js/app.jsx`, `resources/js/Pages` |
| `resources/css/` | Tailwind and shared admin UI CSS | `resources/css/app.css` |
| `config/` | Laravel and module configuration | `config/app.php`, `config/kpi.php`, `config/services.php` |
| `database/migrations/` | Versioned database schema | `database/migrations/*.php` |
| `database/seeders/` | Data seeders and dictionaries | `database/seeders/*.php` |
| `tests/` | PHPUnit feature/unit tests | `phpunit.xml`, `tests/Feature`, `tests/Unit` |
| `scripts/` | DEV workflow, deploy, backup, health and safety scripts | `scripts/dev-workflow.sh`, `scripts/deploy/*.sh` |
| `docs/` | Architecture, operations, module docs, audits, backlog | `docs/PROJECT_CONTEXT.md`, `docs/modules`, `docs/audits` |
| `public/` | Web root and compiled/runtime assets | `public/index.php`, `public/build`, `public/storage` |
| `storage/` | Runtime logs, cache, uploads | `docs/PROJECT_CONTEXT.md`, `php artisan about` |

## 2) Entry Points

- Main HTTP entry: `public/index.php`.
- Web routes: `routes/web.php` with 1858 lines and many Inertia routes.
- API routes: `routes/api.php`, using public endpoints plus `auth:sanctum` protected routes.
- Auth routes: `routes/auth.php`, Laravel Breeze-style authentication.
- Console/scheduler entry: `routes/console.php`, currently schedules `dashboard:refresh-cache` every six hours.
- Frontend entry: `resources/js/app.jsx`, configured in `vite.config.js`.
- Dev watcher entry: `scripts/dev-workflow.sh`.
- Deployment entry: `scripts/deploy/deploy.sh`.

## 3) Module Boundaries

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| Controllers | Request validation, authorization calls, returning Inertia/JSON/redirects | Large reusable business algorithms when a service exists |
| Services | KPI workflow, calculations, AD sync, calendar audit, integrations, governance resolution | Rendering React pages |
| Models | Table mapping, relationships, simple domain helpers/constants | HTTP request handling |
| Policies/Middleware | Authorization and route-level access | UI-only visibility rules |
| React Pages | Page state, forms, tables, UI actions via Inertia/router | Backend authority decisions |
| Migrations | Schema changes only | Business data imports not tied to schema |
| Scripts | Operational workflow and deployment safety | Application business logic |

## 4) Naming and Organization Rules

- PHP classes use PascalCase: `KpiEntryController`, `KpiCalculationService`, `EnsurePanelRoleAccess`.
- React pages are PascalCase `.jsx` files under feature folders: `Pages/Kpi/Summary.jsx`, `Pages/Calendar/Index.jsx`.
- Inertia page names map to files: `Inertia::render('Kpi/Summary')` -> `resources/js/Pages/Kpi/Summary.jsx`.
- Shared UI exists in both legacy `resources/js/Components` and newer lowercase `resources/js/components/ui`.
- Import alias `@` is used for `resources/js`, for example `@/components/app-sidebar`.

## 5) Evidence

- `routes/web.php`
- `routes/api.php`
- `resources/js/app.jsx`
- `vite.config.js`
- `resources/js/Layouts/AuthenticatedLayout.jsx`
- `resources/js/components/app-sidebar.jsx`
- `docs/PROJECT_CONTEXT.md`
- `docs/codebase/.codebase-scan.txt`

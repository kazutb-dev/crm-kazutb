# Technology Stack

## 1) Runtime Summary

| Area | Value | Evidence |
|------|-------|----------|
| Primary language | PHP backend + JavaScript/React frontend | `composer.json`, `package.json`, `resources/js/app.jsx` |
| Runtime + version | PHP 8.3.6 in this DEV environment; Laravel 12.53.0 from `php artisan about` | `composer.json`, terminal output from `php artisan about` |
| Package manager | Composer and npm | `composer.json`, `package.json` |
| Module/build system | Laravel + Inertia + Vite, ES modules | `vite.config.js`, `resources/js/app.jsx`, `package.json` |

## 2) Production Frameworks and Dependencies

| Dependency | Version | Role in system | Evidence |
|------------|---------|----------------|----------|
| `laravel/framework` | `^12.0` | Backend framework, routing, ORM, auth, queues | `composer.json` |
| `inertiajs/inertia-laravel` | `^2.0` | Laravel-to-React page bridge | `composer.json`, `resources/js/app.jsx` |
| `laravel/sanctum` | `^4.0` | API token/session auth for API routes | `composer.json`, `routes/api.php` |
| `tightenco/ziggy` | `^2.0` | Exposes Laravel route names to React | `composer.json`, `resources/js/components/app-sidebar.jsx` |
| `dompdf/dompdf` | `^3.1` | PDF export/generation | `composer.json`, `app/Http/Controllers/KpiSummaryController.php` |
| `phpoffice/phpspreadsheet` | `^3.10` | Excel/XLSX exports | `composer.json`, `app/Http/Controllers/KpiSummaryController.php` |
| `spatie/laravel-activitylog` | `^4.12` | Activity/audit logging support | `composer.json`, `config/activitylog.php` |
| `laravel/pulse` | `^1.7` | Runtime monitoring | `composer.json`, `config/pulse.php` |
| `react` / `react-dom` | `^18.2.0` | Frontend UI | `package.json`, `resources/js/app.jsx` |
| `@inertiajs/react` | `^2.0.0` | Inertia React adapter | `package.json`, `resources/js/app.jsx` |
| `vite` | `^7.0.7` | Frontend build tool | `package.json`, `vite.config.js` |
| `tailwindcss` | `^3.2.1` | Utility CSS | `package.json`, `tailwind.config.js`, `resources/css/app.css` |
| `lucide-react` | `^0.577.0` | Icons | `package.json`, `resources/js/components/app-sidebar.jsx` |
| `sonner` | `^2.0.7` | Toast notifications | `package.json`, `resources/js/app.jsx`, `AuthenticatedLayout.jsx` |

## 3) Development Toolchain

| Tool | Purpose | Evidence |
|------|---------|----------|
| Laravel Pint | PHP formatting | `composer.json` |
| PHPUnit 11 | PHP tests | `composer.json`, `phpunit.xml`, `tests/` |
| Laravel Pail | Local log tailing | `composer.json` |
| Telescope | Local/staging debug tooling | `composer.json`, `config/telescope.php` |
| Vite | Frontend build/watch | `package.json`, `vite.config.js`, `scripts/dev-workflow.sh` |
| deploy scripts | Safety, release, backup, rollback, sync | `scripts/deploy/*.sh`, `docs/PROJECT_CONTEXT.md` |

## 4) Key Commands

```bash
composer install
npm install
npm run build
composer test
php artisan test
./scripts/deploy/deploy.sh safety
```

## 5) Environment and Config

- Config sources: `config/*.php`, `.env`, `.env.example`, `vite.config.js`, `tailwind.config.js`, `phpunit.xml`.
- Required env groups: `APP_*`, `DB_*`, `SESSION_*`, `QUEUE_CONNECTION`, `AD_*`, `TOPIC_AI_*`, `OPENAI_*`, `GREEN_API_*`, `ZOOM_*`, `PERCO_DB_*`, `VITE_*`.
- DEV currently reports: `APP_ENV=local`, debug enabled, timezone `Asia/Almaty`, database driver `mysql`, queue/session/cache drivers `database`.
- Node in this environment is `v18.19.1`; project docs and safety script warn that Node 20 LTS is desired.

## 6) Evidence

- `composer.json`
- `package.json`
- `vite.config.js`
- `tailwind.config.js`
- `phpunit.xml`
- `.env.example`
- `docs/PROJECT_CONTEXT.md`
- `docs/codebase/.codebase-scan.txt`

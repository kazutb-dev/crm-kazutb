# Technology Stack

**Analysis Date:** 2026-05-26

## Languages

**Primary:**
- PHP ^8.2 - Backend application, API, jobs, and integrations in `app/`, configured by `composer.json`.
- JavaScript (ES modules) - Frontend SPA and build config in `resources/js/`, `vite.config.js`, `tailwind.config.js`.

**Secondary:**
- JSX (React) - Inertia React pages and components in `resources/js/Pages/**/*.jsx` and `resources/js/components/**/*.jsx`.
- SQL (via Query Builder/Eloquent) - Relational data access in controllers/models (for example `app/Http/Controllers/PercoController.php` and `app/Models/*`).
- Bash - Local dev workflow automation in `scripts/dev-workflow.sh`.

## Runtime

**Environment:**
- PHP runtime constrained to ^8.2 in `composer.json`.
- Node.js runtime required for Vite/Tailwind build pipeline (`package.json` scripts and dependencies).

**Package Manager:**
- Composer (PHP dependencies) - `composer.json`
- npm (JS dependencies) - `package.json`
- Lockfile: present (`composer.lock`, `package-lock.json`)

## Frameworks

**Core:**
- Laravel ^12.0 - Application framework and routing (`composer.json`, `bootstrap/app.php`).
- Inertia.js (Laravel + React) - Server-driven SPA bridge (`composer.json` includes `inertiajs/inertia-laravel`, frontend boot in `resources/js/app.jsx`).
- React ^18.2.0 - Frontend UI runtime (`package.json`, `resources/js/app.jsx`).

**Testing:**
- PHPUnit ^11.5.3 - PHP test runner (`composer.json`, `phpunit.xml`).

**Build/Dev:**
- Vite ^7.0.7 - Frontend bundling/dev server (`package.json`, `vite.config.js`).
- Laravel Vite Plugin ^2.0.0 - Laravel asset integration (`package.json`, `vite.config.js`).
- Tailwind CSS ^3.2.1 + PostCSS/Autoprefixer - Styling pipeline (`package.json`, `tailwind.config.js`, `postcss.config.js`).

## Key Dependencies

**Critical:**
- `laravel/sanctum` ^4.0 - API/session auth for SPA and token API (`composer.json`, `config/sanctum.php`, `routes/api.php`).
- `inertiajs/inertia-laravel` ^2.0 - Inertia transport layer (`composer.json`, `bootstrap/app.php`, `resources/js/app.jsx`).
- `@inertiajs/react` ^2.0.0 - Frontend Inertia adapter (`package.json`, `resources/js/app.jsx`).
- `darkaonline/l5-swagger` ^11.0 and `dedoc/scramble` ^0.13.23 - OpenAPI documentation tooling (`composer.json`, `config/l5-swagger.php`, `config/scramble.php`).

**Infrastructure:**
- `laravel/pulse` ^1.7 - Runtime metrics/observability (`composer.json`, `config/pulse.php`).
- `laravel/telescope` ^5.20 (dev) - Request/query/job inspection (`composer.json`, `config/telescope.php`).
- `spatie/laravel-activitylog` ^4.12 - Activity audit logging (`composer.json`, scheduled cleanup in `bootstrap/app.php`).
- `dompdf/dompdf` ^3.1 - PDF generation support (`composer.json`).

## Configuration

**Environment:**
- Environment file presence detected: `.env`, `.env.example`, `.env.testing` (contents not inspected).
- Core runtime and service config is env-driven through Laravel config files (`config/app.php`, `config/database.php`, `config/services.php`, `config/queue.php`, `config/filesystems.php`).
- Local auth/API statefulness configured via Sanctum (`config/sanctum.php`).

**Build:**
- Frontend build config files: `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`.
- PHP test/runtime config: `phpunit.xml`, `bootstrap/app.php`.

## Platform Requirements

**Development:**
- PHP 8.2+, Composer, Node.js + npm (from `composer.json`, `package.json`, and README setup flow in `README.md`).
- Relational database for app data (MySQL in documented setup: `README.md`; connection options in `config/database.php`).
- Optional LDAP PHP extension requirement for AD integration because `ldap_*` functions are called in `app/Services/ActiveDirectoryAuthenticator.php`.

**Production:**
- Hosting platform not explicitly declared (no CI workflow or deployment manifest detected in `.github/` and project root).
- Runtime assumptions indicate a Laravel web app with queue worker and built frontend assets (`composer.json` `dev` script runs `php artisan serve`, `php artisan queue:listen`, and `npm run dev`).

---

*Stack analysis: 2026-05-26*

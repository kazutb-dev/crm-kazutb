# Conventions

## 1) Naming

- PHP classes: PascalCase, one class per file where possible.
- Controllers end with `Controller`: `KpiEntryController`, `CertificateRegistryController`.
- Services end with `Service`: `KpiPeriodService`, `ZoomMeetingService`.
- Policies end with `Policy`: `KpiEntryPolicy`, `SurveyPolicy`.
- React page files use PascalCase `.jsx`: `Summary.jsx`, `TeacherDashboard.jsx`, `Index.jsx`.
- Route names use dot notation: `kpi.entries.approve`, `calendar.events.confirm`, `questionnaire.admin.groups`.

## 2) Backend Style

- Eloquent models own relationships, casts, constants and small helpers.
- Transaction-heavy workflows use services, especially KPI.
- Authorization is usually layered: middleware first, then policy or controller helper.
- JSON/redirect dual responses appear in KPI controllers for API-like and Inertia flows.
- Seeders should be idempotent, usually `firstOrCreate`, `updateOrCreate`, or `upsert`.

## 3) Frontend Style

- Inertia pages live under `resources/js/Pages/<Module>`.
- Shared layout is `resources/js/Layouts/AuthenticatedLayout.jsx`.
- Sidebar visibility is derived from shared props: `auth`, `kpi.grants`, `calendar`.
- UI uses Tailwind, shadcn-like primitives in `resources/js/components/ui`, lucide icons, and Sonner toasts.
- Forms commonly post/patch/delete via Inertia `router` or Inertia form helpers.

## 4) Error Handling

- Backend validation uses Laravel validation or FormRequest classes.
- KPI domain errors use custom exceptions in `app/Exceptions/Kpi`.
- Controller actions often return redirect flash messages for Inertia UI.
- External integrations usually read `enabled` flags from config and should degrade gracefully.

## 5) Formatting and Tooling

- PHP formatting tool: Laravel Pint is present in `composer.json`.
- JavaScript lint config was not found in the scanned root. `[TODO]` Add ESLint/Prettier config or document that the team intentionally does not use them.
- Tests use PHPUnit from `phpunit.xml`.
- Tailwind content scanning includes `resources/js/**/*.jsx`.

## 6) Evidence

- `app/Models/KpiEntry.php`
- `app/Services/KpiEntryService.php`
- `app/Http/Controllers/KpiEntryController.php`
- `app/Http/Requests/Kpi/StoreKpiPeriodRequest.php`
- `resources/js/app.jsx`
- `resources/js/Layouts/AuthenticatedLayout.jsx`
- `resources/js/components/app-sidebar.jsx`
- `composer.json`
- `phpunit.xml`

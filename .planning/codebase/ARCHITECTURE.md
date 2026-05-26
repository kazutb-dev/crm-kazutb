<!-- refreshed: 2026-05-26 -->
# Architecture

**Analysis Date:** 2026-05-26

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                           Delivery Layer                                  │
├─────────────────────┬──────────────────────┬──────────────────────────────┤
│ Web routes          │ API routes           │ Console/Scheduler            │
│ `routes/web.php`    │ `routes/api.php`     │ `bootstrap/app.php`          │
└───────────┬─────────┴──────────┬───────────┴──────────────┬───────────────┘
            │                    │                          │
            ▼                    ▼                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        Application Layer                                  │
│ Controllers `app/Http/Controllers/*`, Middleware `app/Http/Middleware/*`│
│ Services `app/Services/*`, Repository `app/Repositories/Kpi/*`           │
└───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          Domain/Data Layer                               │
│ Eloquent models `app/Models/*`, policies `app/Policies/*`,               │
│ observers `app/Observers/*`, migrations `database/migrations/*`          │
└───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    UI + Integration Surfaces                              │
│ Inertia React pages `resources/js/Pages/*`, Blade root `resources/views` │
│ External APIs via Http client in controllers/services                     │
└───────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Routing & middleware bootstrap | Registers web/api/console routes, aliases middleware, schedules jobs | `bootstrap/app.php` |
| Web delivery | Serves Inertia pages and many server actions (including inline closures) | `routes/web.php` |
| API delivery | Serves JSON endpoints with Sanctum auth for mobile/integration clients | `routes/api.php` |
| Access control | Enforces role/route permissions and calendar eligibility | `app/Http/Middleware/EnsurePanelRoleAccess.php`, `app/Http/Middleware/EnsureCalendarLeadershipAccess.php` |
| Business logic services | Encapsulates KPI, calendar audit, AD auth, integrations | `app/Services/KpiEntryService.php`, `app/Services/KpiAnalyticsService.php`, `app/Services/ActiveDirectoryAuthenticator.php` |
| Data model | Stores role-aware user profile, KPI/cert/calendar/ticket entities | `app/Models/User.php` and peer models in `app/Models/*` |

## Pattern Overview

**Overall:** Laravel modular monolith (MVC + service layer + Inertia SPA adapter)

**Key Characteristics:**
- HTTP entrypoints are route-first (`routes/web.php`, `routes/api.php`) and fan into controllers or route closures.
- Controllers frequently orchestrate Eloquent directly; selected domains delegate to services/repositories (notably KPI analytics/entry flows).
- Frontend is server-driven Inertia: PHP provides page props, React page components render UI.

## Layers

**Routing Layer:**
- Purpose: URL mapping, middleware grouping, route naming.
- Location: `routes/web.php`, `routes/api.php`, `routes/auth.php`, `routes/console.php`.
- Contains: Route groups, controller bindings, inline closure handlers.
- Depends on: Controllers, models, services, middleware aliases.
- Used by: Laravel HTTP kernel bootstrap in `bootstrap/app.php`.

**Controller Layer:**
- Purpose: Request validation, authorization, response shaping (Inertia/JSON/redirect).
- Location: `app/Http/Controllers/*`.
- Contains: Feature controllers by module (`Kpi*Controller`, `Calendar*Controller`, `Api/*`).
- Depends on: Eloquent models, service classes, FormRequest DTOs, policies.
- Used by: Route definitions.

**Service/Repository Layer:**
- Purpose: Concentrate reusable business workflows and heavy data aggregations.
- Location: `app/Services/*`, `app/Repositories/Kpi/*`.
- Contains: Transactional KPI operations (`KpiEntryService`), analytics assembly (`KpiAnalyticsService` + `KpiAnalyticsRepository`), integration clients.
- Depends on: Models, DB facade, Cache, Storage, HTTP client.
- Used by: Controllers and occasional middleware/observers.

**Domain/Data Layer:**
- Purpose: Persist entities and relationships.
- Location: `app/Models/*`, `database/migrations/*`.
- Contains: Eloquent models with scopes/relations/casts.
- Depends on: Laravel ORM, database connection.
- Used by: Controllers, services, middleware, observers.

**Presentation Layer:**
- Purpose: Render authenticated panel and module pages.
- Location: `resources/js/app.jsx`, `resources/js/Layouts/*`, `resources/js/Pages/*`, `resources/views/app.blade.php`.
- Contains: Inertia bootstrapping, shared layout/sidebar, module pages.
- Depends on: Inertia props from middleware/controllers.
- Used by: Browser clients.

## Data Flow

### Primary Request Path (Inertia web page)

1. Route resolves and middleware stack runs (`bootstrap/app.php:24-43`, `routes/web.php:73-90`).
2. Access checks execute (`app/Http/Middleware/EnsurePanelRoleAccess.php:20-196`).
3. Controller composes payload and returns Inertia response (`app/Http/Controllers/DashboardController.php:18-466`).
4. Shared props are injected (`app/Http/Middleware/HandleInertiaRequests.php:37-87`).
5. React page is resolved and rendered by Inertia bootstrap (`resources/js/app.jsx:12-32`).

### API Token Flow

1. API route receives credentials (`routes/api.php:18-31`).
2. Auth controller validates and authenticates via AD, then fallback local auth (`app/Http/Controllers/Api/AuthController.php:14-48`).
3. Sanctum token is minted and returned (`app/Http/Controllers/Api/AuthController.php:50-56`).
4. Protected routes use `auth:sanctum` group (`routes/api.php:29-115`).

### KPI Transaction Flow

1. KPI route dispatches to controller methods (`routes/web.php:233-277`).
2. Controller authorizes and forwards to service (`app/Http/Controllers/KpiEntryController.php:39-106`).
3. Service executes DB transaction and status transitions (`app/Services/KpiEntryService.php:35-109`, `:186-260`).
4. Response returns JSON or redirect with flash message (`app/Http/Controllers/KpiEntryController.php:56-66`, `:89-99`).

**State Management:**
- Persistent state: MySQL via Eloquent models in `app/Models/*`.
- Session/flash state: Laravel session exposed to Inertia in `app/Http/Middleware/HandleInertiaRequests.php:63-68`.
- Short-lived cache: `Cache::remember` and `Cache::get` in analytics/dashboard (`app/Services/KpiAnalyticsService.php:24-67`, `app/Http/Controllers/DashboardController.php:442`).

## Key Abstractions

**Role Resolution:**
- Purpose: Normalize mixed legacy/new role storage.
- Examples: `app/Models/User.php:204-242`, `app/Http/Middleware/EnsurePanelRoleAccess.php:22-196`.
- Pattern: Central role slug resolver + route-prefix authorization checks.

**KPI Domain Service:**
- Purpose: Encapsulate KPI entry stage/status transitions and structural confirmations.
- Examples: `app/Services/KpiEntryService.php`, `app/Http/Controllers/KpiEntryController.php`.
- Pattern: Transaction script service called from thin(er) controller endpoints.

**Inertia Shared Context:**
- Purpose: Provide global auth, grants, calendar counters, flash messages.
- Examples: `app/Http/Middleware/HandleInertiaRequests.php:48-85`, consumed in `resources/js/Layouts/AuthenticatedLayout.jsx:13-20`.
- Pattern: Middleware-computed shared props instead of repeated controller props.

## Entry Points

**HTTP Application Bootstrap:**
- Location: `bootstrap/app.php`
- Triggers: Every web/API request.
- Responsibilities: Route registration, middleware aliases, exception rendering, scheduler setup.

**Web Panel Entry:**
- Location: `routes/web.php`, Blade root `resources/views/app.blade.php`.
- Triggers: Browser navigation to panel routes.
- Responsibilities: Serve Inertia pages and many module actions.

**API Entry:**
- Location: `routes/api.php`.
- Triggers: JSON clients (mobile/integration).
- Responsibilities: Auth/token lifecycle and REST-like module endpoints.

## Architectural Constraints

- **Threading:** Request-per-process PHP execution model; no app-level shared mutable memory across requests (`bootstrap/app.php` bootstrap semantics).
- **Global state:** Route files define large closure-scoped helper functions for calendar logic (`routes/web.php:512-695`), and middleware repeats calendar access logic (`app/Http/Middleware/EnsurePanelRoleAccess.php:203-236`, `app/Http/Middleware/EnsureCalendarLeadershipAccess.php:18-59`, `app/Http/Middleware/HandleInertiaRequests.php:90-129`).
- **Circular imports:** Not detected in inspected PHP/JS module graph.
- **Authorization dependency:** Most panel routes assume `resolvedRoleSlug()` behavior from `app/Models/User.php:204-229`; role normalization changes impact routing access globally.

## Anti-Patterns

### Fat Route File with Embedded Domain Logic

**What happens:** `routes/web.php` contains extensive business workflows (calendar conflict checks, slot expansion, notifications) inside closures (`routes/web.php:512-1661`).
**Why it's wrong:** Business rules are hard to test/reuse and routing file becomes a high-risk merge hotspot.
**Do this instead:** Move closure workflows to dedicated controllers/services, following existing service usage pattern in `app/Http/Controllers/KpiAnalyticsController.php:15-31` + `app/Services/KpiAnalyticsService.php`.

### Duplicated Access Logic Across Layers

**What happens:** Calendar-access checks are reimplemented in multiple places (`app/Http/Middleware/EnsureCalendarLeadershipAccess.php`, `app/Http/Middleware/EnsurePanelRoleAccess.php:203-236`, `app/Http/Middleware/HandleInertiaRequests.php:90-129`).
**Why it's wrong:** Rules can drift, producing inconsistent behavior between route access and UI visibility.
**Do this instead:** Centralize access predicate in one service class and reuse from middleware + shared-props middleware.

## Error Handling

**Strategy:** Hybrid exception + response branching.

**Patterns:**
- Domain exceptions converted to HTTP/flash in controllers (`app/Http/Controllers/KpiPeriodController.php:122-130`, `app/Http/Controllers/KpiEntryController.php:64-66`).
- API auth failures return structured JSON with status codes (`app/Http/Controllers/Api/AuthController.php:25-47`).
- Global API unauthorized handling in bootstrap exception renderer (`bootstrap/app.php:46-50`).

## Cross-Cutting Concerns

**Logging:** Spatie activity log + custom audit log service (`app/Services/AuditLogService.php`, `app/Observers/AuditableModelObserver.php`, `app/Http/Controllers/DashboardController.php:333-385`).
**Validation:** Request validation in controllers and FormRequest classes (`app/Http/Controllers/Api/AnnouncementController.php:51-58`, `app/Http/Requests/Kpi/StoreKpiPeriodRequest.php`).
**Authentication:** Session auth for web + Sanctum tokens for API (`routes/auth.php`, `routes/api.php:29-115`, `app/Http/Controllers/Api/AuthController.php`).

---

*Architecture analysis: 2026-05-26*

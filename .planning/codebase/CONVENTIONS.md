# Coding Conventions

**Analysis Date:** 2026-05-26

## Naming Patterns

**Files:**
- Use `PascalCase` for most React component/page files in `resources/js/Components/*.jsx`, `resources/js/Pages/**/*.jsx`, and `resources/js/Layouts/*.jsx`.
- Use `kebab-case` for some newer shadcn-style modules in `resources/js/components/*.jsx` and `resources/js/components/ui/*.jsx` (for example `resources/js/components/app-sidebar.jsx`, `resources/js/components/ui/button.jsx`).
- Use `PascalCase` for PHP class files in `app/**/*.php` and test classes in `tests/**/*.php`.

**Functions:**
- Use `camelCase` for PHP methods and helpers (for example `authenticate()` in `app/Http/Requests/Auth/LoginRequest.php`, `findTopMatches()` in `app/Services/TopicSimilarityService.php`).
- Use `camelCase` for JavaScript functions/hooks (for example `useIsMobile()` in `resources/js/hooks/use-mobile.jsx`, `formatStructuralUnitLabel()` in `resources/js/utils/kpi-structure-label.js`).

**Variables:**
- Use `snake_case` for DB payload keys and request fields in PHP arrays (for example `group_discipline_id` in `app/Http/Requests/Api/Questionnaire/StoreSurveyResponseRequest.php`).
- Use `camelCase` for local PHP/JS variables (for example `$normalizedInput` in `app/Services/TopicSimilarityService.php`, `holidayDates` in `resources/js/Pages/Calendar/Overview.jsx`).

**Types:**
- Use PHP scalar/object type hints and return types broadly (for example `public function index(...): JsonResponse` in `app/Http/Controllers/Api/Questionnaire/StudentSurveyController.php`).
- Use PHPDoc array-shape annotations for complex arrays (for example `@return array{normalized:string,items:list<...>}` in `app/Services/TopicSimilarityService.php`).
- TypeScript is not used in application code (`resources/js` is `.js/.jsx` only; `jsconfig.json` has no TS path/type rules).

## Code Style

**Formatting:**
- Baseline style is defined by `.editorconfig` (UTF-8, LF, spaces, default indent size 4; YAML indent 2).
- JavaScript formatting is not enforced by a checked-in Prettier config (`.prettierrc*` not detected).

**Linting:**
- ESLint config files are not detected (`.eslintrc*`, `eslint.config.*`, `biome.json` not present).
- `resources/js` contains inline ESLint suppression comments (for example `resources/js/Pages/Certificates/Index.jsx:147`, `resources/js/Pages/Questionnaire/Admin/TeacherDisciplines.jsx:443`), so local/editor linting is expected but repo-level lint config is absent.
- `laravel/pint` exists in `composer.json` `require-dev`, but no `pint.json` and no dedicated `composer` script for Pint are present.

## Import Organization

**Order:**
1. Namespace and `use` imports in PHP classes (`app/**/*.php`).
2. External package imports in JSX (`@inertiajs/react`, `lucide-react`, etc.), then internal alias imports (`@/...`) as seen in `resources/js/Pages/Calendar/Overview.jsx`.
3. Relative/local imports and side-effect imports (for example `resources/js/app.jsx` loads CSS/bootstrap/i18n first, then packages).

**Path Aliases:**
- Use `@/` alias for frontend internal modules (for example `@/Layouts/AuthenticatedLayout`, `@/components/ui/button` in `resources/js/Pages/Calendar/Overview.jsx`).
- Alias intent is documented in `components.json` (`components`, `ui`, `lib`, `hooks` mapped to `@/...`).

## Error Handling

**Patterns:**
- Use FormRequest validation for request-level rules/messages (`app/Http/Requests/**`).
- In API controllers, guard auth/role early and return JSON with explicit status codes (`app/Http/Controllers/Api/Questionnaire/StudentSurveyController.php`).
- Catch broad `Throwable` in API boundaries when needed and map to client-safe responses (`app/Http/Controllers/Api/Questionnaire/StudentSurveyController.php`).
- Use `abort(...)`/`abort_unless(...)` for authorization guards in web controllers/middleware (`app/Http/Controllers/NavigationRouteController.php`, `app/Http/Middleware/EnsurePanelRoleAccess.php`).

## Logging

**Framework:** Laravel `Log` facade

**Patterns:**
- Emit structured event-name logs with context arrays (`Log::info('nav-route.store.request', [...])`) in `app/Http/Controllers/NavigationRouteController.php`.
- Prefer context keys like `user_id`, `route_id`, and payload snapshots over plain strings.

## Comments

**When to Comment:**
- Keep comments for non-obvious transformations or domain-specific behavior (for example stemming rationale in `app/Services/TopicSimilarityService.php`).
- Use short section comments in JSX for UI blocks (`resources/js/Pages/Calendar/Overview.jsx`).

**JSDoc/TSDoc:**
- PHPDoc is used frequently for return contracts and generics-like array typing (`app/Services/TopicSimilarityService.php`, `app/Http/Requests/Auth/LoginRequest.php`).
- JSDoc/TSDoc usage in frontend files is minimal; conventions rely on readable naming and component structure.

## Function Design

**Size:** 
- Service methods can be substantial for domain logic (for example `findTopMatches()` in `app/Services/TopicSimilarityService.php`), while controllers still keep action-oriented methods.

**Parameters:** 
- Use explicit typed parameters in PHP and dependency injection for services/requests (`StudentSurveyController`, `LoginRequest`).
- Use object props destructuring in React components (`CalendarOverview({ stats, upcomingEvents = [], ... })`).

**Return Values:** 
- Use explicit return types in PHP (`JsonResponse`, `array`, `string`, etc.).
- In React, components return JSX and utility functions return normalized primitives/objects.

## Module Design

**Exports:** 
- Use default exports for page/layout components (`resources/js/Pages/Auth/Login.jsx`, `resources/js/Layouts/AuthenticatedLayout.jsx`).
- Use named exports for utilities and reusable UI helpers (`resources/js/lib/utils.js`, `resources/js/components/ui/button.jsx`).

**Barrel Files:** 
- Barrel files are not a primary pattern; modules are imported directly by file path.

---

*Convention analysis: 2026-05-26*

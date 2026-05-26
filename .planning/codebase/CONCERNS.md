# Codebase Concerns

**Analysis Date:** 2026-05-26

## Tech Debt

**Controller bloat and mixed responsibilities (high coupling hotspot):**
- Issue: Core business flows, data shaping, validation, and persistence are concentrated in very large controllers.
- Files: `app/Http/Controllers/KpiEntryController.php` (2483 lines), `app/Http/Controllers/KpiSummaryController.php` (2361 lines), `app/Http/Controllers/PercoController.php` (2212 lines), `app/Http/Controllers/DirectoryUserController.php` (1823 lines).
- Impact: High change risk, regression-prone edits, hard-to-isolate bugs, and low maintainability.
- Fix approach: Extract request validation/form objects, query services, and workflow services per bounded module (KPI, HR Perco, Directory).

**Routing layer contains heavy business logic closures:**
- Issue: `routes/web.php` contains large inline closures with query logic and calendar/business computation, not just route definitions.
- Files: `routes/web.php` (96.9 KB), especially closure-heavy sections around calendar and library catalog proxy.
- Impact: Route file becomes a hidden service layer; behavior is hard to test and hard to reuse.
- Fix approach: Move closure bodies into dedicated controllers/services and keep routes declarative.

**Model duplication and normalization drift:**
- Issue: Duplicate trait declarations and duplicate cast keys in `User` model indicate merge drift.
- Files: `app/Models/User.php` (`use HasFactory, HasApiTokens, Notifiable;` repeated; duplicated `last_login_at`, `updated_profile_at`, `profile_completed_at` casts).
- Impact: Increases confusion, risks accidental divergence, and signals weak static quality gates.
- Fix approach: Deduplicate model declarations and add lint/static checks for duplicate members.

## Known Bugs

**Missing Telegram webhook implementation artifact:**
- Symptoms: Webhook controller file exists but is empty.
- Files: `app/Http/Controllers/Api/TelegramWebhookController.php` (0 lines).
- Trigger: Any attempt to wire/use Telegram webhook functionality.
- Workaround: Not applicable; implementation is absent.

**Telegram notifier config mismatch:**
- Symptoms: Notifier reads `services.telegram.*`, but no `telegram` section is defined in `config/services.php`.
- Files: `app/Services/TelegramNotifier.php`, `config/services.php`.
- Trigger: Calendar notification flow expecting Telegram delivery.
- Workaround: None in code; feature effectively disabled unless runtime config is injected elsewhere.

## Security Considerations

**Public unauthenticated API endpoints without explicit throttling:**
- Risk: Abuse/spam and brute-force pressure on open endpoints.
- Files: `routes/api.php` (`POST /login`, `POST /admin/login`, `POST /tickets`, `POST /library/reservations`, `POST /ai/chat`).
- Current mitigation: Input validation; auth on protected group only.
- Recommendations: Add route-level rate limits for login, ticket, reservation, and AI endpoints.

**Potential information disclosure in API error payload:**
- Risk: Upstream exception message is returned to clients on catalog proxy failure.
- Files: `routes/web.php` library catalog closure returns `'error' => $exception->getMessage()`.
- Current mitigation: Wrapped in try/catch.
- Recommendations: Replace raw exception text with opaque error ID; log details server-side only.

**Verbose third-party response logging may capture sensitive payloads:**
- Risk: External API bodies and response payloads are logged on failures/successes.
- Files: `app/Services/GreenApiWhatsAppNotifier.php` (`response` and `response->body()` logs), `app/Services/ZoomMeetingService.php` (`response` bodies in warnings), `app/Services/AiTopicReviewService.php` (`body` logged).
- Current mitigation: Some URL/token masking is present for Green API endpoint.
- Recommendations: Redact payloads and PII fields; log status/error codes only by default.

**Public file storage for KPI evidence uploads:**
- Risk: Uploaded evidence files are stored on `public` disk and can become web-accessible if guessed/leaked.
- Files: `app/Services/KpiEntryFileService.php` (stores to `public`), `config/filesystems.php` (`public` disk mapped to `/storage`).
- Current mitigation: File size caps exist.
- Recommendations: Store evidence on private disk and stream via authorized download endpoints.

## Performance Bottlenecks

**In-memory full-table similarity matching for diploma checks:**
- Problem: Similarity service loads all candidate diplomas and computes token/ngram scores in PHP loops.
- Files: `app/Services/TopicSimilarityService.php` (`$candidates = $query->get();` then iterative scoring).
- Cause: No DB-side narrowing/index-assisted candidate prefilter before heavy scoring.
- Improvement path: Add prefilter (indexed fulltext/normalized prefix filters), limit candidate set before scoring, move expensive checks to queue.

**Perco analytics executes repeated heavy aggregate queries per request:**
- Problem: Multiple cloned query builders with repeated `selectRaw/groupBy` aggregations in one request path.
- Files: `app/Http/Controllers/PercoController.php` (`late`, `absence`, `early`, etc.).
- Cause: Repeated aggregate calculations against external `perco` DB with minimal caching.
- Improvement path: Pre-aggregate daily snapshots, cache filtered aggregates, or use materialized/reporting tables.

**Route-level calendar slot expansion loops can be expensive:**
- Problem: Slot-overlap and month-expansion logic iterates day-by-day and slot-by-slot in route closures.
- Files: `routes/web.php` calendar closure helpers (`$hasSlotOverlap`, `$findSlotOverlaps`, `$expandSlotsForMonth`).
- Cause: Computational loops live in request path without dedicated caching strategy.
- Improvement path: Move logic to service with memoization/cache and bounded query windows.

## Fragile Areas

**Role/permission logic split across middleware, route names, and ad-hoc checks:**
- Files: `app/Http/Middleware/EnsurePanelRoleAccess.php`, `routes/web.php`, `app/Http/Controllers/Api/TicketController.php`.
- Why fragile: Authorization depends on string prefix matching of route names plus controller-local checks.
- Safe modification: Centralize permission matrix in policy/gate layer; avoid route-name-prefix authorization.
- Test coverage: No direct tests detected for `EnsurePanelRoleAccess` behavior.

**Large transactional KPI write paths with mixed validation/state transitions:**
- Files: `app/Http/Controllers/KpiEntryController.php`, `app/Services/KpiEntryService.php`.
- Why fragile: Multi-step status transitions, file writes, and history creation happen in dense methods.
- Safe modification: Isolate state machine transitions and file operations into smaller atomic services.
- Test coverage: No dedicated feature tests detected targeting `KpiEntryController` flows.

## Scaling Limits

**HTTP-coupled synchronous integrations in request/command paths:**
- Current capacity: Calls use short per-request timeouts (8–20s) and run inline.
- Limit: External latency spikes directly degrade user/API response time.
- Files: `app/Http/Controllers/Api/AiChatController.php`, `app/Services/ZoomMeetingService.php`, `app/Services/GreenApiWhatsAppNotifier.php`, `app/Http/Controllers/LibraryLoanController.php`.
- Scaling path: Move non-critical notifications/checks to queues; add circuit breakers and cached fallback responses.

**Test environment depends on MySQL by default:**
- Current capacity: PHPUnit config sets `DB_CONNECTION=mysql`.
- Limit: CI/local setups without MySQL become fragile or slow; limits parallel and ephemeral test execution.
- Files: `phpunit.xml`.
- Scaling path: Add sqlite-compatible test profile and split DB-dependent feature suites.

## Dependencies at Risk

**Internal network hardcoded defaults for external systems:**
- Risk: Runtime portability and environment drift when private endpoints are unreachable.
- Impact: Features fail outside specific network (library/perco/AD assumptions).
- Files: `config/services.php` (`library_catalog` default `http://10.0.1.8:5173/...`), `config/database.php` (`perco` host `10.0.1.31`), `config/ad.php` (`dc1.kaztbu.edu.kz`).
- Migration plan: Remove infrastructure defaults from code and require explicit env-provided endpoints per environment.

## Missing Critical Features

**No explicit API rate-limiting policy for high-risk public endpoints:**
- Problem: Security and abuse controls are not defined per endpoint in `routes/api.php`.
- Blocks: Safe external/mobile exposure at higher traffic levels.

**No implemented Telegram webhook despite model/support references:**
- Problem: Telegram link/webhook integration is incomplete in controller layer.
- Blocks: End-to-end Telegram identity/linking workflows.

## Test Coverage Gaps

**Critical enterprise modules largely untested:**
- What's not tested: KPI entry lifecycle, KPI summaries, HR Perco analytics, role-gating middleware branches.
- Files: `app/Http/Controllers/KpiEntryController.php`, `app/Http/Controllers/KpiSummaryController.php`, `app/Http/Controllers/PercoController.php`, `app/Http/Middleware/EnsurePanelRoleAccess.php`.
- Risk: High-severity regressions can ship undetected in core workflows.
- Priority: High.

**Baseline scaffold tests still present while complex areas lack parity:**
- What's not tested: Complex controller/service behavior compared to trivial scaffold checks.
- Files: `tests/Feature/ExampleTest.php`, `tests/Unit/ExampleTest.php`.
- Risk: Test suite gives false confidence relative to production complexity.
- Priority: Medium.

**Unknowns explicitly noted:**
- End-to-end production observability/alerting coverage is not fully inferable from repository files alone.
- Runtime WAF/rate-limiter config outside application code is not detectable in this scan.

---

*Concerns audit: 2026-05-26*

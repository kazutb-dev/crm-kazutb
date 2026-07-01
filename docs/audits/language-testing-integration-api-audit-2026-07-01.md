# Language Testing Integration API Audit

Date: 2026-07-01

## Executive Summary

- CRM contained active tests during the incident window.
- The reported `No active tests` issue was caused by integration authentication failure, not missing test data.
- Production logs showed repeated `GET /api/v1/tests` responses with `401` status.
- The integration middleware previously read only the new module key locations. Backward-compatible legacy key support is now restored.
- Public health, structured request tracing, rate limiting, and standardized JSON errors are now in place.

## Current Issue Root Cause

Route path audited: `Route -> Middleware -> Controller -> Service -> Repository -> JSON`

- Route: `GET /api/v1/tests`
- Middleware: `api` -> `LogLanguageTestingApiRequests` -> `throttle:language-testing-integration` -> `EnsureLanguageTestingApiConsumer`
- Controller: `LanguageTestingApiController@index`
- Service: `LanguageTestingService::paginateActiveTests()` for integration consumers
- Repository: `LanguageTestingRepository::paginateActiveTests()` filters `status = active`
- Response: JSON `data` + `meta`

Findings:

- Active tests existed in CRM.
- Production log entries for the affected endpoint were `401`, not `200` with an empty `data` array.
- Integration auth configuration under `language_testing_module.integration.*` was unset.
- Legacy auth compatibility under `language_testing.api_key` existed in the codebase but was not used by the middleware before this patch.

Impact:

- Student Platform could not authenticate consistently.
- The failure could be misinterpreted externally as “no active tests” if the client flattened auth errors.

Fix:

- Added fallback to the legacy key configuration path.
- Added request IDs and standardized JSON auth errors.

## API Inventory

| Method | Route | Purpose | Middleware | Controller | Auth |
|---|---|---|---|---|---|
| GET | `/api/v1/health` | Public health snapshot | `api`, logging, throttle | `LanguageTestingHealthApiController@show` | Public |
| GET | `/api/v1/tests` | List tests | `api`, logging, throttle, consumer auth | `LanguageTestingApiController@index` | API key, integration bearer, Sanctum |
| POST | `/api/v1/tests` | Create test | previous + `auth:sanctum` | `LanguageTestingApiController@store` | Sanctum |
| GET | `/api/v1/tests/{id}` | Show test | `api`, logging, throttle, consumer auth | `LanguageTestingApiController@show` | API key, integration bearer, Sanctum |
| PUT | `/api/v1/tests/{id}` | Update test | previous + `auth:sanctum` | `LanguageTestingApiController@update` | Sanctum |
| DELETE | `/api/v1/tests/{id}` | Delete test | previous + `auth:sanctum` | `LanguageTestingApiController@destroy` | Sanctum |
| GET | `/api/v1/tests/{id}/questions` | List questions | previous + `auth:sanctum` | `LanguageTestingApiController@questions` | Sanctum |
| POST | `/api/v1/tests/{id}/questions` | Create question | previous + `auth:sanctum` | `LanguageTestingApiController@storeQuestion` | Sanctum |
| PUT | `/api/v1/questions/{id}` | Update question | previous + `auth:sanctum` | `LanguageTestingApiController@updateQuestion` | Sanctum |
| DELETE | `/api/v1/questions/{id}` | Delete question | previous + `auth:sanctum` | `LanguageTestingApiController@destroyQuestion` | Sanctum |
| GET | `/api/v1/tests/{id}/start` | Start session | `api`, logging, throttle, consumer auth | `LanguageTestingApiController@start` | API key, integration bearer |
| POST | `/api/v1/tests/{id}/submit` | Submit answers | `api`, logging, throttle, consumer auth | `LanguageTestingApiController@submit` | API key, integration bearer |
| GET | `/api/v1/statistics` | List results | previous + `auth:sanctum` | `LanguageTestingStatisticsApiController@index` | Sanctum |
| GET | `/api/v1/statistics/{id}` | Show result | previous + `auth:sanctum` | `LanguageTestingStatisticsApiController@show` | Sanctum |
| GET | `/api/v1/statistics/export/csv` | Export CSV | previous + `auth:sanctum` | `LanguageTestingStatisticsApiController@exportCsv` | Sanctum |
| GET | `/api/v1/statistics/export/excel` | Export XLSX | previous + `auth:sanctum` | `LanguageTestingStatisticsApiController@exportExcel` | Sanctum |

## API Compatibility Matrix

| Endpoint | OpenAPI promise | CRM runtime | Compatibility impact | Resolution |
|---|---|---|---|---|
| `GET /api/v1/tests` | Active tests for integration, all tests for CRM | Matches after auth fix; active filter enforced in repository | None | Kept route, fixed auth fallback |
| `GET /api/v1/tests` auth | API key or Sanctum | API key, integration bearer, Sanctum | Non-breaking additive | Documented actual auth modes |
| `GET /api/v1/tests` default direction | Shared spec implied `desc` | Runtime default is `asc` | Could confuse clients relying on docs | OpenAPI updated to `SortDirectionAsc` |
| `GET /api/v1/tests/{id}/start` | API key auth | API key or integration bearer | Non-breaking additive | OpenAPI updated |
| `POST /api/v1/tests/{id}/submit` | API key auth | API key or integration bearer | Non-breaking additive | OpenAPI updated |
| Errors | Partial | Standardized JSON with `request_id` for module paths | Non-breaking additive | Runtime hardened and docs updated |
| Health | Missing | Implemented | Additive | Route and docs added |

## Authentication Report

- Supported CRM auth: Sanctum bearer token.
- Supported integration auth: `X-API-KEY`, optional integration bearer token.
- Backward compatibility: legacy `LANGUAGE_TESTING_API_KEY` remains accepted when the new module key is unset.
- Exact middleware chain for integration reads: `api` -> `LogLanguageTestingApiRequests` -> `throttle:language-testing-integration` -> `EnsureLanguageTestingApiConsumer`.
- `401` now returns JSON with `message`, `errors.authorization`, and `request_id`.
- `403` returns standardized JSON for consumer mismatches.

## Validation Report

- Test upsert validation matches configured languages and active/inactive status values.
- Question upsert validation enforces 2..10 options and exactly one correct answer.
- Submit validation enforces required `session_id`, `first_name`, `last_name`, `email`, and non-empty `answers`.
- `per_page` handling is now aligned to the OpenAPI minimum of `1`.
- Remaining validation gap: `iin` and `phone` remain permissive strings for backward compatibility.

## Security Report

- Added request-level rate limiting for integration traffic.
- Added request and correlation IDs in headers and JSON responses.
- Logging now avoids credentials and student answer payloads.
- Models already use explicit `fillable` fields; no mass-assignment expansion was introduced.
- `submit` now runs inside a database transaction with row-level locking on the session record.
- Identical resubmissions are idempotent; conflicting resubmissions return `409`.
- Remaining risk: legacy key fallback can preserve older deployments, but any historical default secret must be rotated out operationally.

## Performance Report

- Test listing uses pagination and `withCount('questions')`.
- Start session loads randomized questions with eager-loaded answers.
- No new N+1 patterns were introduced in the public endpoints.
- Existing indexes support common filters on tests, sessions, and results.
- Load-test plan added in `docs/operations/LANGUAGE_TESTING_API_LOAD_TEST_PLAN.md` and `scripts/load-testing/language-testing-api.k6.js`.

## Student Platform Compatibility Report

- No public endpoint paths were changed.
- No response fields were removed.
- Request tracing fields were added only as extra top-level properties.
- Auth compatibility was widened, not narrowed.
- v1 submit semantics are stricter internally but backward compatible externally: same payload returns same result, conflicting replay returns `409` instead of creating duplicates.
- Verified externally with `curl` against production HTTPS:
  - `GET /api/v1/health` returned `200`
  - `GET /api/v1/tests` without auth returned `401`
  - `GET /api/v1/tests` with integration key returned `200` and active tests

## OpenAPI Compliance Report

- OpenAPI updated for `GET /api/v1/health`.
- OpenAPI updated for integration bearer auth support.
- OpenAPI updated for request ID response fields.
- OpenAPI updated for real default sort-direction semantics.
- Published copy under `public/docs/language-testing-api.yaml` updated in parallel.

## Manual Verification

- Kernel-level HTTP validation succeeded for health, authenticated list, start, submit, and unauthorized list flows.
- HTTPS `curl` verification succeeded against `crm.kaztbu.edu.kz`.
- PHPUnit/`artisan test` execution could not be completed in this environment because:
  - the repository safety guard blocks `artisan test` in production-like mode
  - current checkout does not include an executable local PHPUnit runtime even though `require-dev` declares it
- Focused feature and contract test files were added for the integration API slice.
- CI workflow gate added in `.github/workflows/language-testing-integration-contract.yml`.

## Remaining Risks

- Rotate and explicitly configure integration credentials in environment variables to remove reliance on legacy key fallback.
- Tighten `iin` and `phone` validation only after confirming Student Platform payload norms.
- Ensure CI installs dev dependencies and runs the new contract gate before every deploy.

## Reliability Report

- `submit` is now atomic and retried within a database transaction boundary.
- Session row locking prevents concurrent duplicate result creation.
- Expired sessions are marked explicitly and rejected.
- Public health endpoint verifies database, queue configuration, storage, module, and version.

## Go / No-Go

- Current status: `Go with conditions`
- Conditions:
  - configure and rotate production integration credentials
  - enable the new CI workflow in the deployment pipeline
  - execute the k6 plan in a non-production production-like environment before admissions peak

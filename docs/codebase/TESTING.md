# Testing

## 1) Test Setup

| Area | Value | Evidence |
|------|-------|----------|
| Test runner | PHPUnit 11 via `php artisan test` / `composer test` | `composer.json`, `phpunit.xml` |
| Test directories | `tests/Feature`, `tests/Unit` | `phpunit.xml`, `tests/` |
| Database strategy | MySQL connection in phpunit config; mixed `RefreshDatabase` and `DatabaseTransactions` | `phpunit.xml`, `tests/Feature/Questionnaire/QuestionnaireApiTest.php`, `tests/Feature/Calendar/CalendarWorkflowTest.php` |
| Frontend tests | Not found | `package.json`, scan output |
| Coverage gate | Not found | `phpunit.xml`, scan output |

## 2) Current Test Coverage

- Auth: login, registration, password reset/update, verification.
- Profile: profile update behavior.
- Calendar: meeting request pending status, confirm, decline, cancel, audit/notification logs.
- Questionnaire API: student surveys, duplicate submission, admin results.
- Legacy Survey: survey lifecycle and relationships.
- Topic similarity: normalization, duplicate/similar topic scoring, AI score combination.

## 3) Notable Gaps

- `[TODO]` Add KPI authorization tests for teacher/hod/dean/structural/admin/grant flows.
- `[TODO]` Add KPI period scope activation tests.
- `[TODO]` Add certificate template/registry permission and generation tests.
- `[TODO]` Add phonebook import and governance/scoped grant tests.
- `[TODO]` Add frontend smoke/build checks in CI or documented pre-commit workflow.

## 4) Recommended Commands

```bash
php artisan test
composer test
npm run build
./scripts/deploy/deploy.sh safety
```

For narrow work:

```bash
php artisan test --filter=CalendarWorkflowTest
php artisan test --filter=QuestionnaireApiTest
php artisan test --filter=TopicSimilarityServiceTest
```

## 5) Observed Verification In This Scan

- `npm run build` completed successfully, but Vite warned that Node 18.19.1 is below the required Node 20.19+ / 22.12+ range.
- `php artisan test` is blocked by the app safety guard when using the DEV app URL.
- `APP_ENV=testing php artisan test` starts PHPUnit, but fails because the configured MySQL test user cannot access the configured test database. Secret values from `.env.testing` are intentionally not copied here.

## 6) Evidence

- `composer.json`
- `phpunit.xml`
- `.env.testing`
- `tests/Feature/Calendar/CalendarWorkflowTest.php`
- `tests/Feature/Questionnaire/QuestionnaireApiTest.php`
- `tests/Feature/SurveyTest.php`
- `tests/Unit/TopicSimilarityServiceTest.php`
- `package.json`

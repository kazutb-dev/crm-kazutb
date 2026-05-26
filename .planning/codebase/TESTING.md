# Testing Patterns

**Analysis Date:** 2026-05-26

## Test Framework

**Runner:**
- PHPUnit 11 via Laravel test runner (`phpunit/phpunit` in `composer.json`).
- Config: `phpunit.xml`

**Assertion Library:**
- PHPUnit assertions plus Laravel testing helpers (`assertOk`, `assertRedirect`, `assertDatabaseHas`, `assertJsonPath`) in `tests/Feature/**/*.php`.

**Run Commands:**
```bash
composer test                    # Clears config, then runs php artisan test
php artisan test                 # Run all tests
php artisan test --testsuite=Feature  # Run feature suite only
```
- Watch mode command is not detected for backend tests.
- Coverage command is not wired in scripts/config (no enforced coverage workflow detected).

## Test File Organization

**Location:**
- Separate test tree under `tests/Unit` and `tests/Feature` (defined in `phpunit.xml`).

**Naming:**
- `*Test.php` class files matching tested behavior (for example `tests/Unit/TopicSimilarityServiceTest.php`, `tests/Feature/Calendar/CalendarWorkflowTest.php`).

**Structure:**
```text
tests/
├── Feature/
│   ├── Auth/
│   ├── Calendar/
│   └── Questionnaire/
├── Unit/
└── TestCase.php
```

## Test Structure

**Suite Organization:**
```php
class CalendarWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.green_api.enabled' => false]);
    }

    public function test_attendee_can_confirm_pending_meeting(): void
    {
        // arrange
        // act
        // assert
    }
}
```
Pattern source: `tests/Feature/Calendar/CalendarWorkflowTest.php`

**Patterns:**
- Setup pattern: `setUp()` seeds prerequisites/config toggles per suite (`tests/Feature/Questionnaire/QuestionnaireApiTest.php`, `tests/Unit/TopicSimilarityServiceTest.php`).
- Teardown pattern: explicit teardown methods are uncommon; transaction/database traits handle cleanup.
- Assertion pattern: combine HTTP assertions with DB assertions and model state checks.

## Mocking

**Framework:** Not detected as a primary pattern (`Mockery` usage not found in `tests/**/*.php`).

**Patterns:**
```php
Sanctum::actingAs($fixture['studentUser']);
$response = $this->getJson('/api/questionnaire/student/surveys');
$response->assertOk()->assertJsonCount(1, 'data');
```
Pattern source: `tests/Feature/Questionnaire/QuestionnaireApiTest.php`

**What to Mock:**
- Use config flags to disable external integrations in tests instead of deep mocking (for example `services.green_api.enabled=false` in `tests/Feature/Calendar/CalendarWorkflowTest.php`, `services.topic_ai.enabled=false` in `tests/Unit/TopicSimilarityServiceTest.php`).

**What NOT to Mock:**
- DB interactions are usually real via Eloquent factories/model creation (`tests/Feature/SurveyTest.php`, `tests/Feature/SurveyAnalyticsTest.php`).

## Fixtures and Factories

**Test Data:**
```php
$user = User::factory()->create();
$group = Group::query()->create([...]);
$survey = Survey::query()->create([...]);
```
Pattern sources: `tests/Feature/Auth/AuthenticationTest.php`, `tests/Feature/Questionnaire/QuestionnaireApiTest.php`

**Location:**
- Reusable factories in `database/factories/*.php` (for example `UserFactory.php`, `SurveyFactory.php`, `StudentFactory.php`).
- Suite-local fixture builders in private helpers (`createFixture()` in `tests/Feature/Questionnaire/QuestionnaireApiTest.php`, `createCatalog()` in `tests/Unit/TopicSimilarityServiceTest.php`).

## Coverage

**Requirements:** None enforced in repository config (no coverage threshold settings in `phpunit.xml`, no CI workflow with coverage gate detected).

**View Coverage:**
```bash
php artisan test --coverage
```
- Command availability depends on local PHP coverage driver configuration.

## Test Types

**Unit Tests:**
- Present in `tests/Unit`, but several tests still hit database models/services (for example `tests/Unit/TopicSimilarityServiceTest.php` uses `DatabaseTransactions` and Eloquent records).

**Integration Tests:**
- Primary testing style; feature tests exercise routes/controllers, auth, validation, and DB state (`tests/Feature/**/*.php`).

**E2E Tests:**
- Browser/E2E framework not detected (no Dusk/Cypress/Playwright config files found).
- Frontend component/unit test framework for `resources/js` is not detected (no Jest/Vitest config, no `*.test.jsx` in app code).

## Common Patterns

**Async Testing:**
```php
$response = $this->postJson('/api/questionnaire/student/surveys/submit', $payload);
$response->assertCreated();
```
Laravel request/response tests are synchronous in these suites.

**Error Testing:**
```php
$this->expectException(\Illuminate\Database\QueryException::class);

$second
    ->assertStatus(422)
    ->assertJsonValidationErrors(['survey_id']);
```
Pattern sources: `tests/Feature/SurveyTest.php`, `tests/Feature/Questionnaire/QuestionnaireApiTest.php`

---

*Testing analysis: 2026-05-26*

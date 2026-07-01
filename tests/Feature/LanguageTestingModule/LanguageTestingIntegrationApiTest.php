<?php

namespace Tests\Feature\LanguageTestingModule;

use App\Modules\LanguageTestingModule\Models\LanguageTestingSession;
use App\Modules\LanguageTestingModule\Models\LanguageTestingQuestion;
use App\Modules\LanguageTestingModule\Models\LanguageTestingResult;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LanguageTestingIntegrationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_is_public_and_returns_module_status(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response
            ->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.api_version', '1.0.0')
            ->assertJsonPath('data.language_testing_module', 'enabled')
            ->assertHeader('X-Request-ID');
    }

    public function test_integration_list_requires_credentials(): void
    {
        $response = $this->getJson('/api/v1/tests');

        $response
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthorized.')
            ->assertJsonStructure([
                'message',
                'errors' => ['authorization'],
                'request_id',
            ])
            ->assertHeader('X-Request-ID');
    }

    public function test_legacy_language_testing_api_key_is_accepted_for_backward_compatibility(): void
    {
        config()->set('language_testing_module.integration.api_key', '');
        config()->set('language_testing.api_key', 'legacy-integration-key');

        LanguageTestingTest::query()->create([
            'name' => 'Legacy Compatible Test',
            'language' => 'english',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
        ]);

        $response = $this->withHeaders(['X-API-KEY' => 'legacy-integration-key'])
            ->getJson('/api/v1/tests');

        $response
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertHeader('X-Request-ID');
    }

    public function test_integration_list_applies_active_language_filter_and_pagination(): void
    {
        config()->set('language_testing_module.integration.api_key', 'integration-test-key');

        LanguageTestingTest::query()->create([
            'name' => 'Zulu Test',
            'language' => 'english',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
            'created_at' => now()->subMinute(),
            'updated_at' => now()->subMinute(),
        ]);

        LanguageTestingTest::query()->create([
            'name' => 'Alpha Test',
            'language' => 'english',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'inactive',
        ]);

        LanguageTestingTest::query()->create([
            'name' => 'Beta Test',
            'language' => 'russian',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
        ]);

        $response = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->getJson('/api/v1/tests?language=english&per_page=1&sort=name&direction=asc');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Zulu Test')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_integration_client_can_list_start_and_submit_language_test(): void
    {
        config()->set('language_testing_module.integration.api_key', 'integration-test-key');

        $test = LanguageTestingTest::query()->create([
            'name' => 'Integration English Test',
            'language' => 'english',
            'description' => 'English placement for entrants.',
            'passing_score' => 50,
            'total_questions' => 2,
            'status' => 'active',
        ]);

        LanguageTestingTest::query()->create([
            'name' => 'Hidden Inactive Test',
            'language' => 'kazakh',
            'description' => null,
            'passing_score' => 70,
            'total_questions' => 5,
            'status' => 'inactive',
        ]);

        $correctAnswers = [];

        foreach ([
            ['Question 1', 'Correct 1', 'Wrong 1'],
            ['Question 2', 'Correct 2', 'Wrong 2'],
            ['Question 3', 'Correct 3', 'Wrong 3'],
        ] as $index => [$questionText, $correctText, $wrongText]) {
            $question = $test->questions()->create([
                'question' => $questionText,
                'question_type' => 'single_choice',
                'points' => 5,
                'sort_order' => $index + 1,
            ]);

            $correct = $question->answers()->create([
                'answer' => $correctText,
                'is_correct' => true,
                'sort_order' => 1,
            ]);

            $question->answers()->create([
                'answer' => $wrongText,
                'is_correct' => false,
                'sort_order' => 2,
            ]);

            $correctAnswers[$question->id] = $correct->id;
        }

        $catalogResponse = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->getJson('/api/v1/tests');

        $catalogResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Integration English Test')
            ->assertJsonPath('data.0.questions_count', 3);

        $startResponse = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->getJson("/api/v1/tests/{$test->id}/start");

        $startResponse
            ->assertOk()
            ->assertJsonStructure([
                'session_id',
                'test_id',
                'test',
                'questions' => [
                    '*' => [
                        'id',
                        'text',
                        'answers',
                    ],
                ],
            ])
            ->assertJsonPath('test_id', $test->id)
            ->assertJsonCount(2, 'questions')
            ->assertJsonMissingPath('questions.0.correct_answer_id');

        $startPayload = $startResponse->json();

        $answers = collect($startPayload['questions'])
            ->map(fn (array $question): array => [
                'question_id' => $question['id'],
                'answer_id' => $correctAnswers[$question['id']],
            ])
            ->values()
            ->all();

        $submitResponse = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", [
                'session_id' => $startPayload['session_id'],
                'student_id' => 'applicant-1001',
                'first_name' => 'Aruzhan',
                'last_name' => 'Sarsenova',
                'email' => 'aruzhan@example.test',
                'phone' => '+77001234567',
                'answers' => $answers,
            ]);

        $submitResponse
            ->assertOk()
            ->assertJsonPath('correct_answers', 2)
            ->assertJsonPath('total_questions', 2)
            ->assertJsonPath('status', 'Passed');

        $this->assertDatabaseHas('language_testing_results', [
            'language_testing_test_id' => $test->id,
            'student_id' => 'applicant-1001',
            'email' => 'aruzhan@example.test',
            'status' => LanguageTestingResult::STATUS_PASSED,
        ]);
    }

    public function test_submit_requires_expected_payload_shape(): void
    {
        config()->set('language_testing_module.integration.api_key', 'integration-test-key');

        $test = LanguageTestingTest::query()->create([
            'name' => 'Validation Test',
            'language' => 'english',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
        ]);

        $response = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", []);

        $response
            ->assertStatus(422)
            ->assertJsonPath('message', 'The given data was invalid.')
            ->assertJsonValidationErrors(['session_id', 'first_name', 'last_name', 'email', 'answers'])
            ->assertHeader('X-Request-ID');
    }

    public function test_duplicate_submit_with_same_payload_is_idempotent(): void
    {
        config()->set('language_testing_module.integration.api_key', 'integration-test-key');

        [$test, $correctAnswers] = $this->createTestWithQuestions([
            'name' => 'Idempotent Submit Test',
            'total_questions' => 2,
        ]);

        $startPayload = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->getJson("/api/v1/tests/{$test->id}/start")
            ->assertOk()
            ->json();

        $answers = collect($startPayload['questions'])
            ->map(fn (array $question): array => [
                'question_id' => $question['id'],
                'answer_id' => $correctAnswers[$question['id']],
            ])
            ->values()
            ->all();

        $payload = [
            'session_id' => $startPayload['session_id'],
            'student_id' => 'duplicate-check-001',
            'first_name' => 'Dana',
            'last_name' => 'Aitbayeva',
            'email' => 'dana@example.test',
            'answers' => $answers,
        ];

        $firstResponse = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", $payload)
            ->assertOk();

        $secondResponse = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", $payload)
            ->assertOk();

        $firstPayload = $firstResponse->json();
        $secondPayload = $secondResponse->json();

        if (($firstPayload['result_id'] ?? null) !== ($secondPayload['result_id'] ?? null)) {
            throw new \RuntimeException('Idempotent resubmission returned a different result_id.');
        }
        $this->assertDatabaseCount('language_testing_results', 1);
    }

    public function test_duplicate_submit_with_different_payload_returns_conflict(): void
    {
        config()->set('language_testing_module.integration.api_key', 'integration-test-key');

        $fixture = $this->createTestWithQuestions([
            'name' => 'Conflict Submit Test',
            'total_questions' => 2,
        ], 3, true);
        $test = $fixture[0];
        $correctAnswers = $fixture[1];
        $wrongAnswers = $fixture[2];

        $startPayload = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->getJson("/api/v1/tests/{$test->id}/start")
            ->assertOk()
            ->json();

        $goodAnswers = collect($startPayload['questions'])
            ->map(fn (array $question): array => [
                'question_id' => $question['id'],
                'answer_id' => $correctAnswers[$question['id']],
            ])
            ->values()
            ->all();

        $badAnswers = collect($startPayload['questions'])
            ->map(fn (array $question): array => [
                'question_id' => $question['id'],
                'answer_id' => $wrongAnswers[$question['id']],
            ])
            ->values()
            ->all();

        $basePayload = [
            'session_id' => $startPayload['session_id'],
            'student_id' => 'duplicate-check-002',
            'first_name' => 'Aigerim',
            'last_name' => 'Serik',
            'email' => 'aigerim@example.test',
        ];

        $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", $basePayload + ['answers' => $goodAnswers])
            ->assertOk();

        $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", $basePayload + ['answers' => $badAnswers])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Session has already been submitted.');
    }

    public function test_expired_session_is_rejected(): void
    {
        config()->set('language_testing_module.integration.api_key', 'integration-test-key');
        config()->set('language_testing_module.integration.session_ttl_minutes', 1);

        [$test, $correctAnswers] = $this->createTestWithQuestions([
            'name' => 'Expired Session Test',
            'total_questions' => 2,
        ]);

        $startPayload = $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->getJson("/api/v1/tests/{$test->id}/start")
            ->assertOk()
            ->json();

        LanguageTestingSession::query()
            ->where('public_session_id', $startPayload['session_id'])
            ->update(['started_at' => now()->subMinutes(5)]);

        $answers = collect($startPayload['questions'])
            ->map(fn (array $question): array => [
                'question_id' => $question['id'],
                'answer_id' => $correctAnswers[$question['id']],
            ])
            ->values()
            ->all();

        $this->withHeaders(['X-API-KEY' => 'integration-test-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", [
                'session_id' => $startPayload['session_id'],
                'first_name' => 'Expired',
                'last_name' => 'Candidate',
                'email' => 'expired@example.test',
                'answers' => $answers,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['session_id']);

        $this->assertDatabaseHas('language_testing_sessions', [
            'public_session_id' => $startPayload['session_id'],
            'status' => LanguageTestingSession::STATUS_EXPIRED,
        ]);
    }

    public function test_integration_rate_limit_returns_429(): void
    {
        config()->set('language_testing_module.integration.api_key', 'rate-limit-key');
        config()->set('language_testing_module.integration.rate_limit_per_minute', 2);
        config()->set('language_testing_module.integration.rate_limit_per_minute_per_ip', 2);

        LanguageTestingTest::query()->create([
            'name' => 'Rate Limited Test',
            'language' => 'english',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
        ]);

        $headers = ['X-API-KEY' => 'rate-limit-key'];
        $server = ['REMOTE_ADDR' => '127.0.0.77'];

        $this->withHeaders($headers)->withServerVariables($server)->getJson('/api/v1/tests')->assertOk();
        $this->withHeaders($headers)->withServerVariables($server)->getJson('/api/v1/tests')->assertOk();
        $this->withHeaders($headers)->withServerVariables($server)->getJson('/api/v1/tests')
            ->assertStatus(429)
            ->assertJsonPath('message', 'Too many requests.');
    }

    /**
     * @return array{0: LanguageTestingTest, 1: array<int, int>, 2?: array<int, int>}
     */
    private function createTestWithQuestions(array $overrides = [], int $questionCount = 3, bool $includeWrongAnswers = false): array
    {
        $test = LanguageTestingTest::query()->create(array_merge([
            'name' => 'Generated Test ' . str()->uuid(),
            'language' => 'english',
            'description' => 'Generated for feature testing.',
            'passing_score' => 50,
            'total_questions' => min($questionCount, 2),
            'status' => 'active',
        ], $overrides));

        $correctAnswers = [];
        $wrongAnswers = [];

        foreach (range(1, $questionCount) as $index) {
            $question = $test->questions()->create([
                'question' => 'Generated Question ' . $index,
                'question_type' => 'single_choice',
                'points' => 5,
                'sort_order' => $index,
            ]);

            $correct = $question->answers()->create([
                'answer' => 'Correct ' . $index,
                'is_correct' => true,
                'sort_order' => 1,
            ]);

            $wrong = $question->answers()->create([
                'answer' => 'Wrong ' . $index,
                'is_correct' => false,
                'sort_order' => 2,
            ]);

            $correctAnswers[$question->id] = $correct->id;
            $wrongAnswers[$question->id] = $wrong->id;
        }

        if ($includeWrongAnswers) {
            return [$test, $correctAnswers, $wrongAnswers];
        }

        return [$test, $correctAnswers];
    }
}

<?php

namespace Tests\Feature\LanguageTestingModule;

use App\Modules\LanguageTestingModule\Models\LanguageTestingQuestion;
use App\Modules\LanguageTestingModule\Models\LanguageTestingResult;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LanguageTestingIntegrationApiTest extends TestCase
{
    use RefreshDatabase;

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

        $startResponse->assertOk();
        $startPayload = $startResponse->json();

        $this->assertNotEmpty($startPayload['session_id'] ?? null);
        $this->assertSame($test->id, $startPayload['test_id'] ?? null);
        $this->assertCount(2, $startPayload['questions'] ?? []);
        $this->assertArrayNotHasKey('correct_answer_id', $startPayload['questions'][0]);

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
}
<?php

namespace Tests\Feature\LanguageTestingModule;

use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LanguageTestingIntegrationApiContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_contract_is_machine_readable(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'status',
                    'api_version',
                    'database',
                    'queue',
                    'storage',
                    'language_testing_module',
                    'timestamp',
                ],
                'request_id',
            ]);
    }

    public function test_list_contract_matches_public_shape(): void
    {
        config()->set('language_testing_module.integration.api_key', 'contract-key');

        LanguageTestingTest::query()->create([
            'name' => 'Contract Test',
            'language' => 'english',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
        ]);

        $this->withHeaders(['X-API-KEY' => 'contract-key'])
            ->getJson('/api/v1/tests')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'language',
                        'language_label',
                        'description',
                        'passing_score',
                        'total_questions',
                        'questions_count',
                        'status',
                        'status_label',
                        'created_at',
                        'updated_at',
                    ],
                ],
                'meta' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total',
                ],
                'request_id',
            ]);
    }

    public function test_unauthorized_contract_matches_public_shape(): void
    {
        $this->getJson('/api/v1/tests')
            ->assertStatus(401)
            ->assertJsonStructure([
                'message',
                'errors' => ['authorization'],
                'request_id',
            ]);
    }

    public function test_validation_error_contract_matches_public_shape(): void
    {
        config()->set('language_testing_module.integration.api_key', 'contract-key');

        $test = LanguageTestingTest::query()->create([
            'name' => 'Contract Validation Test',
            'language' => 'english',
            'description' => null,
            'passing_score' => 60,
            'total_questions' => 20,
            'status' => 'active',
        ]);

        $this->withHeaders(['X-API-KEY' => 'contract-key'])
            ->postJson("/api/v1/tests/{$test->id}/submit", ['session_id' => 'not-a-uuid'])
            ->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors',
                'request_id',
            ]);
    }
}

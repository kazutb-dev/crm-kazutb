<?php

namespace Tests\Unit;

use App\Models\AcademicYear;
use App\Models\AppSetting;
use App\Models\Department;
use App\Models\Diploma;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use App\Services\TopicSimilarityService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class TopicSimilarityServiceTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.topic_ai.enabled', false);

        AppSetting::query()->updateOrCreate(
            ['key' => 'topic_normalization_stop_words'],
            ['value' => ['и', 'в', 'на', 'для', 'по', 'к', 'из', 'о', 'об', 'а', 'the', 'of', 'for', 'to', 'in']],
        );
    }

    public function test_normalize_applies_rules_and_stop_words(): void
    {
        $service = app(TopicSimilarityService::class);

        $normalized = $service->normalize('  Анализ, И оптимизация Ёмкости в THE сети!!! ');

        $this->assertSame('анализ оптимизация емкости сети', $normalized);
    }

    public function test_find_top_matches_returns_exact_and_similar_results(): void
    {
        $service = app(TopicSimilarityService::class);

        [$faculty, $department, $program] = $this->createCatalog();

        Diploma::query()->create([
            'year' => 2024,
            'semester' => 'spring',
            'faculty_id' => $faculty->id,
            'department_id' => $department->id,
            'program_id' => $program->id,
            'title_ru' => 'Анализ систем управления данными',
            'normalized_title' => $service->normalize('Анализ систем управления данными'),
            'type' => Diploma::TYPE_DIPLOMA,
            'status' => Diploma::STATUS_APPROVED,
            'is_reference' => true,
        ]);

        Diploma::query()->create([
            'year' => 2023,
            'semester' => 'fall',
            'faculty_id' => $faculty->id,
            'department_id' => $department->id,
            'program_id' => $program->id,
            'title_ru' => 'Анализ систем данных для мониторинга',
            'normalized_title' => $service->normalize('Анализ систем данных для мониторинга'),
            'type' => Diploma::TYPE_DIPLOMA,
            'status' => Diploma::STATUS_ARCHIVED,
            'is_reference' => true,
        ]);

        $result = $service->findTopMatches('Анализ систем управления данными');

        $this->assertSame('анализ систем управления данными', $result['normalized']);
        $this->assertNotEmpty($result['items']);
        $this->assertSame('exact', $result['items'][0]['match_type']);
        $this->assertSame(1.0, $result['items'][0]['score']);

        $similar = collect($result['items'])->first(
            fn (array $item): bool => in_array($item['match_type'], ['similar', 'ai_similar'], true),
        );
        $this->assertNotNull($similar);
        $this->assertGreaterThan(0.0, $similar['score']);
    }

    public function test_find_top_matches_detects_close_non_exact_titles(): void
    {
        $service = app(TopicSimilarityService::class);

        [$faculty, $department, $program] = $this->createCatalog();

        Diploma::query()->create([
            'year' => 2025,
            'semester' => 'spring',
            'faculty_id' => $faculty->id,
            'department_id' => $department->id,
            'program_id' => $program->id,
            'title_ru' => 'Интеллектуальная система анализа учебных данных',
            'normalized_title' => $service->normalize('Интеллектуальная система анализа учебных данных'),
            'type' => Diploma::TYPE_DIPLOMA,
            'status' => Diploma::STATUS_APPROVED,
            'is_reference' => true,
        ]);

        $result = $service->findTopMatches('Система интеллектуального анализа учебных данных', null, 10);

        $this->assertNotEmpty($result['items']);

        $first = $result['items'][0];

        $this->assertContains($first['match_type'], ['similar', 'ai_similar']);
        $this->assertGreaterThanOrEqual(0.70, $first['score']);
    }

    public function test_risk_thresholds_are_applied(): void
    {
        $service = app(TopicSimilarityService::class);

        $this->assertSame('high', $service->riskByScore(0.85));
        $this->assertSame('medium', $service->riskByScore(0.70));
        $this->assertSame('low', $service->riskByScore(0.69));
    }

    public function test_stemming_improves_similarity_for_inflected_words(): void
    {
        $service = app(TopicSimilarityService::class);

        [$faculty, $department, $program] = $this->createCatalog();

        Diploma::query()->create([
            'year' => 2025,
            'semester' => 'fall',
            'faculty_id' => $faculty->id,
            'department_id' => $department->id,
            'program_id' => $program->id,
            'title_ru' => 'Разработка интеллектуальных систем прогнозирования',
            'normalized_title' => $service->normalize('Разработка интеллектуальных систем прогнозирования'),
            'type' => Diploma::TYPE_DIPLOMA,
            'status' => Diploma::STATUS_APPROVED,
            'is_reference' => true,
        ]);

        $result = $service->findTopMatches('Разработки интеллектуальной системы прогнозирований', null, 10);

        $this->assertNotEmpty($result['items']);
        $this->assertGreaterThanOrEqual(0.70, $result['items'][0]['score']);
    }

    public function test_ai_combination_can_raise_semantic_similarity_score(): void
    {
        $service = app(TopicSimilarityService::class);

        $combined = $service->combineHeuristicAndAiScore(0.52, 0.86);

        $this->assertGreaterThan(0.70, $combined);
    }

    public function test_exact_duplicate_in_draft_status_is_detected(): void
    {
        $service = app(TopicSimilarityService::class);
        $uniqueTitle = 'Тестовый уникальный дубль темы 2026 03 05 контроль';

        [$faculty, $department, $program] = $this->createCatalog();

        $existing = Diploma::query()->create([
            'year' => 2026,
            'semester' => 'spring',
            'faculty_id' => $faculty->id,
            'department_id' => $department->id,
            'program_id' => $program->id,
            'title_ru' => $uniqueTitle,
            'normalized_title' => $service->normalize($uniqueTitle),
            'type' => Diploma::TYPE_DIPLOMA,
            'status' => Diploma::STATUS_DRAFT,
            'is_reference' => false,
        ]);

        $result = $service->findTopMatches(
            $uniqueTitle,
            null,
            10,
        );

        $this->assertNotEmpty($result['items']);
        $this->assertSame('exact', $result['items'][0]['match_type']);
        $this->assertSame(1.0, $result['items'][0]['score']);
        $this->assertSame($existing->id, $result['items'][0]['diploma_id']);
    }

    /**
     * @return array{Faculty,Department,EducationalProgram}
     */
    private function createCatalog(): array
    {
        $faculty = Faculty::query()->create([
            'name' => 'Факультет тестов',
            'code' => 'FT',
        ]);

        $department = Department::query()->create([
            'faculty_id' => $faculty->id,
            'name' => 'Кафедра тестирования',
            'code' => 'KT',
        ]);

        $year = AcademicYear::query()->create([
            'name' => '2024/2025',
            'start_year' => 2024,
            'end_year' => 2025,
            'is_active' => true,
        ]);

        $program = EducationalProgram::query()->create([
            'name' => 'Тестовая программа',
            'code' => 'TPR',
            'degree' => 'bachelor',
            'department_id' => $department->id,
            'academic_year_id' => $year->id,
        ]);

        return [$faculty, $department, $program];
    }
}

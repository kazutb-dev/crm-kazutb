<?php

namespace Tests\Unit\TeacherAi;

use App\Services\TeacherAi\TeacherAiReviewException;
use App\Services\TeacherAi\TeacherAiReviewService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TeacherAiReviewServiceTest extends TestCase
{
    private const ENDPOINT = 'https://ai.test/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.teacher_ai', [
            'enabled' => true,
            'endpoint' => self::ENDPOINT,
            'model' => 'gpt-4o-mini',
            'api_key' => 'teacher-key',
            'timeout' => 5,
            'max_chars' => 1000,
            'daily_limit' => 20,
        ]);
        config()->set('services.openai.api_key', 'openai-key');
    }

    public function test_analyze_sends_document_and_normalizes_the_answer(): void
    {
        Http::fake([
            self::ENDPOINT => Http::response($this->completion([
                'summary' => '  Силлабус курса «Базы данных».  ',
                'key_points' => ['5 кредитов', '', 15],
                'findings' => [
                    ['severity' => 'minor', 'category' => 'Литература', 'quote' => 'Иванов, 2001', 'issue' => 'Устаревший источник', 'suggestion' => 'Добавьте издания после 2015 года'],
                    ['severity' => 'CRITICAL', 'category' => 'Оценивание', 'quote' => '', 'issue' => 'Сумма весов 110%', 'suggestion' => 'Приведите сумму к 100%'],
                    ['severity' => 'urgent', 'issue' => 'Неизвестная важность'],
                    ['severity' => 'major', 'issue' => ''],
                    'not-an-object',
                ],
                'overall' => 'Нужна доработка оценивания.',
            ])),
        ]);

        $result = (new TeacherAiReviewService())->analyze('syllabus', 'Текст силлабуса', 'Проверь оценивание', false);

        $this->assertSame('Силлабус курса «Базы данных».', $result['summary']);
        $this->assertSame(['5 кредитов', '15'], $result['key_points']);
        $this->assertSame(['critical', 'minor', 'minor'], array_column($result['findings'], 'severity'));
        $this->assertSame('Сумма весов 110%', $result['findings'][0]['issue']);
        $this->assertSame('', $result['findings'][2]['category']);
        $this->assertSame('Нужна доработка оценивания.', $result['overall']);
        $this->assertSame(1200, $result['prompt_tokens']);
        $this->assertSame(300, $result['completion_tokens']);

        Http::assertSent(function (Request $request): bool {
            $userMessage = $request['messages'][1]['content'];

            return $request->hasHeader('Authorization', 'Bearer teacher-key')
                && $request['model'] === 'gpt-4o-mini'
                && $request['response_format'] === ['type' => 'json_object']
                && str_contains($request['messages'][0]['content'], 'решение всегда принимает человек')
                && str_contains($userMessage, '"document_type":"Силлабус"')
                && str_contains($userMessage, 'Проверь оценивание')
                && str_contains($userMessage, "<<<\nТекст силлабуса\n>>>");
        });
    }

    public function test_falls_back_to_the_shared_openai_key(): void
    {
        config()->set('services.teacher_ai.api_key', '');
        Http::fake([self::ENDPOINT => Http::response($this->completion(['summary' => 'Кратко', 'findings' => []]))]);

        $service = new TeacherAiReviewService();
        $this->assertTrue($service->isEnabled());

        $service->analyze('other', 'Текст', null, false);

        Http::assertSent(fn (Request $request): bool => $request->hasHeader('Authorization', 'Bearer openai-key'));
    }

    public function test_is_disabled_without_any_key(): void
    {
        config()->set('services.teacher_ai.api_key', '');
        config()->set('services.openai.api_key', null);

        $service = new TeacherAiReviewService();

        $this->assertFalse($service->isEnabled());
        $this->expectException(TeacherAiReviewException::class);

        $service->analyze('syllabus', 'Текст', null, false);
    }

    public function test_reports_service_errors_with_a_readable_message(): void
    {
        Http::fake([self::ENDPOINT => Http::response(['error' => ['message' => 'Rate limit']], 429)]);

        $this->expectException(TeacherAiReviewException::class);
        $this->expectExceptionMessage('ИИ-сервис временно недоступен');

        (new TeacherAiReviewService())->analyze('syllabus', 'Текст', null, false);
    }

    public function test_rejects_answers_that_are_not_json(): void
    {
        Http::fake([self::ENDPOINT => Http::response([
            'choices' => [['message' => ['content' => 'Вот мой ответ без JSON']]],
        ])]);

        $this->expectException(TeacherAiReviewException::class);
        $this->expectExceptionMessage('неожиданном формате');

        (new TeacherAiReviewService())->analyze('syllabus', 'Текст', null, false);
    }

    public function test_rejects_empty_answers(): void
    {
        Http::fake([self::ENDPOINT => Http::response($this->completion(['summary' => '', 'findings' => []]))]);

        $this->expectException(TeacherAiReviewException::class);
        $this->expectExceptionMessage('пустой ответ');

        (new TeacherAiReviewService())->analyze('syllabus', 'Текст', null, false);
    }

    public function test_prepare_text_masks_national_ids_and_truncates(): void
    {
        $service = new TeacherAiReviewService();

        $masked = $service->prepareText('ИИН 950101300123, телефон 87011234567, код 1234567890123');
        $this->assertSame('ИИН [ИИН скрыт], телефон 87011234567, код 1234567890123', $masked['text']);
        $this->assertFalse($masked['truncated']);

        $long = $service->prepareText(str_repeat('я', 1500));
        $this->assertTrue($long['truncated']);
        $this->assertSame(1500, $long['chars']);
        $this->assertSame(1000, mb_strlen($long['text']));
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function completion(array $payload): array
    {
        return [
            'model' => 'gpt-4o-mini-2024-07-18',
            'choices' => [['message' => ['content' => json_encode($payload, JSON_UNESCAPED_UNICODE)]]],
            'usage' => ['prompt_tokens' => 1200, 'completion_tokens' => 300],
        ];
    }
}

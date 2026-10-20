<?php

namespace Tests\Unit\TeacherAi;

use App\Services\TeacherAi\TeacherAiChatClient;
use App\Services\TeacherAi\TeacherAiException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TeacherAiChatClientTest extends TestCase
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
            'lesson_timeout' => 5,
            'lesson_model' => null,
            'lesson_retry_sleep_ms' => 0,
        ]);
        config()->set('services.openai.api_key', 'openai-key');
    }

    public function test_complete_json_parses_a_successful_answer(): void
    {
        Http::fake([self::ENDPOINT => Http::response($this->completion(['title' => 'Нормализация', 'items' => [1, 2]]))]);

        $result = (new TeacherAiChatClient)->completeJson('Системный промпт JSON', 'Запрос JSON');

        $this->assertSame(['title' => 'Нормализация', 'items' => [1, 2]], $result['data']);
        $this->assertSame('gpt-4o-mini-2024-07-18', $result['model']);
        $this->assertSame(1200, $result['prompt_tokens']);
        $this->assertSame(300, $result['completion_tokens']);

        Http::assertSentCount(1);
        Http::assertSent(function (Request $request): bool {
            return $request->url() === self::ENDPOINT
                && $request->hasHeader('Authorization', 'Bearer teacher-key')
                && $request['model'] === 'gpt-4o-mini'
                && $request['temperature'] === 0.4
                && $request['max_tokens'] === 4000
                && $request['response_format'] === ['type' => 'json_object']
                && $request['messages'] === [
                    ['role' => 'system', 'content' => 'Системный промпт JSON'],
                    ['role' => 'user', 'content' => 'Запрос JSON'],
                ]
                && ! str_contains($request->body(), 'teacher-key');
        });
    }

    public function test_options_and_lesson_model_override_the_defaults(): void
    {
        config()->set('services.teacher_ai.lesson_model', 'gpt-4.1');
        Http::fake([self::ENDPOINT => Http::response($this->completion(['ok' => true]))]);

        $client = new TeacherAiChatClient;
        $this->assertSame('gpt-4.1', $client->model());

        $client->completeJson('s', 'u', ['temperature' => 0.7, 'max_tokens' => 1234]);

        Http::assertSent(fn (Request $request): bool => $request['model'] === 'gpt-4.1'
            && $request['temperature'] === 0.7
            && $request['max_tokens'] === 1234);
    }

    public function test_model_and_timeout_fall_back_to_safe_defaults(): void
    {
        config()->set('services.teacher_ai.lesson_model', '');
        config()->set('services.teacher_ai.model', null);
        config()->set('services.teacher_ai.lesson_timeout', 2);

        $client = new TeacherAiChatClient;

        $this->assertSame('gpt-4o-mini', $client->model());
        $this->assertSame(10, $client->timeout());

        config()->set('services.teacher_ai.lesson_timeout', 60);
        $this->assertSame(60, $client->timeout());
    }

    public function test_tokens_are_null_when_usage_is_missing_and_model_falls_back_to_config(): void
    {
        Http::fake([self::ENDPOINT => Http::response([
            'choices' => [['message' => ['content' => '{"a":1}']]],
        ])]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'u');

        $this->assertSame(['a' => 1], $result['data']);
        $this->assertSame('gpt-4o-mini', $result['model']);
        $this->assertNull($result['prompt_tokens']);
        $this->assertNull($result['completion_tokens']);
    }

    public function test_strips_json_code_fences_from_the_content(): void
    {
        Http::fake([self::ENDPOINT => Http::response([
            'choices' => [['message' => ['content' => "```json\n{\"title\": \"Лекция\"}\n```"]]],
        ])]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'u');

        $this->assertSame(['title' => 'Лекция'], $result['data']);
        Http::assertSentCount(1);
    }

    public function test_extracts_the_object_when_text_surrounds_it(): void
    {
        Http::fake([self::ENDPOINT => Http::response([
            'choices' => [['message' => ['content' => "Вот ответ:\n{\"title\": \"Лекция\", \"n\": {\"x\": 1}}\nНадеюсь, помог."]]],
        ])]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'u');

        $this->assertSame(['title' => 'Лекция', 'n' => ['x' => 1]], $result['data']);
    }

    public function test_falls_back_to_the_shared_openai_key(): void
    {
        config()->set('services.teacher_ai.api_key', '');
        Http::fake([self::ENDPOINT => Http::response($this->completion(['ok' => true]))]);

        $client = new TeacherAiChatClient;
        $this->assertTrue($client->isEnabled());

        $client->completeJson('s', 'u');

        Http::assertSent(fn (Request $request): bool => $request->hasHeader('Authorization', 'Bearer openai-key'));
    }

    public function test_throws_when_disabled_without_sending_anything(): void
    {
        config()->set('services.teacher_ai.enabled', false);
        Http::fake();

        $client = new TeacherAiChatClient;
        $this->assertFalse($client->isEnabled());

        try {
            $client->completeJson('s', 'u');
            $this->fail('Expected TeacherAiException');
        } catch (TeacherAiException $e) {
            $this->assertSame('AI-ассистент сейчас отключён. Обратитесь к администратору.', $e->getMessage());
        }

        Http::assertNothingSent();
    }

    public function test_is_disabled_without_any_key(): void
    {
        config()->set('services.teacher_ai.api_key', '  ');
        config()->set('services.openai.api_key', null);

        $this->assertFalse((new TeacherAiChatClient)->isEnabled());
    }

    // ------------------------------------------------------------------
    // Retry matrix
    // ------------------------------------------------------------------

    public function test_retries_once_after_429(): void
    {
        $this->fakeSequence([
            Http::response(['error' => ['message' => 'Rate limit']], 429),
            Http::response($this->completion(['ok' => true])),
        ]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'u');

        $this->assertSame(['ok' => true], $result['data']);
        Http::assertSentCount(2);
    }

    public function test_fails_after_two_5xx_answers(): void
    {
        $this->fakeSequence([
            Http::response('upstream error', 502),
            Http::response('upstream error', 500),
        ]);

        $this->assertFailsWith('ИИ-сервис временно недоступен. Попробуйте ещё раз позже.');
        Http::assertSentCount(2);
    }

    public function test_rejects_other_4xx_answers_immediately(): void
    {
        $this->fakeSequence([
            Http::response(['error' => ['message' => 'invalid model']], 400),
            Http::response($this->completion(['ok' => true])),
        ]);

        $this->assertFailsWith('ИИ-сервис отклонил запрос. Обратитесь к администратору.');
        Http::assertSentCount(1);
    }

    public function test_unauthorized_answer_is_not_retried(): void
    {
        $this->fakeSequence([Http::response('', 401)]);

        $this->assertFailsWith('ИИ-сервис отклонил запрос. Обратитесь к администратору.');
        Http::assertSentCount(1);
    }

    public function test_retries_non_json_answer_with_the_strict_hint(): void
    {
        $this->fakeSequence([
            Http::response(['choices' => [['message' => ['content' => 'Вот мой ответ без JSON']]]]),
            Http::response($this->completion(['ok' => true])),
        ]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'Запрос');

        $this->assertSame(['ok' => true], $result['data']);
        Http::assertSentCount(2);

        $contents = $this->sentUserMessages();
        $this->assertSame('Запрос', $contents[0]);
        $this->assertSame("Запрос\n\nВАЖНО: верни только валидный JSON-объект без markdown и пояснений.", $contents[1]);
    }

    public function test_fails_after_two_non_json_answers(): void
    {
        $this->fakeSequence([
            Http::response(['choices' => [['message' => ['content' => 'нет']]]]),
            Http::response(['choices' => [['message' => ['content' => '["list", "not", "object"]']]]]),
        ]);

        $this->assertFailsWith('ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.');
        Http::assertSentCount(2);
    }

    public function test_retries_truncated_answer_with_the_shorten_hint(): void
    {
        $this->fakeSequence([
            Http::response([
                'choices' => [['message' => ['content' => '{"title": "Очень длинный'], 'finish_reason' => 'length']],
            ]),
            Http::response($this->completion(['ok' => true])),
        ]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'Запрос');

        $this->assertSame(['ok' => true], $result['data']);
        Http::assertSentCount(2);

        $contents = $this->sentUserMessages();
        $this->assertSame("Запрос\n\nОтвет был обрезан. Сократи текст примерно на треть, сохранив структуру JSON.", $contents[1]);
    }

    public function test_fails_after_two_truncated_answers(): void
    {
        $truncated = Http::response([
            'choices' => [['message' => ['content' => '{"title": "Очень'], 'finish_reason' => 'length']],
        ]);
        $this->fakeSequence([$truncated, $truncated]);

        $this->assertFailsWith('ИИ вернул слишком длинный ответ. Попробуйте ещё раз.');
        Http::assertSentCount(2);
    }

    public function test_retries_once_after_a_connection_failure(): void
    {
        $this->fakeSequence([
            Http::failedConnection('cURL error 28: Operation timed out'),
            Http::response($this->completion(['ok' => true])),
        ]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'u');

        $this->assertSame(['ok' => true], $result['data']);
        Http::assertSentCount(2);
    }

    public function test_fails_after_two_connection_failures(): void
    {
        $this->fakeSequence([
            Http::failedConnection(),
            Http::failedConnection(),
        ]);

        $this->assertFailsWith('ИИ-сервис не ответил вовремя. Попробуйте ещё раз позже.');
        Http::assertSentCount(2);
    }

    public function test_each_failure_kind_is_retried_once_within_one_call(): void
    {
        // 429 → bad JSON → connection → truncated → success: four different kinds, one retry each.
        $this->fakeSequence([
            Http::response('', 429),
            Http::response(['choices' => [['message' => ['content' => 'нет']]]]),
            Http::failedConnection(),
            Http::response(['choices' => [['message' => ['content' => '{"a'], 'finish_reason' => 'length']]]),
            Http::response($this->completion(['ok' => true])),
        ]);

        $result = (new TeacherAiChatClient)->completeJson('s', 'Запрос');

        $this->assertSame(['ok' => true], $result['data']);
        Http::assertSentCount(5);

        $contents = $this->sentUserMessages();
        $this->assertStringContainsString('ВАЖНО: верни только валидный JSON-объект', $contents[4]);
        $this->assertStringContainsString('Ответ был обрезан', $contents[4]);
    }

    public function test_same_failure_kind_twice_fails_even_when_other_kinds_were_retried(): void
    {
        $this->fakeSequence([
            Http::response('', 503),
            Http::failedConnection(),
            Http::response('', 500),
            Http::response($this->completion(['ok' => true])),
        ]);

        $this->assertFailsWith('ИИ-сервис временно недоступен. Попробуйте ещё раз позже.');
        Http::assertSentCount(3);
    }

    public function test_retry_can_be_disabled(): void
    {
        $this->fakeSequence([
            Http::response('', 429),
            Http::response($this->completion(['ok' => true])),
        ]);

        $this->assertFailsWith('ИИ-сервис временно недоступен. Попробуйте ещё раз позже.', ['retry' => false]);
        Http::assertSentCount(1);
    }

    // ------------------------------------------------------------------
    // Pool
    // ------------------------------------------------------------------

    public function test_pool_returns_results_and_exceptions_by_key_without_retrying(): void
    {
        Http::fake(function (Request $request) {
            $user = $request['messages'][1]['content'];

            return match (true) {
                str_contains($user, 'alpha') => Http::response($this->completion(['n' => 1])),
                str_contains($user, 'beta') => Http::response('', 500),
                str_contains($user, 'gamma') => Http::failedConnection(),
                str_contains($user, 'delta') => Http::response(['choices' => [['message' => ['content' => 'нет']]]]),
                str_contains($user, 'epsilon') => Http::response('', 400),
                default => Http::response(['choices' => [['message' => ['content' => '{"a'], 'finish_reason' => 'length']]]),
            };
        });

        $results = (new TeacherAiChatClient)->completeJsonPool([
            'a' => ['system' => 's', 'user' => 'alpha', 'options' => ['temperature' => 0.5, 'max_tokens' => 3000]],
            'b' => ['system' => 's', 'user' => 'beta'],
            'c' => ['system' => 's', 'user' => 'gamma'],
            'd' => ['system' => 's', 'user' => 'delta'],
            'e' => ['system' => 's', 'user' => 'epsilon'],
            7 => ['system' => 's', 'user' => 'zeta'],
        ]);

        $this->assertSame(['a', 'b', 'c', 'd', 'e', 7], array_keys($results));
        $this->assertSame(['n' => 1], $results['a']['data']);
        $this->assertSame(1200, $results['a']['prompt_tokens']);

        $this->assertInstanceOf(TeacherAiException::class, $results['b']);
        $this->assertSame('ИИ-сервис временно недоступен. Попробуйте ещё раз позже.', $results['b']->getMessage());

        $this->assertInstanceOf(TeacherAiException::class, $results['c']);
        $this->assertSame('ИИ-сервис не ответил вовремя. Попробуйте ещё раз позже.', $results['c']->getMessage());

        $this->assertInstanceOf(TeacherAiException::class, $results['d']);
        $this->assertSame('ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.', $results['d']->getMessage());

        $this->assertInstanceOf(TeacherAiException::class, $results['e']);
        $this->assertSame('ИИ-сервис временно недоступен. Попробуйте ещё раз позже.', $results['e']->getMessage());

        $this->assertInstanceOf(TeacherAiException::class, $results[7]);
        $this->assertSame('ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.', $results[7]->getMessage());

        // Five, not six: the HTTP fake does not record a pooled request whose connection failed.
        Http::assertSentCount(5);
        Http::assertSent(fn (Request $request): bool => $request['messages'][1]['content'] === 'alpha'
            && $request['temperature'] === 0.5
            && $request['max_tokens'] === 3000
            && $request->hasHeader('Authorization', 'Bearer teacher-key')
            && ! str_contains($request->body(), 'teacher-key'));
    }

    public function test_pool_with_no_requests_sends_nothing(): void
    {
        Http::fake();

        $this->assertSame([], (new TeacherAiChatClient)->completeJsonPool([]));
        Http::assertNothingSent();
    }

    public function test_pool_throws_when_disabled(): void
    {
        config()->set('services.teacher_ai.enabled', false);
        Http::fake();

        $this->expectException(TeacherAiException::class);
        $this->expectExceptionMessage('сейчас отключён');

        (new TeacherAiChatClient)->completeJsonPool(['a' => ['system' => 's', 'user' => 'u']]);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Answers consecutive requests with the given responses in order; the last
     * one is repeated when more requests arrive.
     *
     * @param  list<mixed>  $responses
     */
    private function fakeSequence(array $responses): void
    {
        $calls = 0;

        Http::fake(function () use (&$calls, $responses) {
            $response = $responses[$calls] ?? $responses[array_key_last($responses)];
            $calls++;

            return $response;
        });
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private function assertFailsWith(string $message, array $options = []): void
    {
        try {
            (new TeacherAiChatClient)->completeJson('s', 'u', $options);
            $this->fail('Expected TeacherAiException');
        } catch (TeacherAiException $e) {
            $this->assertSame($message, $e->getMessage());
        }
    }

    /**
     * @return list<string>
     */
    private function sentUserMessages(): array
    {
        return array_map(
            static fn (array $pair): string => $pair[0]['messages'][1]['content'],
            Http::recorded()->all(),
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function completion(array $payload): array
    {
        return [
            'model' => 'gpt-4o-mini-2024-07-18',
            'choices' => [['message' => ['content' => json_encode($payload, JSON_UNESCAPED_UNICODE)], 'finish_reason' => 'stop']],
            'usage' => ['prompt_tokens' => 1200, 'completion_tokens' => 300],
        ];
    }

    public function test_uses_max_completion_tokens_and_temperature_for_openai_chat_models(): void
    {
        config()->set('services.teacher_ai.endpoint', 'https://api.openai.com/v1/chat/completions');
        config()->set('services.teacher_ai.lesson_model', 'gpt-4.1-mini');
        Http::fake(['https://api.openai.com/*' => Http::response($this->completion(['ok' => true]))]);

        (new TeacherAiChatClient)->completeJson('s JSON', 'u JSON', ['temperature' => 0.3, 'max_tokens' => 1000]);

        Http::assertSent(fn (Request $request): bool => $request['model'] === 'gpt-4.1-mini'
            && $request['temperature'] === 0.3
            && $request['max_completion_tokens'] === 1000
            && ! array_key_exists('max_tokens', $request->data())
            && ! array_key_exists('reasoning_effort', $request->data()));
    }

    public function test_reasoning_models_get_no_temperature_and_a_doubled_token_budget(): void
    {
        config()->set('services.teacher_ai.lesson_model', 'gpt-5-mini');
        Http::fake([self::ENDPOINT => Http::response($this->completion(['ok' => true]))]);

        (new TeacherAiChatClient)->completeJson('s JSON', 'u JSON', ['temperature' => 0.3, 'max_tokens' => 1000]);

        Http::assertSent(fn (Request $request): bool => $request['model'] === 'gpt-5-mini'
            && ! array_key_exists('temperature', $request->data())
            && $request['reasoning_effort'] === 'low'
            && $request['max_completion_tokens'] === 2000
            && ! array_key_exists('max_tokens', $request->data()));
    }
}

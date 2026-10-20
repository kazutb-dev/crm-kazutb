<?php

namespace App\Services\TeacherAi;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Infrastructure client for the OpenAI-compatible chat completions API used by
 * the lesson generator. Owns the HTTP calls, the JSON-mode response parsing
 * and the retry policy; knows nothing about lessons or prompts.
 */
final class TeacherAiChatClient
{
    public const MESSAGE_DISABLED = 'AI-ассистент сейчас отключён. Обратитесь к администратору.';

    private const DEFAULT_MODEL = 'gpt-4o-mini';

    private const DEFAULT_TEMPERATURE = 0.4;

    private const DEFAULT_MAX_TOKENS = 4000;

    private const MIN_TIMEOUT = 10;

    private const LOG_BODY_LIMIT = 500;

    /**
     * Failure kinds. completeJson() retries each kind at most once per call.
     */
    private const FAILURE_CONNECTION = 'connection';

    private const FAILURE_UNAVAILABLE = 'unavailable';

    private const FAILURE_REJECTED = 'rejected';

    private const FAILURE_BAD_JSON = 'bad_json';

    private const FAILURE_TRUNCATED = 'truncated';

    /**
     * Teacher-facing message per failure kind once retries are exhausted.
     *
     * @var array<string, string>
     */
    private const FAILURE_MESSAGES = [
        self::FAILURE_CONNECTION => 'ИИ-сервис не ответил вовремя. Попробуйте ещё раз позже.',
        self::FAILURE_UNAVAILABLE => 'ИИ-сервис временно недоступен. Попробуйте ещё раз позже.',
        self::FAILURE_REJECTED => 'ИИ-сервис отклонил запрос. Обратитесь к администратору.',
        self::FAILURE_BAD_JSON => 'ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.',
        self::FAILURE_TRUNCATED => 'ИИ вернул слишком длинный ответ. Попробуйте ещё раз.',
    ];

    /**
     * Pool entries are not retried, so their failures collapse to three
     * messages: connection, any non-success status, unusable content.
     *
     * @var array<string, string>
     */
    private const POOL_FAILURE_KINDS = [
        self::FAILURE_CONNECTION => self::FAILURE_CONNECTION,
        self::FAILURE_UNAVAILABLE => self::FAILURE_UNAVAILABLE,
        self::FAILURE_REJECTED => self::FAILURE_UNAVAILABLE,
        self::FAILURE_BAD_JSON => self::FAILURE_BAD_JSON,
        self::FAILURE_TRUNCATED => self::FAILURE_BAD_JSON,
    ];

    /**
     * Exception codes carried by pool failures so callers can tell a truncated
     * answer from a malformed one (see retryHintFor()).
     */
    public const CODE_CONNECTION = 1;

    public const CODE_UNAVAILABLE = 2;

    public const CODE_REJECTED = 3;

    public const CODE_BAD_JSON = 4;

    public const CODE_TRUNCATED = 5;

    /**
     * @var array<string, int>
     */
    private const FAILURE_CODES = [
        self::FAILURE_CONNECTION => self::CODE_CONNECTION,
        self::FAILURE_UNAVAILABLE => self::CODE_UNAVAILABLE,
        self::FAILURE_REJECTED => self::CODE_REJECTED,
        self::FAILURE_BAD_JSON => self::CODE_BAD_JSON,
        self::FAILURE_TRUNCATED => self::CODE_TRUNCATED,
    ];

    /**
     * Hints appended to the user message before retrying a content failure.
     *
     * @var array<string, string>
     */
    private const RETRY_HINTS = [
        self::FAILURE_BAD_JSON => "\n\nВАЖНО: верни только валидный JSON-объект без markdown и пояснений.",
        self::FAILURE_TRUNCATED => "\n\nОтвет был обрезан. Сократи текст примерно на треть, сохранив структуру JSON.",
    ];

    public function isEnabled(): bool
    {
        return (bool) config('services.teacher_ai.enabled', false) && $this->apiKey() !== '';
    }

    public function model(): string
    {
        $model = config('services.teacher_ai.lesson_model') ?: config('services.teacher_ai.model');

        return is_string($model) && trim($model) !== '' ? trim($model) : self::DEFAULT_MODEL;
    }

    /**
     * Seconds a single HTTP request may take.
     */
    public function timeout(): int
    {
        return max(self::MIN_TIMEOUT, (int) config('services.teacher_ai.lesson_timeout', 90));
    }

    /**
     * One JSON-mode chat completion.
     *
     * Retry policy (unless `retry` is false): every failure kind is retried
     * exactly once — connection problems as is, 429/5xx after a short pause,
     * unusable or truncated content with an extra hint appended to the user
     * message. Other 4xx answers are not retried. Then a TeacherAiException
     * with a teacher-friendly message is thrown.
     *
     * @param  array{temperature?: float, max_tokens?: int, timeout?: int, retry?: bool}  $options
     * @return array{data: array<string, mixed>, model: string, prompt_tokens: int|null, completion_tokens: int|null}
     *
     * @throws TeacherAiException
     */
    public function completeJson(string $systemPrompt, string $userMessage, array $options = []): array
    {
        $this->ensureEnabled();

        $retryAllowed = ($options['retry'] ?? true) !== false;
        $retried = [];
        $message = $userMessage;

        while (true) {
            $failure = null;
            $timeout = $this->timeoutFor($options);
            $startedAt = microtime(true);

            try {
                $response = Http::timeout($timeout)
                    ->withToken($this->apiKey())
                    ->post($this->endpoint(), $this->requestBody($systemPrompt, $message, $options));
            } catch (Throwable $e) {
                $this->logConnectionFailure($e);
                $failure = self::FAILURE_CONNECTION;
            }

            if ($failure === null) {
                $outcome = $this->interpret($response);

                if (isset($outcome['result'])) {
                    return $outcome['result'];
                }

                $failure = $outcome['failure'];
            }

            // A slow attempt (timed out or a long round trip) already spent most of the
            // queue job's budget; repeating it would only get the job killed by the worker.
            if (microtime(true) - $startedAt >= $timeout * 0.5) {
                $retried[$failure] = true;
            }

            $canRetry = $retryAllowed
                && $failure !== self::FAILURE_REJECTED
                && ! isset($retried[$failure]);

            if (! $canRetry) {
                throw new TeacherAiException(self::FAILURE_MESSAGES[$failure]);
            }

            $retried[$failure] = true;

            if ($failure === self::FAILURE_UNAVAILABLE) {
                $this->pauseBeforeRetry();
            }

            if (isset(self::RETRY_HINTS[$failure])) {
                $message .= self::RETRY_HINTS[$failure];
            }
        }
    }

    /**
     * Several completions concurrently via Http::pool. Nothing is retried
     * here; the caller decides what to do with the failed keys.
     *
     * @param  array<array-key, array{system: string, user: string, options?: array{temperature?: float, max_tokens?: int, timeout?: int}}>  $requests
     * @return array<array-key, array{data: array<string, mixed>, model: string, prompt_tokens: int|null, completion_tokens: int|null}|TeacherAiException> same keys as $requests
     *
     * @throws TeacherAiException when the assistant is disabled
     */
    public function completeJsonPool(array $requests): array
    {
        $this->ensureEnabled();

        if ($requests === []) {
            return [];
        }

        $apiKey = $this->apiKey();
        $endpoint = $this->endpoint();

        $responses = Http::pool(function (Pool $pool) use ($requests, $apiKey, $endpoint): void {
            foreach ($requests as $key => $request) {
                $options = $request['options'] ?? [];

                $pool->as((string) $key)
                    ->timeout($this->timeoutFor($options))
                    ->withToken($apiKey)
                    ->post($endpoint, $this->requestBody($request['system'], $request['user'], $options));
            }
        });

        $results = [];

        foreach (array_keys($requests) as $key) {
            // A failed connection comes back as an exception object, not a Response.
            $item = $responses[(string) $key] ?? null;

            if ($item instanceof Response) {
                $outcome = $this->interpret($item);

                $results[$key] = $outcome['result']
                    ?? new TeacherAiException(
                        self::FAILURE_MESSAGES[self::POOL_FAILURE_KINDS[$outcome['failure']]],
                        self::FAILURE_CODES[$outcome['failure']],
                    );

                continue;
            }

            if ($item instanceof Throwable) {
                $this->logConnectionFailure($item);
            } else {
                Log::warning('Teacher AI pool returned no response for a request', ['key' => $key]);
            }

            $results[$key] = new TeacherAiException(self::FAILURE_MESSAGES[self::FAILURE_CONNECTION], self::CODE_CONNECTION);
        }

        return $results;
    }

    /**
     * Text a caller should append to the user message before re-sending a
     * request that failed with the given pool exception ('' when none applies).
     */
    public function retryHintFor(TeacherAiException $exception): string
    {
        return match ($exception->getCode()) {
            self::CODE_TRUNCATED => self::RETRY_HINTS[self::FAILURE_TRUNCATED],
            self::CODE_BAD_JSON => self::RETRY_HINTS[self::FAILURE_BAD_JSON],
            default => '',
        };
    }

    /**
     * @throws TeacherAiException
     */
    private function ensureEnabled(): void
    {
        if (! $this->isEnabled()) {
            throw new TeacherAiException(self::MESSAGE_DISABLED);
        }
    }

    /**
     * Classifies a received HTTP response: either a parsed result or a failure kind.
     *
     * @return array{result?: array{data: array<string, mixed>, model: string, prompt_tokens: int|null, completion_tokens: int|null}, failure?: string}
     */
    private function interpret(Response $response): array
    {
        if (! $response->successful()) {
            Log::warning('Teacher AI lesson request returned non-success status', [
                'status' => $response->status(),
                'body' => mb_substr((string) $response->body(), 0, self::LOG_BODY_LIMIT),
            ]);

            $status = $response->status();

            return ['failure' => $status === 429 || $status >= 500 ? self::FAILURE_UNAVAILABLE : self::FAILURE_REJECTED];
        }

        $json = $response->json();
        $content = (string) data_get($json, 'choices.0.message.content', '');

        // A cut-off answer is almost never valid JSON; the "shorten" hint is
        // the useful retry here, so the length check goes first.
        if (data_get($json, 'choices.0.finish_reason') === 'length') {
            Log::warning('Teacher AI lesson answer was truncated', ['content' => mb_substr($content, 0, self::LOG_BODY_LIMIT)]);

            return ['failure' => self::FAILURE_TRUNCATED];
        }

        $data = $this->decodeJsonObject($content);

        if ($data === null) {
            Log::warning('Teacher AI lesson answer is not a JSON object', ['content' => mb_substr($content, 0, self::LOG_BODY_LIMIT)]);

            return ['failure' => self::FAILURE_BAD_JSON];
        }

        $promptTokens = data_get($json, 'usage.prompt_tokens');
        $completionTokens = data_get($json, 'usage.completion_tokens');

        return ['result' => [
            'data' => $data,
            'model' => (string) (data_get($json, 'model') ?: $this->model()),
            'prompt_tokens' => is_numeric($promptTokens) ? (int) $promptTokens : null,
            'completion_tokens' => is_numeric($completionTokens) ? (int) $completionTokens : null,
        ]];
    }

    /**
     * Decodes the message content as a JSON object, tolerating ```json fences
     * and stray text around the object.
     *
     * @return array<string, mixed>|null
     */
    private function decodeJsonObject(string $content): ?array
    {
        $content = trim($content);

        if (preg_match('/^```[a-zA-Z]*\s*(.*?)\s*```$/su', $content, $matches) === 1) {
            $content = trim($matches[1]);
        }

        $decoded = $this->decodeObject($content);

        if ($decoded !== null) {
            return $decoded;
        }

        $start = strpos($content, '{');
        $end = strrpos($content, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        return $this->decodeObject(substr($content, $start, $end - $start + 1));
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeObject(string $content): ?array
    {
        if (! str_starts_with($content, '{')) {
            return null;
        }

        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param  array{temperature?: float, max_tokens?: int}  $options
     * @return array<string, mixed>
     */
    private function requestBody(string $systemPrompt, string $userMessage, array $options): array
    {
        $model = $this->model();
        $maxTokens = max(1, (int) ($options['max_tokens'] ?? self::DEFAULT_MAX_TOKENS));

        $body = [
            'model' => $model,
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userMessage],
            ],
        ];

        if ($this->isReasoningModel($model)) {
            // Reasoning models (o-series, gpt-5 family) reject a custom temperature and
            // spend part of the completion budget on reasoning tokens.
            $body['reasoning_effort'] = 'low';
            $maxTokens *= 2;
        } else {
            $body['temperature'] = (float) ($options['temperature'] ?? self::DEFAULT_TEMPERATURE);
        }

        // OpenAI deprecated max_tokens in favour of max_completion_tokens (required by
        // reasoning models); other OpenAI-compatible providers still expect max_tokens.
        $body[$this->isOpenAiEndpoint() || $this->isReasoningModel($model) ? 'max_completion_tokens' : 'max_tokens'] = $maxTokens;

        return $body;
    }

    private function isReasoningModel(string $model): bool
    {
        return preg_match('/^(o\d|gpt-5)/i', $model) === 1;
    }

    private function isOpenAiEndpoint(): bool
    {
        $host = parse_url($this->endpoint(), PHP_URL_HOST);

        return is_string($host) && str_ends_with(strtolower($host), 'api.openai.com');
    }

    /**
     * @param  array{timeout?: int}  $options
     */
    private function timeoutFor(array $options): int
    {
        $timeout = (int) ($options['timeout'] ?? 0);

        return $timeout > 0 ? max(self::MIN_TIMEOUT, $timeout) : $this->timeout();
    }

    private function endpoint(): string
    {
        return (string) config('services.teacher_ai.endpoint', 'https://api.openai.com/v1/chat/completions');
    }

    private function apiKey(): string
    {
        $key = config('services.teacher_ai.api_key') ?: config('services.openai.api_key');

        return is_string($key) ? trim($key) : '';
    }

    /**
     * Pause before retrying a 429/5xx answer. Configurable so tests stay fast.
     */
    private function pauseBeforeRetry(): void
    {
        $milliseconds = (int) config('services.teacher_ai.lesson_retry_sleep_ms', 1500);

        if ($milliseconds > 0) {
            usleep($milliseconds * 1000);
        }
    }

    private function logConnectionFailure(Throwable $e): void
    {
        // Exception messages from the HTTP layer never contain the bearer token.
        Log::warning('Teacher AI lesson request failed', [
            'exception' => $e::class,
            'error' => mb_substr($e->getMessage(), 0, self::LOG_BODY_LIMIT),
        ]);
    }
}

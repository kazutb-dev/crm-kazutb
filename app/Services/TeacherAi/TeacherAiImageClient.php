<?php

namespace App\Services\TeacherAi;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Infrastructure client for the OpenAI-compatible images API used to
 * illustrate slides. Knows nothing about lessons: it turns prompts into JPEG
 * bytes, several at a time, and reports failures with a code the caller can
 * act on (a rate limit means "try again a bit later", a rejection does not).
 */
final class TeacherAiImageClient
{
    public const ORIENTATION_PORTRAIT = 'portrait';

    public const ORIENTATION_LANDSCAPE = 'landscape';

    public const CODE_CONNECTION = 1;

    public const CODE_UNAVAILABLE = 2;

    public const CODE_REJECTED = 3;

    public const CODE_BAD_RESPONSE = 4;

    public const CODE_RATE_LIMITED = 6;

    private const DEFAULT_MODEL = 'gpt-image-1.5';

    private const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/images/generations';

    private const JPEG_QUALITY = 84;

    private const LOG_BODY_LIMIT = 500;

    /**
     * Upper bound for one decoded image; protects memory against a broken answer.
     */
    private const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

    public function isEnabled(): bool
    {
        return (bool) config('services.teacher_ai.enabled', false)
            && (bool) config('services.teacher_ai.images_enabled', true)
            && $this->apiKey() !== '';
    }

    public function model(): string
    {
        $model = config('services.teacher_ai.image_model');

        return is_string($model) && trim($model) !== '' ? trim($model) : self::DEFAULT_MODEL;
    }

    public function timeout(): int
    {
        return max(15, (int) config('services.teacher_ai.image_timeout', 90));
    }

    /**
     * Generates several images concurrently. Nothing is retried here.
     *
     * @param  array<array-key, array{prompt: string, orientation?: string}>  $requests
     * @return array<array-key, array{bytes: string, model: string}|TeacherAiException> same keys as $requests
     */
    public function generatePool(array $requests): array
    {
        if ($requests === []) {
            return [];
        }

        if (! $this->isEnabled()) {
            return array_map(static fn (): TeacherAiException => new TeacherAiException(
                'Генерация иллюстраций отключена.',
                self::CODE_REJECTED,
            ), $requests);
        }

        $apiKey = $this->apiKey();
        $endpoint = $this->endpoint();
        $timeout = $this->timeout();

        $responses = Http::pool(function (Pool $pool) use ($requests, $apiKey, $endpoint, $timeout): void {
            foreach ($requests as $key => $request) {
                $pool->as((string) $key)
                    ->timeout($timeout)
                    ->withToken($apiKey)
                    ->post($endpoint, $this->requestBody(
                        (string) $request['prompt'],
                        (string) ($request['orientation'] ?? self::ORIENTATION_PORTRAIT),
                    ));
            }
        });

        $results = [];

        foreach (array_keys($requests) as $key) {
            $item = $responses[(string) $key] ?? null;

            if ($item instanceof Response) {
                $results[$key] = $this->interpret($item);

                continue;
            }

            Log::warning('Teacher AI image request failed', [
                'exception' => is_object($item) ? $item::class : gettype($item),
                'error' => $item instanceof Throwable ? mb_substr($item->getMessage(), 0, self::LOG_BODY_LIMIT) : null,
            ]);

            $results[$key] = new TeacherAiException('Сервис изображений не ответил вовремя.', self::CODE_CONNECTION);
        }

        return $results;
    }

    /**
     * @return array<string, mixed>
     */
    private function requestBody(string $prompt, string $orientation): array
    {
        $model = $this->model();
        $landscape = $orientation === self::ORIENTATION_LANDSCAPE;

        if (str_starts_with(strtolower($model), 'dall-e')) {
            return [
                'model' => $model,
                'prompt' => $prompt,
                'n' => 1,
                'size' => $landscape ? '1792x1024' : '1024x1792',
                'quality' => 'standard',
                'response_format' => 'b64_json',
            ];
        }

        return [
            'model' => $model,
            'prompt' => $prompt,
            'n' => 1,
            'size' => $landscape ? '1536x1024' : '1024x1536',
            'quality' => $this->quality(),
            'output_format' => 'jpeg',
            'output_compression' => self::JPEG_QUALITY,
        ];
    }

    /**
     * @return array{bytes: string, model: string}|TeacherAiException
     */
    private function interpret(Response $response): array|TeacherAiException
    {
        if (! $response->successful()) {
            $status = $response->status();

            Log::warning('Teacher AI image request returned non-success status', [
                'status' => $status,
                'body' => mb_substr((string) $response->body(), 0, self::LOG_BODY_LIMIT),
            ]);

            return match (true) {
                $status === 429 => new TeacherAiException('Слишком много запросов к сервису изображений.', self::CODE_RATE_LIMITED),
                $status >= 500 => new TeacherAiException('Сервис изображений временно недоступен.', self::CODE_UNAVAILABLE),
                default => new TeacherAiException('Сервис изображений отклонил запрос.', self::CODE_REJECTED),
            };
        }

        $encoded = data_get($response->json(), 'data.0.b64_json');
        $bytes = is_string($encoded) && strlen($encoded) <= self::MAX_IMAGE_BYTES * 4 / 3 + 16
            ? base64_decode($encoded, true)
            : false;

        $jpeg = is_string($bytes) ? $this->toJpeg($bytes) : null;

        if ($jpeg === null) {
            Log::warning('Teacher AI image answer has no usable image', [
                'body' => mb_substr((string) $response->body(), 0, 200),
            ]);

            return new TeacherAiException('Сервис изображений вернул пустой ответ.', self::CODE_BAD_RESPONSE);
        }

        return ['bytes' => $jpeg, 'model' => (string) (data_get($response->json(), 'model') ?: $this->model())];
    }

    /**
     * Returns JPEG bytes: JPEG answers as is, other formats re-encoded with GD.
     */
    private function toJpeg(string $bytes): ?string
    {
        if ($bytes === '' || strlen($bytes) > self::MAX_IMAGE_BYTES) {
            return null;
        }

        $info = @getimagesizefromstring($bytes);

        if ($info === false) {
            return null;
        }

        if (($info['mime'] ?? '') === 'image/jpeg') {
            return $bytes;
        }

        $image = @imagecreatefromstring($bytes);

        if ($image === false) {
            return null;
        }

        ob_start();
        imagejpeg($image, null, self::JPEG_QUALITY);
        $jpeg = (string) ob_get_clean();
        imagedestroy($image);

        return $jpeg !== '' ? $jpeg : null;
    }

    private function quality(): string
    {
        $quality = strtolower(trim((string) config('services.teacher_ai.image_quality', 'low')));

        return in_array($quality, ['low', 'medium', 'high', 'auto'], true) ? $quality : 'low';
    }

    private function endpoint(): string
    {
        $endpoint = config('services.teacher_ai.image_endpoint');

        return is_string($endpoint) && trim($endpoint) !== '' ? trim($endpoint) : self::DEFAULT_ENDPOINT;
    }

    private function apiKey(): string
    {
        $key = config('services.teacher_ai.api_key') ?: config('services.openai.api_key');

        return is_string($key) ? trim($key) : '';
    }
}

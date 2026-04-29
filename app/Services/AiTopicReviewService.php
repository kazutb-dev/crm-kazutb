<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiTopicReviewService
{
    public function isEnabled(): bool
    {
        return (bool) config('services.topic_ai.enabled', false)
            && is_string(config('services.topic_ai.api_key'))
            && config('services.topic_ai.api_key') !== '';
    }

    /**
     * @param array<int,string> $candidates id => title
     * @return array<int,float> id => score(0..1)
     */
    public function scoreCandidates(string $inputTitle, array $candidates): array
    {
        if (!$this->isEnabled() || $candidates === []) {
            return [];
        }

        $endpoint = (string) config('services.topic_ai.endpoint', 'https://api.openai.com/v1/chat/completions');
        $model = (string) config('services.topic_ai.model', 'gpt-4o-mini');
        $timeout = (int) config('services.topic_ai.timeout', 15);

        $payloadCandidates = [];

        foreach ($candidates as $id => $title) {
            $payloadCandidates[] = [
                'id' => (int) $id,
                'title' => $title,
            ];
        }

        $systemPrompt = 'Ты оцениваешь семантическую близость тем дипломных работ. Верни только JSON без markdown.';
        $userPrompt = [
            'input_title' => $inputTitle,
            'candidates' => $payloadCandidates,
            'task' => 'Для каждого кандидата оцени similarity_score от 0 до 1. 1 = почти та же тема, 0 = не связана.',
            'response_format' => [
                'items' => [
                    ['id' => 1, 'similarity_score' => 0.0],
                ],
            ],
        ];

        try {
            $response = Http::timeout($timeout)
                ->withToken((string) config('services.topic_ai.api_key'))
                ->post($endpoint, [
                    'model' => $model,
                    'temperature' => 0,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => json_encode($userPrompt, JSON_UNESCAPED_UNICODE)],
                    ],
                ]);

            if (!$response->ok()) {
                Log::warning('AI topic review request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [];
            }

            $content = (string) data_get($response->json(), 'choices.0.message.content', '');
            $json = json_decode($content, true);

            if (!is_array($json)) {
                return [];
            }

            $items = data_get($json, 'items', []);

            if (!is_array($items)) {
                return [];
            }

            $scores = [];

            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $id = (int) ($item['id'] ?? 0);
                $score = (float) ($item['similarity_score'] ?? -1);

                if ($id <= 0 || $score < 0) {
                    continue;
                }

                $scores[$id] = min(1.0, max(0.0, $score));
            }

            return $scores;
        } catch (\Throwable $e) {
            Log::warning('AI topic review exception', ['message' => $e->getMessage()]);

            return [];
        }
    }
}

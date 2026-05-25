<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NavigationRoute;
use App\Services\KpiKnowledgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Throwable;

class AiChatController extends Controller
{
    public function chat(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'messages' => ['required', 'array', 'min:1', 'max:20'],
            'messages.*.role' => ['required', 'in:user,assistant'],
            'messages.*.text' => ['required', 'string', 'max:2000'],
        ]);

        if ($validator->fails()) {
            $firstError = (string) ($validator->errors()->first() ?: 'Некорректный формат запроса.');

            return response()->json([
                'text' => 'Проверьте сообщение и попробуйте снова. ' . $firstError,
            ], 422);
        }

        // Get the latest user message to determine context
        $messages = $request->input('messages');
        $latestUserMessage = '';
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            if ($messages[$i]['role'] === 'user') {
                $latestUserMessage = $messages[$i]['text'];
                break;
            }
        }

        $matchedRoute = $this->findRouteFromMessages($messages, $latestUserMessage);

        $apiKey = config('services.openai.api_key');

        if (empty($apiKey)) {
            return response()->json($this->buildFallbackPayload($latestUserMessage, $matchedRoute));
        }

        // Initialize KPI knowledge service
        $kpiService = new KpiKnowledgeService();

        // Check if this is a KPI question
        $isKpiQuestion = $kpiService->isKpiQuestion($latestUserMessage);

        if (!$isKpiQuestion && $matchedRoute) {
            return response()->json([
                'text' => $this->buildRouteAnswer($matchedRoute),
                'image_url' => $this->extractRouteImageUrl($matchedRoute),
                'route_polyline' => $this->extractRoutePolyline($matchedRoute),
            ]);
        }

        // Build system prompt
        $systemPrompt = $this->buildSystemPrompt($kpiService, $isKpiQuestion, $latestUserMessage);

        $messages = [['role' => 'system', 'content' => $systemPrompt]];

        foreach ($request->input('messages') as $msg) {
            $messages[] = [
                'role' => $msg['role'],
                'content' => $msg['text'],
            ];
        }

        try {
            $response = Http::timeout(20)
                ->withToken($apiKey)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'temperature' => 0.7,
                    'max_tokens' => 500,
                    'messages' => $messages,
                ]);

            if ($response->failed()) {
                return response()->json($this->buildFallbackPayload($latestUserMessage, $matchedRoute));
            }

            $text = trim((string) $response->json('choices.0.message.content', ''));

            if ($text === '') {
                return response()->json($this->buildFallbackPayload($latestUserMessage, $matchedRoute));
            }

            return response()->json([
                'text' => $text,
                'image_url' => $this->extractRouteImageUrl($matchedRoute),
                'route_polyline' => $this->extractRoutePolyline($matchedRoute),
            ]);
        } catch (Throwable) {
            return response()->json($this->buildFallbackPayload($latestUserMessage, $matchedRoute));
        }
    }

    /**
     * @return array{text: string, image_url: string|null, route_polyline: array<int, array{x: float, y: float}>}
     */
    private function buildFallbackPayload(string $query, ?NavigationRoute $route = null): array
    {
        return [
            'text' => $this->buildFallbackAnswer($query, $route),
            'image_url' => $this->extractRouteImageUrl($route),
            'route_polyline' => $this->extractRoutePolyline($route),
        ];
    }

    private function buildFallbackAnswer(string $query, ?NavigationRoute $route = null): string
    {
        $normalized = trim(mb_strtolower($query));

        if ($normalized === '') {
            return 'Уточните, что нужно найти: кабинет, сотрудника или отдел.';
        }

        $route = $route ?? $this->findRouteFromMessages([
            ['role' => 'user', 'text' => $query],
        ], $query);

        if (!$route) {
            return 'Сейчас AI-сервис временно недоступен. Попробуйте переформулировать запрос (например: "кабинет 100" или "деканат ИТ").';
        }

        $destination = $route->room ? 'кабинет ' . $route->room : $route->title;
        $meta = trim((string) ($route->meta ?? ''));
        $location = $meta !== '' ? $meta : trim(implode(' • ', array_filter([
            $route->building,
            $route->floor !== null ? ((string) $route->floor . ' этаж') : null,
        ])));

        $steps = is_array($route->steps) ? $route->steps : [];
        $stepsText = '';

        if ($steps !== []) {
            $stepsText = "\nМаршрут:\n" . collect($steps)
                ->map(fn (string $step, int $index): string => ($index + 1) . '. ' . $step)
                ->implode("\n");
        }

        return trim("Найдено: {$destination}." . ($location !== '' ? " {$location}." : '') . $stepsText);
    }

    private function extractRouteImageUrl(?NavigationRoute $route): ?string
    {
        if (!$route) {
            return null;
        }

        $value = trim((string) ($route->map_image_path ?? ''));
        if ($value === '') {
            return null;
        }

        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://') || str_starts_with($value, '/')) {
            return $value;
        }

        return '/' . ltrim($value, '/');
    }

    private function buildRouteAnswer(NavigationRoute $route): string
    {
        $destination = $route->room ? 'кабинет ' . $route->room : $route->title;
        $meta = trim((string) ($route->meta ?? ''));
        $location = $meta !== '' ? $meta : trim(implode(' • ', array_filter([
            $route->building,
            $route->floor !== null ? ((string) $route->floor . ' этаж') : null,
        ])));

        $steps = is_array($route->steps) ? $route->steps : [];
        $stepsText = '';

        if ($steps !== []) {
            $stepsText = "\nМаршрут:\n" . collect($steps)
                ->map(fn (string $step, int $index): string => ($index + 1) . '. ' . $step)
                ->implode("\n");
        } else {
            $stepsText = "\nМаршрут:\n1. Войдите в {$route->building} корпус.";
            if ($route->floor !== null) {
                $stepsText .= "\n2. Поднимитесь на {$route->floor} этаж.";
                $stepsText .= "\n3. Найдите {$destination}.";
            } else {
                $stepsText .= "\n2. Найдите {$destination}.";
            }
        }

        return trim("Найдено: {$destination}." . ($location !== '' ? " {$location}." : '') . $stepsText);
    }

    /**
     * @return array<int, array{x: float, y: float}>
     */
    private function extractRoutePolyline(?NavigationRoute $route): array
    {
        if (!$route || !is_array($route->map_polyline)) {
            return [];
        }

        return collect($route->map_polyline)
            ->map(function ($point): ?array {
                if (!is_array($point)) {
                    return null;
                }

                $x = isset($point['x']) && is_numeric($point['x']) ? (float) $point['x'] : null;
                $y = isset($point['y']) && is_numeric($point['y']) ? (float) $point['y'] : null;

                if ($x === null || $y === null || $x < 0 || $x > 100 || $y < 0 || $y > 100) {
                    return null;
                }

                return ['x' => $x, 'y' => $y];
            })
            ->filter(fn (?array $point): bool => $point !== null)
            ->values()
            ->all();
    }

    /**
     * @param array<int, array{role: string, text: string}> $messages
     */
    private function findRouteFromMessages(array $messages, string $latestUserMessage): ?NavigationRoute
    {
        $queries = [];

        $latest = trim($latestUserMessage);
        if ($latest !== '') {
            $queries[] = $latest;
        }

        for ($i = count($messages) - 1; $i >= 0; $i--) {
            $msg = $messages[$i] ?? null;
            if (!is_array($msg) || ($msg['role'] ?? '') !== 'user') {
                continue;
            }

            $text = trim((string) ($msg['text'] ?? ''));
            if ($text !== '') {
                $queries[] = $text;
            }
        }

        $queries = array_values(array_unique($queries));

        foreach ($queries as $query) {
            foreach ($this->buildRouteSearchCandidates($query) as $candidate) {
                $route = NavigationRoute::query()
                    ->where('is_active', true)
                    ->where(function ($q) use ($candidate): void {
                        $q->where('title', 'like', "%{$candidate}%")
                            ->orWhere('badge', 'like', "%{$candidate}%")
                            ->orWhere('room', 'like', "%{$candidate}%")
                            ->orWhere('meta', 'like', "%{$candidate}%")
                            ->orWhereHas('attachedUsers', function ($users) use ($candidate): void {
                                $users->where('name', 'like', "%{$candidate}%")
                                    ->orWhere('ad_login', 'like', "%{$candidate}%")
                                    ->orWhere('room', 'like', "%{$candidate}%");
                            });
                    })
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->first(['title', 'meta', 'building', 'floor', 'room', 'steps', 'map_image_path', 'map_polyline']);

                if ($route) {
                    return $route;
                }
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function buildRouteSearchCandidates(string $query): array
    {
        $base = trim($query);
        $candidates = $base !== '' ? [$base] : [];

        preg_match_all('/\d+[\/\-]?\d*/u', $base, $matches);
        $numbers = $matches[0] ?? [];

        foreach ($numbers as $number) {
            $token = trim($number);
            if ($token === '') {
                continue;
            }

            $candidates[] = $token;
            $candidates[] = 'кабинет ' . $token;

            if (str_contains($token, '/')) {
                foreach (explode('/', $token) as $part) {
                    $part = trim($part);
                    if ($part !== '') {
                        $candidates[] = $part;
                        $candidates[] = 'кабинет ' . $part;
                    }
                }
            }
        }

        $words = preg_split('/\s+/u', mb_strtolower($base)) ?: [];
        foreach ($words as $word) {
            $word = trim($word);
            if ($word !== '' && mb_strlen($word) >= 3) {
                $candidates[] = $word;
            }
        }

        return array_values(array_unique($candidates));
    }

    /**
     * Build system prompt based on context (KPI or navigation)
     */
    private function buildSystemPrompt(KpiKnowledgeService $kpiService, bool $isKpiQuestion, string $query): string
    {
        if ($isKpiQuestion) {
            $kpiContext = $kpiService->getKpiContext($query);
            $processSummary = $kpiService->getKpiProcessSummary();

            return <<<PROMPT
Ты — AI-ассистент портала КазУТБ (Казахский университет технологии и бизнеса имени К. Кулажанова).
Специализируешься на системе KPI (Key Performance Indicators) для сотрудников университета.

Твоя задача — помочь пользователям разобраться с:
1. Как создавать и заполнять KPI-записи
2. Как отправлять записи на проверку
3. Какие статусы может иметь запись
4. Роль и ответственность каждого участника (ППС, заведующий кафедрой, декан, структурное подразделение)
5. Какие действия доступны на каждом этапе

Ответь кратко, по делу, на языке вопроса (русский или казахский).
Приводи конкретные примеры и пошаговые инструкции из документации.

{$processSummary}

=== ПОДРОБНАЯ ДОКУМЕНТАЦИЯ ПО РОЛЯМ ===
{$kpiContext}
=== КОНЕЦ ДОКУМЕНТАЦИИ ===

ПАМЯТКА:
- Если вопрос о конкретной роли (ППС, декан, заведующий, структурное подразделение) — дай инструкции именно для этой роли
- Если пользователь не указал роль — объясни процесс в общем виде
- Всегда ссылайся на конкретные шаги из документации
PROMPT;
        }

        // Navigation context (original logic)
        $navRoutes = NavigationRoute::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['title', 'badge', 'meta', 'kind', 'building', 'floor', 'room', 'steps']);

        $navContext = $navRoutes->map(function (NavigationRoute $route): string {
            $kindLabel = match ($route->kind) {
                'cabinet'    => 'Кабинет',
                'staff'      => 'Сотрудник',
                'department' => 'Отдел',
                default      => $route->kind,
            };

            $line = "- [{$kindLabel}] {$route->title} (badge: {$route->badge})";
            $line .= " — {$route->meta}";

            if ($route->building) {
                $line .= ", корпус: {$route->building}";
            }
            if ($route->floor !== null) {
                $line .= ", этаж: {$route->floor}";
            }
            if ($route->room) {
                $line .= ", кабинет: {$route->room}";
            }

            $steps = $route->steps ?? [];
            if (!empty($steps)) {
                $stepsText = implode(' → ', $steps);
                $line .= "\n  Маршрут: {$stepsText}";
            }

            return $line;
        })->implode("\n");

        return <<<PROMPT
Ты — AI-ассистент портала КазУТБ (Казахский университет технологии и бизнеса имени К. Кулажанова).
Твоя задача — помочь сотрудникам и студентам:
1. Найти нужный кабинет, отдел или сотрудника.
2. Объяснить маршрут: корпус, этаж, номер кабинета и пошаговый путь (если шаги заданы).
3. Ориентироваться в цифровых сервисах портала.

Отвечай кратко, по делу, на том языке, на котором написан вопрос (русский или казахский).
Если маршрут есть в базе — давай конкретный ответ с шагами. Если нет — скажи, что точных данных нет.
Если вопрос не относится к университету — вежливо объясни, что ты специализируешься только на сервисах КазУТБ.

=== БАЗА МАРШРУТОВ КАЗУТБ (актуальные данные) ===
{$navContext}
=== КОНЕЦ БАЗЫ МАРШРУТОВ ===
PROMPT;
    }
}

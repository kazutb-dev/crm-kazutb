<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NavigationRoute;
use App\Services\KpiKnowledgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

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
            return response()->json(['error' => 'Invalid request.'], 422);
        }

        $apiKey = config('services.openai.api_key');

        if (empty($apiKey)) {
            return response()->json(['error' => 'AI service is not configured.'], 503);
        }

        // Initialize KPI knowledge service
        $kpiService = new KpiKnowledgeService();
        
        // Get the latest user message to determine context
        $messages = $request->input('messages');
        $latestUserMessage = '';
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            if ($messages[$i]['role'] === 'user') {
                $latestUserMessage = $messages[$i]['text'];
                break;
            }
        }

        // Check if this is a KPI question
        $isKpiQuestion = $kpiService->isKpiQuestion($latestUserMessage);

        // Build system prompt
        $systemPrompt = $this->buildSystemPrompt($kpiService, $isKpiQuestion, $latestUserMessage);

        $messages = [['role' => 'system', 'content' => $systemPrompt]];

        foreach ($request->input('messages') as $msg) {
            $messages[] = [
                'role' => $msg['role'],
                'content' => $msg['text'],
            ];
        }

        $response = Http::timeout(20)
            ->withToken($apiKey)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => config('services.openai.model', 'gpt-4o-mini'),
                'temperature' => 0.7,
                'max_tokens' => 500,
                'messages' => $messages,
            ]);

        if ($response->failed()) {
            return response()->json(['error' => 'AI service unavailable.'], 502);
        }

        $text = $response->json('choices.0.message.content', '');

        return response()->json(['text' => trim($text)]);
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

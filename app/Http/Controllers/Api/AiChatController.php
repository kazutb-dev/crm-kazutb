<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NavigationRoute;
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

        $systemPrompt = <<<PROMPT
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
}

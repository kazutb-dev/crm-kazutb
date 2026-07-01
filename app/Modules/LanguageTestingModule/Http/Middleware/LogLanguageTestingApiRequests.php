<?php

namespace App\Modules\LanguageTestingModule\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class LogLanguageTestingApiRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = trim((string) $request->header('X-Request-ID', ''));
        if ($requestId === '') {
            $requestId = (string) Str::uuid();
        }

        $correlationId = trim((string) $request->header('X-Correlation-ID', ''));
        if ($correlationId === '') {
            $correlationId = $requestId;
        }

        $request->attributes->set('language_testing_request_id', $requestId);
        $request->attributes->set('language_testing_correlation_id', $correlationId);

        $startedAt = microtime(true);
        $response = $next($request);
        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

        $consumer = (string) $request->attributes->get('language_testing_consumer', 'unknown');
        $apiKeyId = trim((string) $request->header('X-API-KEY-ID', ''));
        if ($apiKeyId === '' && trim((string) $request->header('X-API-KEY', '')) !== '') {
            $apiKeyId = 'provided';
        }

        if ($request->is('api/v1/*')) {
            Log::info('language-testing-api', [
                'request_id' => $requestId,
                'correlation_id' => $correlationId,
                'api_key_id' => $apiKeyId !== '' ? $apiKeyId : null,
                'consumer' => $consumer,
                'method' => $request->getMethod(),
                'path' => $request->path(),
                'status' => $response->getStatusCode(),
                'duration_ms' => $durationMs,
                'ip' => $request->ip(),
                'user_id' => $request->user()?->id,
            ]);
        }

        $response->headers->set('X-Request-ID', $requestId);
        $response->headers->set('X-Correlation-ID', $correlationId);

        return $response;
    }
}

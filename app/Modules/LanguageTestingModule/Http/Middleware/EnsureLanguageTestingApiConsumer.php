<?php

namespace App\Modules\LanguageTestingModule\Http\Middleware;

use App\Modules\LanguageTestingModule\Support\LanguageTestingAccess;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureLanguageTestingApiConsumer
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('sanctum')->user();
        if ($user && LanguageTestingAccess::canView($user)) {
            $request->attributes->set('language_testing_consumer', 'crm');

            return $next($request);
        }

        $configuredApiKey = trim((string) config('language_testing_module.integration.api_key', ''));
        if ($configuredApiKey === '') {
            $configuredApiKey = trim((string) config('language_testing.api_key', ''));
        }

        $configuredBearer = (string) config('language_testing_module.integration.bearer_token', '');
        $apiKey = (string) $request->header('X-API-KEY', '');
        $bearer = (string) $request->bearerToken();

        $apiKeyValid = $configuredApiKey !== '' && hash_equals($configuredApiKey, $apiKey);
        $bearerValid = $configuredBearer !== '' && hash_equals($configuredBearer, $bearer);

        if ($apiKeyValid || $bearerValid) {
            $request->attributes->set('language_testing_consumer', 'integration');

            return $next($request);
        }

        $requestId = (string) $request->attributes->get('language_testing_request_id', '');
        $errors = [];

        if ($configuredApiKey === '' && trim($configuredBearer) === '') {
            $errors['authorization'] = ['Integration credentials are not configured on CRM.'];
        } else {
            $errors['authorization'] = ['Valid CRM Bearer token or integration API key is required.'];
        }

        $payload = [
            'message' => 'Unauthorized.',
            'errors' => $errors,
        ];

        if ($requestId !== '') {
            $payload['request_id'] = $requestId;
        }

        return response()->json($payload, 401);
    }
}

<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Api\V1\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

trait InteractsWithLanguageTestingApi
{
    protected function requestId(Request $request): ?string
    {
        $requestId = $request->attributes->get('language_testing_request_id');

        return is_string($requestId) && $requestId !== '' ? $requestId : null;
    }

    protected function consumer(Request $request): string
    {
        return (string) $request->attributes->get('language_testing_consumer', '');
    }

    protected function ensureCrmConsumer(Request $request): void
    {
        if ($this->consumer($request) !== 'crm') {
            throw new HttpException(403, 'Only CRM consumers can access this endpoint.');
        }
    }

    protected function ensureIntegrationConsumer(Request $request): void
    {
        if ($this->consumer($request) !== 'integration') {
            throw new HttpException(403, 'Only integration consumers can access this endpoint.');
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function success(array $data = [], int $status = 200): JsonResponse
    {
        $request = request();
        $requestId = $request instanceof Request ? $this->requestId($request) : null;

        if ($requestId) {
            $data['request_id'] = $requestId;
        }

        return response()->json($data, $status);
    }

    /**
     * @param  array<string, array<int, string>>  $errors
     */
    protected function error(Request $request, string $message, int $status, array $errors = []): JsonResponse
    {
        $payload = ['message' => $message];

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        $requestId = $this->requestId($request);
        if ($requestId) {
            $payload['request_id'] = $requestId;
        }

        return response()->json($payload, $status);
    }
}

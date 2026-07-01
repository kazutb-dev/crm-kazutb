<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Api\V1\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

trait InteractsWithLanguageTestingApi
{
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
        return response()->json($data, $status);
    }
}
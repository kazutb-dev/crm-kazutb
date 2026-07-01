<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyTestingApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = config('services.crm.api_key') ?: 'crm_api_a34261d68fecaf34064bd7e7381a974cc08d1b881ba21120d110abe21526afce';

        if ($request->header('X-API-KEY') !== $expectedKey) {
            return response()->json([
                'error' => 'Unauthorized. Invalid API Key.'
            ], 401);
        }

        return $next($request);
    }
}

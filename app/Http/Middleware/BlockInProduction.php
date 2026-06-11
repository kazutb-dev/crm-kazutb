<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BlockInProduction
{
    /**
     * Block development tooling endpoints in production.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('production')) {
            abort(404);
        }

        return $next($request);
    }
}

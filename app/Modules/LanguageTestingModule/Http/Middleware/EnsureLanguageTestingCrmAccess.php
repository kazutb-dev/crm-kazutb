<?php

namespace App\Modules\LanguageTestingModule\Http\Middleware;

use App\Modules\LanguageTestingModule\Support\LanguageTestingAccess;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureLanguageTestingCrmAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($this->canAccess($user)) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'message' => 'Access denied for language testing module.',
            ], 403);
        }

        if ($request->header('X-Inertia')) {
            return Inertia::render('Errors/403', [
                'message' => 'Доступ к модулю "Проверка знаний языка" запрещён.',
            ])->toResponse($request)->setStatusCode(403);
        }

        abort(403, 'Доступ к модулю "Проверка знаний языка" запрещён.');
    }

    private function canAccess($user): bool
    {
        return LanguageTestingAccess::canView($user);
    }
}
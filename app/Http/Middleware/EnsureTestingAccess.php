<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureTestingAccess
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($this->canAccess($user)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Доступ к модулю "Тестирование" разрешен только преподавателям и администраторам.',
            ], 403);
        }

        if ($request->header('X-Inertia')) {
            return Inertia::render('Errors/403', [
                'message' => 'Доступ к модулю "Тестирование" разрешен только преподавателям и администраторам.',
            ])->toResponse($request)->setStatusCode(403);
        }

        abort(403, 'Доступ к модулю "Тестирование" запрещен.');
    }

    private function canAccess(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return in_array($user->resolvedRoleSlug(), [
            'teacher',
            'admin',
            'superadmin',
        ], true);
    }
}

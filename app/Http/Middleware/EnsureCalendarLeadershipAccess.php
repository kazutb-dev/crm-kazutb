<?php

namespace App\Http\Middleware;

use App\Http\Controllers\CalendarEmployeesController;
use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\CalendarSecretaryAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCalendarLeadershipAccess
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Доступ к календарю разрешен только сотрудникам из списка календаря.');
        }

        $userId = (int) $user->id;
        $title = mb_strtolower(trim((string) ($user?->ad_title ?? '')));

        if (CalendarEmployeeExclusion::query()->where('user_id', $userId)->exists()) {
            abort(403, 'Доступ к календарю разрешен только сотрудникам из списка календаря.');
        }

        if (CalendarEmployeeGrant::query()->where('user_id', $userId)->exists()) {
            return $next($request);
        }

        if (CalendarSecretaryAccess::query()
            ->where('secretary_id', $userId)
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->exists()) {
            return $next($request);
        }

        foreach (CalendarEmployeesController::LEADERSHIP_PATTERNS as $pattern) {
            if ($title !== '' && str_contains($title, $pattern)) {
                return $next($request);
            }
        }

        abort(403, 'Доступ к календарю разрешен только сотрудникам из списка календаря.');
    }
}

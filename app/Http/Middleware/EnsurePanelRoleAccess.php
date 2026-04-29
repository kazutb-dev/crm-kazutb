<?php

namespace App\Http\Middleware;

use App\Http\Controllers\CalendarEmployeesController;
use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\CalendarSecretaryAccess;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePanelRoleAccess
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $role = $request->user()?->resolvedRoleSlug();
        $routeName = (string) ($request->route()?->getName() ?? '');

        if ($this->startsWith($routeName, 'calendar.') && $this->canAccessCalendar($request->user())) {
            return $next($request);
        }

        // Admin roles can access all panel routes.
        if (in_array($role, ['admin', 'superadmin'], true)) {
            return $next($request);
        }

        // Students are restricted to profile routes only.
        if ($role === 'student') {
            if ($this->startsWith($routeName, 'profile.')) {
                return $next($request);
            }

            abort(403, 'Студенту недоступна админпанель.');
        }

        // Teachers are limited to department menu routes and profile.
        if ($role === 'teacher') {
            $allowedTeacherRoutes = [
                'profile.',
                'kpi.my-form',
                'kpi.my-entries.',
                'kpi.entries.show',
                'diplomas.',
                'announcements.',
            ];

            foreach ($allowedTeacherRoutes as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            abort(403, 'Для роли teacher доступно только меню кафедры.');
        }

        return $next($request);
    }

    private function startsWith(string $value, string $prefix): bool
    {
        return str_starts_with($value, $prefix);
    }

    private function canAccessCalendar(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        $userId = (int) $user->id;

        if (CalendarEmployeeExclusion::query()->where('user_id', $userId)->exists()) {
            return false;
        }

        if (CalendarEmployeeGrant::query()->where('user_id', $userId)->exists()) {
            return true;
        }

        if (CalendarSecretaryAccess::query()
            ->where('secretary_id', $userId)
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->exists()) {
            return true;
        }

        $title = mb_strtolower(trim((string) ($user->ad_title ?? '')));

        foreach (CalendarEmployeesController::LEADERSHIP_PATTERNS as $pattern) {
            if ($title !== '' && str_contains($title, $pattern)) {
                return true;
            }
        }

        return false;
    }
}
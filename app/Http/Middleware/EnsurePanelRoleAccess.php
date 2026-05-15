<?php

namespace App\Http\Middleware;

use App\Http\Controllers\CalendarEmployeesController;
use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\CalendarSecretaryAccess;
use App\Models\KpiAccessGrant;
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
        $userId = $request->user()?->id;

        // Approve/reject in structural queue is intentionally available to all authenticated users.
        if ($this->startsWith($routeName, 'kpi.entries.approve') || $this->startsWith($routeName, 'kpi.entries.reject')) {
            return $next($request);
        }

        if ($userId !== null && $this->canAccessKpiRouteViaGrant($userId, $routeName)) {
            return $next($request);
        }

        if ($this->startsWith($routeName, 'kpi.indicators.') && $this->canAccessKpiIndicators($role)) {
            return $next($request);
        }

        if ($this->startsWith($routeName, 'kpi.structural-units.') && $this->canAccessKpiStructuralUnits($role)) {
            return $next($request);
        }

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
                'kpi.summary',
                'kpi.summary.',
                'diplomas.',
                'announcements.',
            ];

            foreach ($allowedTeacherRoutes as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            // Allow routes covered by KPI access grants
            if ($userId !== null && $this->canAccessKpiRouteViaGrant($userId, $routeName)) {
                return $next($request);
            }

            abort(403, 'Для роли teacher доступно только меню кафедры.');
        }

        // Department heads and structural division heads have access to division-specific KPI routes.
        if (in_array($role, ['department', 'structural'], true)) {
            $allowedRoles = [
                'profile.',
                'kpi.summary',
                'kpi.summary.',
                'kpi.my-entries.',
                'kpi.entries.show',
                'kpi.structural-queue',
                'kpi.entries.structural',
                'kpi.entries.approve',
                'kpi.entries.reject',
                'announcements.',
            ];

            foreach ($allowedRoles as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            abort(403, 'Для роли department доступны только маршруты подразделения.');
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

    private function canAccessKpiIndicators(?string $role): bool
    {
        if (! is_string($role) || $role === '') {
            return false;
        }

        return in_array($role, [
            'admin',
            'superadmin',
            'teacher',
            'department_head',
            'hod',
            'dean',
            'department',
        ], true);
    }

    private function canAccessKpiStructuralUnits(?string $role): bool
    {
        if (! is_string($role) || $role === '') {
            return false;
        }

        // Only admin and superadmin can manage KPI structural units
        return in_array($role, [
            'admin',
            'superadmin',
        ], true);
    }

    private function canAccessKpiRouteViaGrant(int $userId, string $routeName): bool
    {
        if ($this->startsWith($routeName, 'kpi.entries.approve')) {
            return $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_REVIEW_QUEUE)
                || $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_APPROVAL_QUEUE)
                || $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_STRUCTURAL_QUEUE);
        }

        if ($this->startsWith($routeName, 'kpi.entries.return')) {
            return $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_REVIEW_QUEUE)
                || $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_APPROVAL_QUEUE);
        }

        if ($this->startsWith($routeName, 'kpi.entries.reject')) {
            return $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_STRUCTURAL_QUEUE);
        }

        // Map route prefixes to the required permission
        $grantRouteMap = [
            'kpi.settings'           => KpiAccessGrant::PERM_KPI_ADMIN,
            'kpi.settings.'          => KpiAccessGrant::PERM_KPI_ADMIN,
            'kpi.structural-units'   => KpiAccessGrant::PERM_KPI_ADMIN,
            'kpi.structural-units.'  => KpiAccessGrant::PERM_KPI_ADMIN,
            'kpi.summary'            => KpiAccessGrant::PERM_KPI_ADMIN,
            'kpi.summary.'           => KpiAccessGrant::PERM_KPI_ADMIN,
            'kpi.review-queue'       => KpiAccessGrant::PERM_REVIEW_QUEUE,
            'kpi.entries.review'     => KpiAccessGrant::PERM_REVIEW_QUEUE,
            'kpi.approval-queue'     => KpiAccessGrant::PERM_APPROVAL_QUEUE,
            'kpi.structural-queue'   => KpiAccessGrant::PERM_STRUCTURAL_QUEUE,
            'kpi.entries.structural' => KpiAccessGrant::PERM_STRUCTURAL_QUEUE,
            'kpi.indicators.'        => KpiAccessGrant::PERM_INDICATORS,
            'kpi.analytics.'         => KpiAccessGrant::PERM_ANALYTICS,
            'kpi.index'              => KpiAccessGrant::PERM_PERIODS,
            'kpi.show'               => KpiAccessGrant::PERM_PERIODS,
            'kpi.store'              => KpiAccessGrant::PERM_PERIODS,
            'kpi.update'             => KpiAccessGrant::PERM_PERIODS,
            'kpi.activate'           => KpiAccessGrant::PERM_PERIODS,
            'kpi.deactivate'         => KpiAccessGrant::PERM_PERIODS,
            'kpi.close'              => KpiAccessGrant::PERM_PERIODS,
            'kpi.destroy'            => KpiAccessGrant::PERM_PERIODS,
        ];

        foreach ($grantRouteMap as $prefix => $permission) {
            if ($this->startsWith($routeName, $prefix)) {
                if (in_array($permission, [
                    KpiAccessGrant::PERM_REVIEW_QUEUE,
                    KpiAccessGrant::PERM_APPROVAL_QUEUE,
                    KpiAccessGrant::PERM_STRUCTURAL_QUEUE,
                ], true)) {
                    return $this->hasExactKpiGrant($userId, $permission);
                }

                return KpiAccessGrant::userHas($userId, $permission);
            }
        }

        return false;
    }

    private function hasExactKpiGrant(int $userId, string $permission): bool
    {
        return KpiAccessGrant::query()
            ->where('user_id', $userId)
            ->where('permission', $permission)
            ->where('is_active', true)
            ->exists();
    }
}
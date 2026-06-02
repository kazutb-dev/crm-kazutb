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

        if ($this->canAccessPositionRequestRoutes($userId, $role, $routeName)) {
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

        // Teachers are limited to their KPI form and profile.
        if ($role === 'teacher') {
            $allowedTeacherRoutes = [
                'profile.',
                'kpi.my-form',
                'kpi.my-entries.',
                'kpi.entries.show',
                'kpi.entries.save-plan',
                'kpi.entries.save-fact',
                'kpi.entries.submit',
                'kpi.entries.files.',
            ];

            if ($this->canAccessCertificatesModule($request->user())) {
                $allowedTeacherRoutes = array_merge($allowedTeacherRoutes, [
                    'templates.',
                    'certificates.',
                    'certificate-templates.',
                    'certificate-template-versions.',
                ]);
            }

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

        if ($role === 'hod') {
            $allowedRoles = [
                'profile.',
                'kpi.my-form',
                'kpi.my-entries.',
                'kpi.entries.show',
                'kpi.entries.save-plan',
                'kpi.entries.save-fact',
                'kpi.entries.submit',
                'kpi.entries.files.',
                'kpi.summary',
                'kpi.summary.',
                'kpi.review-queue',
                'kpi.entries.review',
                'kpi.entries.return',
                'kpi.entries.approve',
                'kpi.entries.reject',
            ];

            foreach ($allowedRoles as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            abort(403, 'Для роли hod доступны только маршруты сводки, очереди проверки и свои показатели.');
        }

        if ($role === 'dean') {
            $allowedRoles = [
                'profile.',
                'kpi.my-form',
                'kpi.my-entries.',
                'kpi.entries.show',
                'kpi.entries.save-plan',
                'kpi.entries.save-fact',
                'kpi.entries.submit',
                'kpi.entries.files.',
                'kpi.summary',
                'kpi.summary.',
                'kpi.approval-queue',
                'kpi.entries.approve',
                'kpi.entries.reject',
                'kpi.entries.return',
            ];

            foreach ($allowedRoles as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            abort(403, 'Для роли dean доступны только маршруты сводки, утверждения и свои показатели.');
        }

        if ($role === 'structural') {
            $allowedRoles = [
                'profile.',
                'kpi.summary',
                'kpi.summary.',
                'kpi.structural-queue',
                'kpi.entries.approve',
                'kpi.entries.reject',
                'kpi.entries.structural-confirm',
                'kpi.entries.structural-reject',
                'kpi.entries.return',
                'kpi.entries.show',
            ];

            foreach ($allowedRoles as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            abort(403, 'Для роли structural доступны только маршруты сводки и утверждения.');
        }

        if ($role === 'department') {
            $allowedRoles = [
                'profile.',
                'kpi.my-form',
                'kpi.my-entries.',
                'kpi.entries.show',
                'kpi.entries.save-plan',
                'kpi.entries.save-fact',
                'kpi.entries.submit',
                'kpi.entries.files.',
            ];

            foreach ($allowedRoles as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            abort(403, 'Для роли department доступно только меню Мои показатели.');
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
            ->exists()
        ) {
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

    private function canAccessCertificatesModule(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        $allowedEmails = [
            'a.khastayeva@kaztbu.edu.kz',
        ];

        $email = mb_strtolower(trim((string) ($user->email ?? '')));

        return in_array($email, $allowedEmails, true);
    }

    private function canAccessKpiIndicators(?string $role): bool
    {
        if (! is_string($role) || $role === '') {
            return false;
        }

        return in_array($role, [
            'admin',
            'superadmin',
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
        // kpi_admin grant provides full access to all KPI routes.
        if ($this->startsWith($routeName, 'kpi.') && $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_KPI_ADMIN)) {
            return true;
        }

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

    private function canAccessPositionRequestRoutes(?int $userId, ?string $role, string $routeName): bool
    {
        if (! $this->startsWith($routeName, 'position-requests.')) {
            return false;
        }

        if (in_array($role, ['admin', 'superadmin', 'structural', 'dean', 'hod', 'department_head'], true)) {
            return true;
        }

        if ($userId !== null && KpiAccessGrant::userHasKpiAdmin($userId)) {
            return true;
        }

        return false;
    }
}

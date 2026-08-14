<?php

namespace App\Http\Middleware;

use App\Http\Controllers\CalendarEmployeesController;
use App\Models\CalendarEmployeeExclusion;
use App\Models\CalendarEmployeeGrant;
use App\Models\CalendarSecretaryAccess;
use App\Models\KpiAccessGrant;
use App\Models\PositionChangeRequest;
use App\Models\User;
use App\Services\ElevatedAuthorityService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Inertia\Inertia;

class EnsurePanelRoleAccess
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();
        $routeName = (string) ($request->route()?->getName() ?? '');
        $userId = $user?->id;

        if ($this->isSensitiveRoute($routeName) && ! $this->hasTrustedSensitiveAccess($user, $role, $routeName)) {
            return $this->forbidden($request, 'Доступ отклонен: недостаточно доверенных role/scope/approval данных.');
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

        if ($this->startsWith($routeName, 'calendar.') && $this->canAccessCalendar($user)) {
            return $next($request);
        }

        if ($this->canAccessPositionRequestRoutes($userId, $role, $routeName)) {
            return $next($request);
        }

        if ($this->canAccessRoleAccessOverview($userId, $role, $routeName)) {
            return $next($request);
        }

        if ($role === 'academic_mobility') {
            $allowedAcademicMobilityRoutes = [
                'academic-mobility.',
                'profile.',
            ];

            foreach ($allowedAcademicMobilityRoutes as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            return $this->forbidden($request, 'Для роли academic_mobility доступен только модуль академической мобильности.');
        }

        if ($role === 'certificates') {
            $allowedCertificateRoutes = [
                'templates.',
                'certificates.',
                'certificate-templates.',
                'certificate-template-versions.',
            ];

            foreach ($allowedCertificateRoutes as $allowedRoute) {
                if ($this->startsWith($routeName, $allowedRoute)) {
                    return $next($request);
                }
            }

            if ($request->expectsJson()) {
                return $this->forbidden($request, 'Для роли certificates доступен только модуль сертификатов.');
            }

            return redirect()->route('templates.index');
        }

        // Admin roles can access all panel routes.
        if (in_array($role, ['admin', 'superadmin'], true)) {
            return $next($request);
        }

        // Phonebook directory index is accessible to all authenticated users regardless of role.
        if ($routeName === 'phonebook.index') {
            return $next($request);
        }

        // Students are restricted to profile routes only.
        if ($role === 'student') {
            if ($this->startsWith($routeName, 'profile.')) {
                return $next($request);
            }

            return $this->forbidden($request, 'Студенту недоступна админпанель.');
        }

        // Teachers are limited to their KPI form and profile.
        if ($role === 'teacher') {
            if ($this->startsWith($routeName, 'kpi.') && ! $this->canAccessKpiModule($user)) {
                return $this->forbidden($request, 'Для KPI-модуля недостаточно подтвержденной authority.');
            }

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

            return $this->forbidden($request, 'Для роли teacher доступно только меню кафедры.');
        }

        if ($role === 'hod') {
            if ($this->startsWith($routeName, 'kpi.') && ! $this->canAccessKpiModule($user)) {
                return $this->forbidden($request, 'Для KPI-модуля недостаточно подтвержденной authority.');
            }

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

            return $this->forbidden($request, 'Для роли hod доступны только маршруты сводки, очереди проверки и свои показатели.');
        }

        if ($role === 'dean') {
            if ($this->startsWith($routeName, 'kpi.') && ! $this->canAccessKpiModule($user)) {
                return $this->forbidden($request, 'Для KPI-модуля недостаточно подтвержденной authority.');
            }

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

            return $this->forbidden($request, 'Для роли dean доступны только маршруты сводки, утверждения и свои показатели.');
        }

        if ($role === 'structural') {
            if ($this->startsWith($routeName, 'kpi.') && ! $this->canAccessKpiModule($user)) {
                return $this->forbidden($request, 'Для KPI-модуля недостаточно подтвержденной authority.');
            }

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

            return $this->forbidden($request, 'Для роли structural доступны только маршруты сводки и утверждения.');
        }

        if ($role === 'department') {
            if ($this->startsWith($routeName, 'kpi.') && ! $this->canAccessKpiModule($user)) {
                return $this->forbidden($request, 'Для KPI-модуля недостаточно подтвержденной authority.');
            }

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

            return $this->forbidden($request, 'Для роли department доступно только меню Мои показатели.');
        }

        if ($this->startsWith($routeName, 'profile.')) {
            return $next($request);
        }

        return $this->forbidden($request, 'Доступ запрещен по deny-by-default guardrail.');
    }

    private function forbidden(Request $request, string $message): Response
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $message], 403);
        }

        // For Inertia requests return a valid Inertia response so the SPA
        // can render a graceful in-app error page instead of showing the
        // Inertia plain-JSON overlay.
        if ($request->header('X-Inertia')) {
            return Inertia::render('Errors/403', ['message' => $message])->toResponse($request)->setStatusCode(403);
        }

        abort(403, $message);
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

    private function canAccessKpiModule(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return (bool) (app(\App\Services\KpiAccessEvaluatorService::class)->evaluateModuleAccess($user)['allow'] ?? false);
    }

    private function canAccessPositionRequestRoutes(?int $userId, ?string $role, string $routeName): bool
    {
        if (! $this->startsWith($routeName, 'position-requests.') && ! $this->startsWith($routeName, 'governance.access-requests')) {
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

    private function canAccessRoleAccessOverview(?int $userId, ?string $role, string $routeName): bool
    {
        if (
            ! $this->startsWith($routeName, 'governance.role-access')
            && ! $this->startsWith($routeName, 'governance.org-structure')
            && ! $this->startsWith($routeName, 'governance.access-requests')
            && ! $this->startsWith($routeName, 'governance.authority-ledger')
        ) {
            return false;
        }

        if ($userId === null) {
            return false;
        }

        $user = User::query()->find($userId);
        if ($user && app(ElevatedAuthorityService::class)->canAccessGovernanceSurface($user)) {
            return true;
        }

        return $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_KPI_ADMIN)
            || $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_PERIODS);
    }

    private function isSensitiveRoute(string $routeName): bool
    {
        $sensitivePrefixes = [
            'kpi.review-queue',
            'kpi.approval-queue',
            'kpi.structural-queue',
            'kpi.entries.review',
            'kpi.entries.approve',
            'kpi.entries.reject',
            'kpi.entries.return',
            'kpi.entries.structural',
            'position-requests.',
            'governance.access-requests',
            'governance.authority-ledger',
        ];

        foreach ($sensitivePrefixes as $prefix) {
            if ($this->startsWith($routeName, $prefix)) {
                return true;
            }
        }

        return false;
    }

    private function hasTrustedSensitiveAccess(?User $user, ?string $role, string $routeName): bool
    {
        if (! $user) {
            return false;
        }

        $authority = app(ElevatedAuthorityService::class);
        if ($authority->canAccessGovernanceSurface($user)) {
            return true;
        }

        $userId = (int) $user->id;

        if ($this->hasPendingPositionRequest($userId)) {
            return false;
        }

        if ($this->startsWith($routeName, 'position-requests.') || $this->startsWith($routeName, 'governance.access-requests')) {
            return KpiAccessGrant::userHasKpiAdmin($userId)
                || ($role === 'dean' && $user->faculty_id !== null)
                || (in_array($role, ['hod', 'department_head'], true) && $user->department_id !== null)
                || ($role === 'structural' && $this->hasStructuralScope($userId));
        }

        if ($this->startsWith($routeName, 'governance.authority-ledger')) {
            return KpiAccessGrant::userHasKpiAdmin($userId)
                || KpiAccessGrant::userHas($userId, KpiAccessGrant::PERM_PERIODS)
                || ($role === 'dean' && $user->faculty_id !== null)
                || (in_array($role, ['hod', 'department_head'], true) && $user->department_id !== null)
                || ($role === 'structural' && $this->hasStructuralScope($userId));
        }

        if (
            $this->startsWith($routeName, 'kpi.review-queue')
            || $this->startsWith($routeName, 'kpi.entries.review')
            || $this->startsWith($routeName, 'kpi.entries.return')
        ) {
            return $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_REVIEW_QUEUE)
                || (in_array($role, ['hod', 'department_head'], true) && $user->department_id !== null);
        }

        if (
            $this->startsWith($routeName, 'kpi.approval-queue')
            || $this->startsWith($routeName, 'kpi.entries.approve')
        ) {
            return $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_REVIEW_QUEUE)
                || $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_APPROVAL_QUEUE)
                || $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                || ($role === 'dean' && $user->faculty_id !== null)
                || (in_array($role, ['hod', 'department_head'], true) && $user->department_id !== null)
                || ($role === 'structural' && $this->hasStructuralScope($userId));
        }

        if (
            $this->startsWith($routeName, 'kpi.structural-queue')
            || $this->startsWith($routeName, 'kpi.entries.reject')
            || $this->startsWith($routeName, 'kpi.entries.structural')
        ) {
            return $this->hasExactKpiGrant($userId, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                || ($role === 'structural' && $this->hasStructuralScope($userId));
        }

        return false;
    }

    private function hasPendingPositionRequest(int $userId): bool
    {
        return PositionChangeRequest::query()
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->exists();
    }

    private function hasStructuralScope(int $userId): bool
    {
        return User::query()
            ->whereKey($userId)
            ->whereHas('kpiStructuralUnits')
            ->exists();
    }
}

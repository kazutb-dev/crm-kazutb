<?php

namespace App\Http\Controllers;

use App\Models\Division;
use App\Models\KpiAccessGrant;
use App\Models\KpiIndicator;
use App\Models\User;
use App\Services\BusinessActivityLogger;
use App\Services\ElevatedAuthorityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class KpiAccessController extends Controller
{
    public function index(Request $request): Response
    {
        $this->abortUnlessCanAccessGovernance($request);

        $search = trim((string) $request->query('search', ''));

        // Все активные гранты с пользователями
        $grants = KpiAccessGrant::query()
            ->with(['user:id,name,email,ad_title,ad_department', 'grantedBy:id,name', 'division:id,name'])
            ->orderBy('user_id')
            ->orderBy('permission')
            ->get();

        // Список пользователей для поиска (без тех у кого уже admin/dean/department_head)
        $usersQuery = User::query()
            ->select('id', 'name', 'email', 'ad_title', 'ad_department', 'role_id', 'role')
            ->with('roleRef:id,slug,name');

        if ($search !== '') {
            $usersQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('ad_department', 'like', "%{$search}%");
            });
        }

        $users = $usersQuery->orderBy('name')->limit(50)->get();

        // Separate list of divisions used as KPI indicator checkers
        $structuralDivisionIds = KpiIndicator::query()
            ->whereNotNull('checker_division_id')
            ->distinct()
            ->pluck('checker_division_id');

        $structuralDivisions = Division::query()
            ->whereIn('id', $structuralDivisionIds)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Kpi/Access', [
            'grants' => $grants,
            'users' => $users,
            'search' => $search,
            'permissions_list' => KpiAccessGrant::ALL_PERMISSIONS,
            'permission_labels' => KpiAccessGrant::PERMISSION_LABELS,
            'structural_divisions' => $structuralDivisions,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $decision = $this->abortUnlessDangerousActionAllowed($request, 'kpi_access_management');
        $reason = $this->validateDangerousActionReason($request, (bool) ($decision['reason_required'] ?? false));

        $data = $request->validate([
            'user_id'     => ['required', 'integer', 'exists:users,id'],
            'permission'  => ['required', 'string', Rule::in(KpiAccessGrant::ALL_PERMISSIONS)],
            'division_id' => ['nullable', 'integer', 'exists:divisions,id'],
        ]);

        // For structural_queue, a division must be specified
        if ($data['permission'] === KpiAccessGrant::PERM_STRUCTURAL_QUEUE && empty($data['division_id'])) {
            return back()->withErrors(['division_id' => 'Для очереди структурного подразделения необходимо выбрать подразделение.']);
        }

        // Unique key in DB is (user_id, permission), so structural division is updated on that row.
        $matchKey = [
            'user_id'     => $data['user_id'],
            'permission'  => $data['permission'],
        ];

        KpiAccessGrant::query()->updateOrCreate(
            $matchKey,
            [
                'division_id' => $data['permission'] === KpiAccessGrant::PERM_STRUCTURAL_QUEUE
                    ? ($data['division_id'] ?? null)
                    : null,
                'granted_by' => $request->user()->id,
                'granted_at' => now(),
                'is_active'  => true,
            ]
        );

        app(BusinessActivityLogger::class)->log(
            'kpi_access_grant_created',
            'Выдан KPI grant',
            null,
            [
                'target_user_id' => (int) $data['user_id'],
                'permission' => (string) $data['permission'],
                'division_id' => $data['division_id'] ?? null,
                'reason' => $reason,
            ],
            $request->user(),
            $request,
        );

        $this->logSuperAdminOverride($request, 'kpi_access_grant_created', [
            'target_user_id' => (int) $data['user_id'],
            'permission' => (string) $data['permission'],
            'division_id' => $data['division_id'] ?? null,
            'reason' => $reason,
            'authority_decision' => $decision,
        ]);

        return back()->with('success', 'Доступ выдан.');
    }

    public function update(Request $request, KpiAccessGrant $grant): RedirectResponse
    {
        $decision = $this->abortUnlessDangerousActionAllowed($request, 'kpi_access_management');
        $reason = $this->validateDangerousActionReason($request, (bool) ($decision['reason_required'] ?? false));

        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $grant->update(['is_active' => $data['is_active']]);

        app(BusinessActivityLogger::class)->log(
            'kpi_access_grant_toggled',
            'Статус KPI grant изменен',
            $grant,
            [
                'grant_id' => $grant->id,
                'target_user_id' => $grant->user_id,
                'permission' => $grant->permission,
                'is_active' => (bool) $data['is_active'],
                'reason' => $reason,
            ],
            $request->user(),
            $request,
        );

        $this->logSuperAdminOverride($request, 'kpi_access_grant_toggled', [
            'grant_id' => $grant->id,
            'target_user_id' => $grant->user_id,
            'permission' => $grant->permission,
            'is_active' => (bool) $data['is_active'],
            'reason' => $reason,
            'authority_decision' => $decision,
        ]);

        return back()->with('success', $data['is_active'] ? 'Доступ активирован.' : 'Доступ деактивирован.');
    }

    public function destroy(Request $request, KpiAccessGrant $grant): RedirectResponse
    {
        $decision = $this->abortUnlessDangerousActionAllowed($request, 'kpi_access_management');
        $reason = $this->validateDangerousActionReason($request, (bool) ($decision['reason_required'] ?? false));

        $context = [
            'grant_id' => $grant->id,
            'target_user_id' => $grant->user_id,
            'permission' => $grant->permission,
            'division_id' => $grant->division_id,
            'reason' => $reason,
        ];

        $grant->delete();

        app(BusinessActivityLogger::class)->log(
            'kpi_access_grant_deleted',
            'KPI grant удален',
            null,
            $context,
            $request->user(),
            $request,
        );

        $this->logSuperAdminOverride($request, 'kpi_access_grant_deleted', $context);

        return back()->with('success', 'Доступ отозван.');
    }

    private function abortUnlessCanAccessGovernance(Request $request): void
    {
        $user = $request->user();
        abort_unless($user, 403);

        if (! app(ElevatedAuthorityService::class)->canAccessGovernanceSurface($user)) {
            abort(403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function abortUnlessDangerousActionAllowed(Request $request, string $action): array
    {
        $user = $request->user();
        abort_unless($user, 403);

        $decision = app(ElevatedAuthorityService::class)->evaluateDangerousAction($user, $action);

        if (! ($decision['allow'] ?? false)) {
            abort(403, 'Недостаточно категориальных elevated-полномочий.');
        }

        return $decision;
    }

    private function validateDangerousActionReason(Request $request, bool $required): ?string
    {
        $rules = $required
            ? ['required', 'string', 'min:8', 'max:500']
            : ['nullable', 'string', 'max:500'];

        $validated = $request->validate([
            'reason' => $rules,
        ]);

        return isset($validated['reason']) ? trim((string) $validated['reason']) : null;
    }

    private function logSuperAdminOverride(Request $request, string $action, array $context = []): void
    {
        $actor = $request->user();

        if (! $actor || $actor->resolvedRoleSlug() !== 'superadmin') {
            return;
        }

        app(BusinessActivityLogger::class)->log(
            'superadmin_override',
            'Superadmin override: ' . $action,
            null,
            $context,
            $actor,
            $request,
        );
    }
}

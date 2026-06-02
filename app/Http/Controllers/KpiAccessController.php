<?php

namespace App\Http\Controllers;

use App\Models\Division;
use App\Models\KpiAccessGrant;
use App\Models\KpiIndicator;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class KpiAccessController extends Controller
{
    public function index(Request $request): Response
    {
        $this->abortUnlessAdmin($request);

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
        $this->abortUnlessAdmin($request);

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

        return back()->with('success', 'Доступ выдан.');
    }

    public function update(Request $request, KpiAccessGrant $grant): RedirectResponse
    {
        $this->abortUnlessAdmin($request);

        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $grant->update(['is_active' => $data['is_active']]);

        return back()->with('success', $data['is_active'] ? 'Доступ активирован.' : 'Доступ деактивирован.');
    }

    public function destroy(Request $request, KpiAccessGrant $grant): RedirectResponse
    {
        $this->abortUnlessAdmin($request);

        $grant->delete();

        return back()->with('success', 'Доступ отозван.');
    }

    private function abortUnlessAdmin(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        if (!in_array($role, ['admin', 'superadmin'], true)) {
            abort(403);
        }
    }
}

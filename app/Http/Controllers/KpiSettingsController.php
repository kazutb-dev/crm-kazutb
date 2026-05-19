<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\AcademicYear;
use App\Models\Division;
use App\Models\KpiAccessGrant;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiStructuralUnit;
use App\Models\User;
use App\Services\KpiNpuSettingsService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class KpiSettingsController extends Controller
{
    public function __construct(private readonly KpiNpuSettingsService $settingsService)
    {
    }

    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->canManageSettings($user), 403);

        $activeTab = trim((string) $request->query('tab', 'indicators'));
        if (! in_array($activeTab, ['settings', 'seasons', 'indicators', 'access'], true)) {
            $activeTab = 'indicators';
        }

        $query = KpiPeriod::query()->with(['academicYear:id,name,start_year,end_year', 'creator:id,name', 'updater:id,name']);

        $academicYearId = $request->integer('academic_year_id');
        if ($academicYearId > 0) {
            $query->where('academic_year_id', $academicYearId);
        }

        $status = trim((string) $request->query('status', ''));
        if ($status !== '') {
            $query->where('status', $status);
        }

        $periods = $query
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        $currentYear = now()->year;
        for ($y = max(2022, $currentYear - 3); $y <= $currentYear + 7; $y++) {
            AcademicYear::firstOrCreate(
                ['start_year' => $y, 'end_year' => $y + 1],
                ['name' => $y . '/' . ($y + 1), 'is_active' => false],
            );
        }

        $academicYears = AcademicYear::query()
            ->orderByDesc('start_year')
            ->get(['id', 'name', 'start_year', 'end_year']);

        $canManage = $request->user()?->can('create', KpiPeriod::class) ?? false;

        $indicatorEntityType = trim((string) $request->query('indicator_entity_type', ''));
        $indicatorIsActive = trim((string) $request->query('indicator_is_active', ''));

        $indicatorQuery = KpiIndicator::query()
            ->with([
                'checkerStructuralUnit:id,code,name',
                'structuralUnits:id,code,name',
            ]);

        if ($indicatorEntityType !== '') {
            $indicatorQuery->where('entity_type', $indicatorEntityType);
        }

        if ($indicatorIsActive === '1' || $indicatorIsActive === '0') {
            $indicatorQuery->where('is_active', $indicatorIsActive === '1');
        }

        $indicators = $indicatorQuery
            ->ordered()
            ->paginate(20, ['*'], 'indicators_page')
            ->withQueryString();

        $accessGrants = KpiAccessGrant::query()
            ->with(['user:id,name,display_name,email,ad_department,ad_title', 'grantedBy:id,name,display_name'])
            ->where('permission', KpiAccessGrant::PERM_KPI_ADMIN)
            ->where('is_active', true)
            ->latest('granted_at')
            ->get();

        $staffOptions = User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'display_name', 'email', 'ad_department', 'ad_title'])
            ->map(fn (User $staff): array => [
                'id' => $staff->id,
                'name' => $staff->display_name ?: $staff->name,
                'email' => $staff->email,
                'department' => $staff->ad_department,
                'title' => $staff->ad_title,
            ])
            ->all();

        return Inertia::render('Kpi/Settings', [
            'activeTab' => $activeTab,
            'npuSettings' => $this->settingsService->get(),
            'appSettingsKey' => AppSetting::query()->where('key', 'kpi_npu_settings')->value('id'),
            'periods' => $periods,
            'academicYears' => $academicYears,
            'filters' => [
                'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
                'status' => $status !== '' ? $status : null,
            ],
            'statusOptions' => [
                KpiPeriod::STATUS_DRAFT,
                KpiPeriod::STATUS_ACTIVE,
                KpiPeriod::STATUS_CLOSED,
            ],
            'permissions' => [
                'managePeriods' => $canManage,
            ],
            'indicators' => $indicators,
            'indicatorFilters' => [
                'entity_type' => $indicatorEntityType !== '' ? $indicatorEntityType : null,
                'is_active' => $indicatorIsActive !== '' ? $indicatorIsActive : null,
            ],
            'indicatorOptions' => [
                'entityTypes' => [
                    KpiIndicator::ENTITY_TYPE_TEACHER,
                    KpiIndicator::ENTITY_TYPE_DEPARTMENT_HEAD,
                    KpiIndicator::ENTITY_TYPE_DEAN,
                ],
                'sections' => [
                    KpiIndicator::SECTION_TEACHING,
                    KpiIndicator::SECTION_SCIENCE,
                    KpiIndicator::SECTION_SOCIAL,
                    KpiIndicator::SECTION_QUALIFICATION,
                    KpiIndicator::SECTION_SURVEY,
                ],
                'calculationTypes' => [
                    KpiIndicator::CALCULATION_TYPE_MANUAL,
                    KpiIndicator::CALCULATION_TYPE_AUTO,
                    KpiIndicator::CALCULATION_TYPE_FORMULA,
                ],
                'divisions' => KpiStructuralUnit::query()->orderBy('name')->get(['id', 'code', 'name']),
            ],
            'indicatorPermissions' => [
                'canManage' => $this->canManageIndicators($request),
            ],
            'accessGrants' => $accessGrants,
            'accessOptions' => [
                'staff' => $staffOptions,
            ],
            'accessPermissions' => [
                'canManageFullAccess' => $this->canManageFullAccess($user),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->canManageSettings($user), 403);

        $validated = $request->validate([
            'teacher' => ['required', 'array'],
            'teacher.default_points' => ['required', 'integer', 'min:0'],
            'teacher.rules' => ['nullable', 'array'],
            'teacher.rules.*.label' => ['nullable', 'string', 'max:255'],
            'teacher.rules.*.points' => ['nullable', 'integer', 'min:0'],
            'teacher.rules.*.keywords_text' => ['nullable', 'string'],
            'hod' => ['required', 'array'],
            'hod.default_points' => ['required', 'integer', 'min:0'],
            'hod.special_points' => ['required', 'integer', 'min:0'],
            'hod.special_department_codes_text' => ['nullable', 'string'],
            'dean' => ['required', 'array'],
            'dean.points' => ['required', 'integer', 'min:0'],
        ]);

        $teacherRules = collect($validated['teacher']['rules'] ?? [])
            ->map(function (array $rule): array {
                $keywords = collect(explode(',', (string) ($rule['keywords_text'] ?? '')))
                    ->map(fn (string $keyword): string => trim($keyword))
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'label' => trim((string) ($rule['label'] ?? '')),
                    'points' => (int) ($rule['points'] ?? 0),
                    'keywords' => $keywords,
                ];
            })
            ->all();

        $specialDepartmentCodes = collect(preg_split('/[,\n]+/', (string) ($validated['hod']['special_department_codes_text'] ?? '')) ?: [])
            ->map(fn (string $code): string => trim($code))
            ->filter()
            ->values()
            ->all();

        $this->settingsService->save([
            'teacher' => [
                'default_points' => (int) $validated['teacher']['default_points'],
                'rules' => $teacherRules,
            ],
            'hod' => [
                'default_points' => (int) $validated['hod']['default_points'],
                'special_points' => (int) $validated['hod']['special_points'],
                'special_department_codes' => $specialDepartmentCodes,
            ],
            'dean' => [
                'points' => (int) $validated['dean']['points'],
            ],
        ]);

        return redirect()
            ->route('kpi.settings', ['tab' => 'settings'])
            ->with('success', 'KPI-настройки сохранены.');
    }

    public function storeAccess(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->canManageFullAccess($user), 403);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $this->grantKpiAdminBundle((int) $validated['user_id'], $user->id);

        return redirect()
            ->route('kpi.settings', ['tab' => 'access'])
            ->with('success', 'Доступ KPI-админа выдан.');
    }

    public function revokeAccess(Request $request, KpiAccessGrant $grant): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($this->canManageFullAccess($user), 403);
        abort_unless($grant->permission === KpiAccessGrant::PERM_KPI_ADMIN, 404);

        $this->revokeKpiAdminBundle((int) $grant->user_id);

        return redirect()
            ->route('kpi.settings', ['tab' => 'access'])
            ->with('success', 'Доступ KPI-админа отозван.');
    }

    private function grantKpiAdminBundle(int $targetUserId, int $grantedBy): void
    {
        foreach (KpiAccessGrant::ALL_PERMISSIONS as $permission) {
            KpiAccessGrant::query()->updateOrCreate(
                [
                    'user_id' => $targetUserId,
                    'permission' => $permission,
                    'division_id' => null,
                ],
                [
                    'granted_by' => $grantedBy,
                    'granted_at' => now(),
                    'is_active' => true,
                ],
            );
        }
    }

    private function revokeKpiAdminBundle(int $targetUserId): void
    {
        KpiAccessGrant::query()
            ->where('user_id', $targetUserId)
            ->whereIn('permission', KpiAccessGrant::ALL_PERMISSIONS)
            ->whereNull('division_id')
            ->update(['is_active' => false]);
    }

    private function canManageIndicators(Request $request): bool
    {
        $role = $request->user()?->resolvedRoleSlug();
        $userId = $request->user()?->id;

        return in_array($role, ['admin', 'teacher', 'department_head', 'hod', 'dean', 'department'], true)
            || ($userId !== null && KpiAccessGrant::userHas($userId, KpiAccessGrant::PERM_INDICATORS));
    }

    private function canManageSettings(User $user): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true)
            || KpiAccessGrant::userHasKpiAdmin($user->id);
    }

    private function canManageFullAccess(User $user): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true)
            || KpiAccessGrant::userHasKpiAdmin($user->id);
    }
}
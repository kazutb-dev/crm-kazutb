<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\KpiAccessGrant;
use App\Models\KpiStructuralUnit;
use App\Models\PositionChangeRequest;
use App\Models\User;
use App\Services\AcademicScopeResolverService;
use App\Services\ElevatedAuthorityService;
use App\Services\KpiAccessEvaluatorService;
use App\Services\OrgScopeResolverService;
use App\Services\ScopedAuthorityLedgerService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class RoleAccessController extends Controller
{
    private const STREAM_CHUNK_SIZE = 100;

    private const REVIEWER_PERMISSIONS = [
        KpiAccessGrant::PERM_REVIEW_QUEUE,
        KpiAccessGrant::PERM_APPROVAL_QUEUE,
        KpiAccessGrant::PERM_STRUCTURAL_QUEUE,
    ];

    public function __construct(
        private readonly OrgScopeResolverService $orgScopeResolver,
        private readonly ScopedAuthorityLedgerService $authorityLedger,
        private readonly KpiAccessEvaluatorService $kpiAccessEvaluator,
        private readonly ElevatedAuthorityService $elevatedAuthority,
        private readonly AcademicScopeResolverService $academicScopeResolver,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($this->canAccess($request), 403);

        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'role' => trim((string) $request->query('role', '')),
            'faculty_id' => trim((string) $request->query('faculty_id', '')),
            'department_id' => trim((string) $request->query('department_id', '')),
            'structural_unit_id' => trim((string) $request->query('structural_unit_id', '')),
            'grant' => trim((string) $request->query('grant', '')),
            'elevated' => trim((string) $request->query('elevated', '')),
            'missing_binding' => trim((string) $request->query('missing_binding', '')),
            'suspicious' => trim((string) $request->query('suspicious', '')),
            'per_page' => (int) $request->integer('per_page', 25),
            'page' => max(1, (int) $request->integer('page', 1)),
        ];

        if (! in_array($filters['per_page'], [25, 50, 100], true)) {
            $filters['per_page'] = 25;
        }

        $summary = $this->emptySummary();
        $baseSummaryQuery = $this->baseUsersQuery();
        $this->streamUserSnapshots($baseSummaryQuery, function (Collection $rows) use (&$summary): void {
            $chunkSummary = $this->buildSummary($rows);

            foreach ($chunkSummary as $key => $value) {
                $summary[$key] = ($summary[$key] ?? 0) + (int) $value;
            }
        });

        $offset = max(0, ($filters['page'] - 1) * $filters['per_page']);
        $matchedRows = 0;
        $pageItems = collect();

        $baseListingQuery = $this->baseUsersQuery();
        $this->streamUserSnapshots($baseListingQuery, function (Collection $rows) use ($filters, $offset, &$matchedRows, &$pageItems): void {
            foreach ($this->applyFilters($rows, $filters)->values() as $row) {
                $matchedRows++;

                if ($matchedRows <= $offset || $pageItems->count() >= $filters['per_page']) {
                    continue;
                }

                $pageItems->push($row);
            }
        });

        $pagination = $this->paginateCollection($pageItems, $matchedRows, $filters['per_page'], $filters['page'], $request);

        return Inertia::render('Governance/RoleAccess', [
            'summary' => $summary,
            'users' => $pagination['data'],
            'pagination' => $pagination['meta'],
            'filters' => $filters,
            'options' => [
                'roles' => $this->availableRoles(),
                'faculties' => Faculty::query()->orderBy('name')->get(['id', 'name'])->values(),
                'departments' => Department::query()->orderBy('name')->get(['id', 'name', 'faculty_id'])->values(),
                'structural_units' => KpiStructuralUnit::query()->orderBy('name')->get(['id', 'name', 'code'])->values(),
                'grant_types' => collect(KpiAccessGrant::PERMISSION_LABELS)
                    ->map(fn(string $label, string $value): array => [
                        'value' => $value,
                        'label' => $label,
                    ])
                    ->values(),
                'per_page' => [25, 50, 100],
            ],
            'permissions' => [
                'canManageFoundation' => $this->canManageFoundation($request),
            ],
        ]);
    }

    private function baseUsersQuery()
    {
        $query = User::query()
            ->with([
                'roleRef:id,slug,name',
                'position:id,name',
                'faculty:id,name',
                'department:id,name,faculty_id',
                'department.faculty:id,name',
                'kpiAccessGrants' => function ($grantQuery): void {
                    $grantQuery->where('is_active', true)->orderBy('permission');
                },
                'kpiStructuralUnits:id,name,code',
                'divisions:id,name,code',
                'employeeProfile:id,user_id,employment_status,source_system,source_external_id',
                'studentProfile:id,user_id,legacy_student_id,student_code,educational_program_id,group_id,course_number,stream_code,source_system,source_external_id,platonus_person_uid',
                'studentProfile.educationalProgram:id,name,code',
                'studentProfile.group:id,name,code',
                'academicScopeAssignments' => function ($scopeQuery): void {
                    $scopeQuery->where('scope_status', 'active')->orderByDesc('id');
                },
                'academicScopeAssignments.educationalProgram:id,name,code',
                'academicScopeAssignments.group:id,name,code',
            ])
            ->select([
                'id',
                'name',
                'display_name',
                'email',
                'ad_login',
                'ad_guid',
                'ad_title',
                'ad_department',
                'ad_division',
                'role',
                'role_id',
                'position_id',
                'position_title',
                'faculty_id',
                'department_id',
                'ad_employee_type',
                'last_login_at',
            ]);

        if (Schema::hasColumn('users', 'is_hidden')) {
            $query->where(function ($hiddenQuery): void {
                $hiddenQuery->whereNull('is_hidden')->orWhere('is_hidden', 0);
            });
        }

        return $query->orderBy('name')->orderBy('id');
    }

    private function canAccess(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        return $this->elevatedAuthority->canAccessGovernanceSurface($user)
            || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_KPI_ADMIN)
            || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_PERIODS);
    }

    private function canManageFoundation(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if ($user->resolvedRoleSlug() === 'superadmin') {
            return true;
        }

        $authority = $this->elevatedAuthority->resolveForUser($user);

        return ($authority['source'] ?? null) === 'scoped_authority'
            && (
                (bool) ($authority['has_business'] ?? false)
                || (bool) ($authority['has_technical'] ?? false)
            );
    }

    private function buildSummary(Collection $rows): array
    {
        return [
            'total_users' => $rows->count(),
            'superadmins' => $rows->where('resolved_role', 'superadmin')->count(),
            'admins' => $rows->where('resolved_role', 'admin')->count(),
            'teachers' => $rows->where('resolved_role', 'teacher')->count(),
            'students' => $rows->where('resolved_role', 'student')->count(),
            'elevated' => $rows->where('is_elevated', true)->count(),
            'business_super_admin' => $rows->where('elevated_authority.has_business', true)->count(),
            'technical_super_admin' => $rows->where('elevated_authority.has_technical', true)->count(),
            'platform_operator' => $rows->where('elevated_authority.has_operator', true)->count(),
            'employee_profiles' => $rows->where('academic_scope.employee_profile.exists', true)->count(),
            'student_profiles' => $rows->where('academic_scope.student_profile.exists', true)->count(),
            'dual_context' => $rows->where('academic_scope.dual_context', true)->count(),
            'academic_ready' => $rows->where('academic_scope.status', 'ready')->count(),
            'curator_scope' => $rows->where('academic_scope.curator_scope_exists', true)->count(),
            'registrar_scope' => $rows->where('academic_scope.registrar_scope_exists', true)->count(),
            'without_org_binding' => $rows->where('missing_binding', true)->count(),
            'suspicious' => $rows->where('is_suspicious', true)->count(),
            'kpi_mismatch' => $rows->where('kpi_authority.mismatch_count', '>', 0)->count(),
        ];
    }

    private function applyFilters(Collection $rows, array $filters): Collection
    {
        return $rows->filter(function (array $row) use ($filters): bool {
            if ($filters['q'] !== '') {
                $q = mb_strtolower($filters['q']);
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($row['full_name'] ?? ''),
                    (string) ($row['email'] ?? ''),
                    (string) ($row['ad_login'] ?? ''),
                ]));

                if (! str_contains($haystack, $q)) {
                    return false;
                }
            }

            if ($filters['role'] !== '' && $row['resolved_role'] !== $filters['role']) {
                return false;
            }

            if ($filters['faculty_id'] !== '' && (int) ($row['faculty']['id'] ?? 0) !== (int) $filters['faculty_id']) {
                return false;
            }

            if ($filters['department_id'] !== '' && (int) ($row['department']['id'] ?? 0) !== (int) $filters['department_id']) {
                return false;
            }

            if ($filters['structural_unit_id'] !== '') {
                $structuralUnitIds = collect($row['structural_units'] ?? [])->pluck('id')->map(fn($id): int => (int) $id);
                if (! $structuralUnitIds->contains((int) $filters['structural_unit_id'])) {
                    return false;
                }
            }

            if ($filters['grant'] !== '') {
                $grants = collect($row['grants'] ?? [])->pluck('permission');
                if (! $grants->contains($filters['grant'])) {
                    return false;
                }
            }

            if ($filters['elevated'] === '1' && ! $row['is_elevated']) {
                return false;
            }

            if ($filters['elevated'] === '0' && $row['is_elevated']) {
                return false;
            }

            if ($filters['missing_binding'] === '1' && ! $row['missing_binding']) {
                return false;
            }

            if ($filters['suspicious'] === '1' && ! $row['is_suspicious']) {
                return false;
            }

            return true;
        });
    }

    private function streamUserSnapshots($query, callable $consumer): void
    {
        $query->chunk(self::STREAM_CHUNK_SIZE, function (Collection $users) use ($consumer): void {
            $consumer($this->hydrateUserSnapshots($users));
        });
    }

    private function hydrateUserSnapshots(Collection $users): Collection
    {
        $resolvedOrgScopesByUser = $this->orgScopeResolver->resolveForUsers($users);
        $authoritySnapshotsByUser = $this->authorityLedger->resolveForUsers($users);
        $academicScopesByUser = $this->academicScopeResolver->resolveForUsers($users);
        $pendingPositionRequestsByUser = $this->pendingPositionRequestsByUser($users);

        return $users->map(function (User $user) use ($pendingPositionRequestsByUser, $resolvedOrgScopesByUser, $authoritySnapshotsByUser, $academicScopesByUser): array {
            return $this->buildUserSnapshot(
                $user,
                $pendingPositionRequestsByUser,
                $resolvedOrgScopesByUser[(int) $user->id] ?? null,
                $authoritySnapshotsByUser[(int) $user->id] ?? null,
                $academicScopesByUser[(int) $user->id] ?? null,
            );
        })->values();
    }

    private function pendingPositionRequestsByUser(Collection $users): Collection
    {
        if (! Schema::hasTable('position_change_requests') || $users->isEmpty()) {
            return collect();
        }

        return PositionChangeRequest::query()
            ->where('status', 'pending')
            ->whereIn('user_id', $users->pluck('id')->all())
            ->select(['id', 'user_id', 'created_at'])
            ->get()
            ->groupBy('user_id');
    }

    private function emptySummary(): array
    {
        return [
            'total_users' => 0,
            'superadmins' => 0,
            'admins' => 0,
            'teachers' => 0,
            'students' => 0,
            'elevated' => 0,
            'business_super_admin' => 0,
            'technical_super_admin' => 0,
            'platform_operator' => 0,
            'employee_profiles' => 0,
            'student_profiles' => 0,
            'dual_context' => 0,
            'academic_ready' => 0,
            'curator_scope' => 0,
            'registrar_scope' => 0,
            'without_org_binding' => 0,
            'suspicious' => 0,
            'kpi_mismatch' => 0,
        ];
    }

    private function paginateCollection(Collection $items, int $total, int $perPage, int $page, Request $request): array
    {
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min($page, $lastPage);
        $from = $total > 0 ? (($currentPage - 1) * $perPage) + 1 : null;
        $to = $total > 0 ? min($currentPage * $perPage, $total) : null;

        $paginator = new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $currentPage,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ]
        );

        return [
            'data' => $items,
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'from' => $from,
                'to' => $to,
            ],
        ];
    }

    private function availableRoles(): Collection
    {
        $labels = [
            'superadmin' => 'Суперадмин',
            'admin' => 'Администратор',
            'teacher' => 'Преподаватель',
            'hod' => 'Завед. кафедрой',
            'dean' => 'Декан',
            'structural' => 'Структурное подразделение',
            'student' => 'Студент',
            'department' => 'Департаменты',
        ];

        return collect($labels)
            ->map(fn(string $label, string $role): array => [
                'value' => $role,
                'label' => $label,
            ])
            ->values();
    }

    private function buildUserSnapshot(
        User $user,
        Collection $pendingPositionRequestsByUser,
        ?array $resolvedOrgScope = null,
        ?array $authoritySnapshot = null,
        ?array $academicScope = null
    ): array {
        $resolvedRole = $user->resolvedRoleSlug();
        $rawRole = is_string($user->role) ? trim($user->role) : null;
        $roleRefSlug = $user->roleRef?->slug;
        $roleStatus = $this->resolveRoleStatus($rawRole, $roleRefSlug, $resolvedRole);

        $grants = $user->kpiAccessGrants
            ->map(function (KpiAccessGrant $grant): array {
                return [
                    'id' => $grant->id,
                    'permission' => $grant->permission,
                    'label' => KpiAccessGrant::PERMISSION_LABELS[$grant->permission] ?? $grant->permission,
                    'division_id' => $grant->division_id,
                    'granted_at' => $grant->granted_at?->toIso8601String(),
                ];
            })
            ->values();

        $structuralUnits = $user->kpiStructuralUnits
            ->map(fn($unit): array => [
                'id' => $unit->id,
                'name' => $unit->name,
                'code' => $unit->code,
            ])
            ->values();

        $isElevatedRole = in_array($resolvedRole, ['admin', 'superadmin'], true);
        $hasElevatedGrant = $grants->pluck('permission')->intersect([
            KpiAccessGrant::PERM_KPI_ADMIN,
            KpiAccessGrant::PERM_REVIEW_QUEUE,
            KpiAccessGrant::PERM_APPROVAL_QUEUE,
            KpiAccessGrant::PERM_STRUCTURAL_QUEUE,
            KpiAccessGrant::PERM_PERIODS,
        ])->isNotEmpty();
        $isElevated = $isElevatedRole || $hasElevatedGrant;

        $missingBinding = $this->hasMissingBinding($resolvedRole, $grants, $structuralUnits, $user);

        $effectiveAccess = $this->effectiveAccessReasons($user, $resolvedRole, $grants, $structuralUnits);
        if (is_array($resolvedOrgScope) && ! empty($resolvedOrgScope['primary_scope']['org_unit']['name'])) {
            $effectiveAccess[] = 'Resolved org scope: ' . (string) $resolvedOrgScope['primary_scope']['org_unit']['name'];
        }
        $effectiveAccess = array_values(array_unique($effectiveAccess));

        $pendingRequests = $pendingPositionRequestsByUser->get($user->id, collect());
        $hasPendingPositionRequest = $pendingRequests->isNotEmpty();

        $kpiAuthority = $this->buildKpiAuthorityDiagnostics(
            $user,
            $resolvedOrgScope,
            $authoritySnapshot,
            $hasPendingPositionRequest
        );

        $elevatedAuthority = $this->elevatedAuthority->resolveForUser($user, $authoritySnapshot);

        foreach ($kpiAuthority['sources'] as $source) {
            $effectiveAccess[] = 'KPI authority source: ' . $source;
        }

        foreach (($elevatedAuthority['categories'] ?? []) as $category) {
            $effectiveAccess[] = 'Elevated category: ' . $category;
        }

        foreach (($academicScope['assignment_types'] ?? []) as $assignmentType) {
            $effectiveAccess[] = 'Academic assignment: ' . $assignmentType;
        }

        $effectiveAccess = array_values(array_unique($effectiveAccess));

        $riskFlags = $this->riskFlags(
            $user,
            $resolvedRole,
            $rawRole,
            $roleRefSlug,
            $grants,
            $structuralUnits,
            $missingBinding,
            $pendingRequests,
            $resolvedOrgScope,
            $elevatedAuthority,
            $academicScope
        );

        if (($kpiAuthority['mismatch_count'] ?? 0) > 0) {
            $riskFlags->push($this->flag(
                'kpi_legacy_governance_mismatch',
                'KPI legacy and governance decisions are mismatched',
                'high'
            ));
        }

        $faculty = $user->faculty;
        $department = $user->department;

        return [
            'id' => $user->id,
            'full_name' => $user->display_name ?: $user->name,
            'email' => $user->email,
            'ad_login' => $user->ad_login,
            'sync_state' => ($user->ad_guid || $user->ad_login) ? 'ad' : 'local',
            'resolved_role' => $resolvedRole,
            'resolved_role_label' => $this->roleLabel($resolvedRole),
            'raw_role' => $rawRole,
            'role_id' => $user->role_id,
            'role_ref_slug' => $roleRefSlug,
            'role_status' => $roleStatus,
            'faculty' => $faculty ? ['id' => $faculty->id, 'name' => $faculty->name] : null,
            'department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'position' => $user->position?->name ?: $user->position_title ?: $user->ad_title,
            'ad_title' => $user->ad_title,
            'ad_department' => $user->ad_department,
            'ad_division' => $user->ad_division,
            'structural_units' => $structuralUnits,
            'grants' => $grants,
            'is_elevated' => $isElevated,
            'missing_binding' => $missingBinding,
            'effective_access' => $effectiveAccess,
            'resolved_org_scope' => $resolvedOrgScope ?? [
                'status' => 'missing',
                'status_label' => 'Scope missing',
                'primary_scope' => null,
                'resolved_units' => [],
                'missing_mappings' => [],
                'inconsistencies' => [],
                'sources_total' => 0,
                'resolved_total' => 0,
            ],
            'kpi_authority' => $kpiAuthority,
            'elevated_authority' => $elevatedAuthority,
            'academic_scope' => $academicScope ?? [
                'status' => 'missing',
                'status_label' => 'Academic scope missing',
                'employee_profile' => ['exists' => false],
                'student_profile' => ['exists' => false],
                'dual_context' => false,
                'assignment_types' => [],
                'active_scope_assignments' => [],
                'curator_scope_exists' => false,
                'registrar_scope_exists' => false,
                'academic_admin_scope_exists' => false,
                'pending_academic_requests' => 0,
                'platonus_readiness' => [
                    'upstream_source' => (string) config('academic.upstream_source', 'platonus_read_only'),
                    'has_upstream_external_id' => false,
                    'direct_authority_allowed' => (bool) config('academic.allow_upstream_direct_authority', false),
                ],
                'risk_flags' => [],
            ],
            'pending_position_requests' => $pendingRequests->count(),
            'is_suspicious' => $riskFlags->isNotEmpty(),
            'risk_flags' => $riskFlags->values(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
        ];
    }

    /**
     * @param array<string, mixed>|null $resolvedOrgScope
     * @param array<string, mixed>|null $authoritySnapshot
     * @return array<string, mixed>
     */
    private function buildKpiAuthorityDiagnostics(
        User $user,
        ?array $resolvedOrgScope,
        ?array $authoritySnapshot,
        bool $hasPendingPositionRequest
    ): array {
        $decisions = collect(self::REVIEWER_PERMISSIONS)
            ->mapWithKeys(function (string $permission) use ($user, $resolvedOrgScope, $authoritySnapshot, $hasPendingPositionRequest): array {
                return [
                    $permission => $this->kpiAccessEvaluator->evaluateQueueAccess(
                        $user,
                        $permission,
                        $resolvedOrgScope,
                        $authoritySnapshot,
                        $hasPendingPositionRequest,
                    ),
                ];
            });

        $mismatchCount = $decisions->filter(
            fn(array $decision): bool => (bool) ($decision['legacy_allow'] ?? false) !== (bool) ($decision['governance_allow'] ?? false)
        )->count();

        $sources = $decisions
            ->map(fn(array $decision): string => (string) ($decision['authority_source'] ?? 'none'))
            ->filter(fn(string $source): bool => $source !== 'none')
            ->unique()
            ->values();

        return [
            'position_confirmed' => ! $hasPendingPositionRequest,
            'mismatch_count' => $mismatchCount,
            'sources' => $sources->all(),
            'legacy_allow_count' => $decisions->filter(fn(array $decision): bool => (bool) ($decision['legacy_allow'] ?? false))->count(),
            'governance_allow_count' => $decisions->filter(fn(array $decision): bool => (bool) ($decision['governance_allow'] ?? false))->count(),
            'queue' => $decisions->all(),
        ];
    }

    private function roleLabel(string $role): string
    {
        return match ($role) {
            'rector' => 'Ректор',
            'vice_rector', 'vice-rector', 'prorector' => 'Проректор',
            'superadmin' => 'Суперадмин',
            'admin' => 'Администратор',
            'teacher' => 'Преподаватель',
            'hod', 'department_head' => 'Завед. кафедрой',
            'dean' => 'Декан',
            'structural' => 'Структурное подразделение',
            'student' => 'Студент',
            'department' => 'Департаменты',
            default => 'Без роли',
        };
    }

    private function resolveRoleStatus(?string $rawRole, ?string $roleRefSlug, string $resolvedRole): string
    {
        $normalizedRaw = $this->normalizeRoleSlug($rawRole);
        $normalizedRef = $this->normalizeRoleSlug($roleRefSlug);

        if ($normalizedRaw === null && $normalizedRef === null) {
            return 'missing';
        }

        if ($normalizedRaw !== null && $normalizedRef !== null && $normalizedRaw !== $normalizedRef) {
            return 'mismatch';
        }

        $reference = $normalizedRaw ?? $normalizedRef;

        if ($reference !== null && $reference !== $resolvedRole) {
            return 'derived';
        }

        return 'aligned';
    }

    private function normalizeRoleSlug(?string $value): ?string
    {
        $normalized = strtolower(trim((string) $value));

        if ($normalized === '') {
            return null;
        }

        return match ($normalized) {
            'department_head' => 'hod',
            'department' => 'structural',
            default => $normalized,
        };
    }

    private function hasMissingBinding(string $resolvedRole, Collection $grants, Collection $structuralUnits, User $user): bool
    {
        if (in_array($resolvedRole, ['hod', 'department_head'], true) && $user->department_id === null) {
            return true;
        }

        if ($resolvedRole === 'dean' && $user->faculty_id === null) {
            return true;
        }

        if (($resolvedRole === 'structural' || $grants->pluck('permission')->contains(KpiAccessGrant::PERM_STRUCTURAL_QUEUE))
            && $structuralUnits->isEmpty()
        ) {
            return true;
        }

        return false;
    }

    private function effectiveAccessReasons(User $user, string $resolvedRole, Collection $grants, Collection $structuralUnits): array
    {
        $reasons = [];

        if (in_array($resolvedRole, ['admin', 'superadmin'], true)) {
            $reasons[] = 'Административная роль (' . $this->roleLabel($resolvedRole) . ')';
        }

        foreach ($grants as $grant) {
            $reasons[] = 'Grant: ' . ($grant['label'] ?? $grant['permission']);
        }

        if ($resolvedRole === 'hod' && $user->department) {
            $reasons[] = 'Org scope: кафедра ' . $user->department->name;
        }

        if ($resolvedRole === 'dean' && $user->faculty) {
            $reasons[] = 'Org scope: факультет ' . $user->faculty->name;
        }

        if ($structuralUnits->isNotEmpty()) {
            $reasons[] = 'Structural scope: ' . $structuralUnits->pluck('name')->implode(', ');
        }

        return array_values(array_unique($reasons));
    }

    private function riskFlags(
        User $user,
        string $resolvedRole,
        ?string $rawRole,
        ?string $roleRefSlug,
        Collection $grants,
        Collection $structuralUnits,
        bool $missingBinding,
        Collection $pendingRequests,
        ?array $resolvedOrgScope = null,
        ?array $elevatedAuthority = null,
        ?array $academicScope = null
    ): Collection {
        $flags = collect();

        $roleStatus = $this->resolveRoleStatus($rawRole, $roleRefSlug, $resolvedRole);

        if ($roleStatus === 'mismatch') {
            $flags->push($this->flag('role_mismatch', 'Role и role_id не совпадают', 'high'));
        }

        if ($roleStatus === 'missing') {
            $flags->push($this->flag('missing_role_source', 'Отсутствуют role и role_id', 'high'));
        }

        if ($missingBinding) {
            $flags->push($this->flag('missing_binding', 'Недостаточная org-привязка для текущего scope', 'high'));
        }

        $permissions = $grants->pluck('permission');

        if ($permissions->intersect(self::REVIEWER_PERMISSIONS)->isNotEmpty() && ! $this->hasReviewerScope($resolvedRole, $permissions, $structuralUnits, $user)) {
            $flags->push($this->flag('reviewer_scope_gap', 'Есть reviewer grant без полного scope', 'critical'));
        }

        if ($permissions->contains(KpiAccessGrant::PERM_KPI_ADMIN) && $user->faculty_id === null && $user->department_id === null && $structuralUnits->isEmpty()) {
            $flags->push($this->flag('overprivileged_unscoped', 'Повышенные права без org scope', 'critical'));
        }

        if ($permissions->isNotEmpty() && $resolvedRole === 'teacher' && $user->role_id === null) {
            $flags->push($this->flag('grant_without_primary_role', 'Есть grants при нефиксированной role_id', 'high'));
        }

        if ($permissions->contains(KpiAccessGrant::PERM_STRUCTURAL_QUEUE) && $structuralUnits->isEmpty()) {
            $flags->push($this->flag('structural_without_assignment', 'Structural grant без привязки к структурным единицам', 'high'));
        }

        if ($user->department && $user->faculty && (int) $user->department->faculty_id !== (int) $user->faculty->id) {
            $flags->push($this->flag('department_faculty_mismatch', 'Кафедра не соответствует выбранному факультету', 'medium'));
        }

        if ($pendingRequests->isNotEmpty()) {
            $flags->push($this->flag('pending_position_change', 'Есть pending-заявка на смену должности', 'medium'));
        }

        if (is_array($resolvedOrgScope)) {
            if (($resolvedOrgScope['status'] ?? null) === 'missing') {
                $flags->push($this->flag('org_scope_missing', 'Org scope resolver: scope не определен', 'high'));
            }

            if (! empty($resolvedOrgScope['missing_mappings'] ?? [])) {
                $flags->push($this->flag('org_scope_unmapped_sources', 'Есть legacy источники без mapping в org_units', 'high'));
            }

            if (! empty($resolvedOrgScope['inconsistencies'] ?? [])) {
                $flags->push($this->flag('org_scope_inconsistency', 'Resolver обнаружил конфликт scope', 'medium'));
            }
        }

        if (is_array($elevatedAuthority)) {
            if (($elevatedAuthority['mixed_elevated'] ?? false) === true) {
                $flags->push($this->flag('mixed_elevated_authority', 'Смешанные elevated-полномочия (business/technical/operator)', 'medium'));
            }

            if (($elevatedAuthority['legacy_broad'] ?? false) === true && ($elevatedAuthority['source'] ?? '') !== 'scoped_authority') {
                $flags->push($this->flag('legacy_elevated_fallback', 'Используется legacy broad elevation без явного scoped capability', 'high'));
            }

            if (($elevatedAuthority['has_operator'] ?? false) === true
                && ($elevatedAuthority['has_business'] ?? false) === false
                && ($elevatedAuthority['has_technical'] ?? false) === false
            ) {
                $flags->push($this->flag('operator_without_governance_boundary', 'Platform operator без governance boundary', 'medium'));
            }
        }

        if (is_array($academicScope)) {
            foreach (($academicScope['risk_flags'] ?? []) as $risk) {
                if (! is_array($risk)) {
                    continue;
                }

                $flags->push($this->flag(
                    (string) ($risk['code'] ?? 'academic_scope_risk'),
                    (string) ($risk['label'] ?? 'Academic scope risk detected'),
                    (string) ($risk['severity'] ?? 'medium')
                ));
            }

            if (($academicScope['status'] ?? 'missing') === 'missing') {
                $flags->push($this->flag('academic_scope_missing', 'Academic scope не определен', 'medium'));
            }

            if (($academicScope['dual_context'] ?? false) === true && ($academicScope['active_scope_assignments'] ?? []) === []) {
                $flags->push($this->flag('dual_context_without_active_academic_scope', 'Dual context без активного academic scope assignment', 'medium'));
            }
        }

        return $flags;
    }

    private function hasReviewerScope(string $resolvedRole, Collection $permissions, Collection $structuralUnits, User $user): bool
    {
        if (in_array($resolvedRole, ['admin', 'superadmin'], true)) {
            return true;
        }

        if ($permissions->contains(KpiAccessGrant::PERM_REVIEW_QUEUE) && $user->department_id !== null) {
            return true;
        }

        if ($permissions->contains(KpiAccessGrant::PERM_APPROVAL_QUEUE) && $user->faculty_id !== null) {
            return true;
        }

        if ($permissions->contains(KpiAccessGrant::PERM_STRUCTURAL_QUEUE) && $structuralUnits->isNotEmpty()) {
            return true;
        }

        return false;
    }

    private function flag(string $code, string $label, string $severity): array
    {
        return [
            'code' => $code,
            'label' => $label,
            'severity' => $severity,
        ];
    }
}

<?php

namespace App\Services;

use App\Models\AcademicScopeAssignment;
use App\Models\Department;
use App\Models\EducationalProgram;
use App\Models\GovernanceAccessRequest;
use App\Models\Group;
use App\Models\KpiAccessGrant;
use App\Models\KpiStructuralUnit;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GovernanceAccessRequestService
{
    public function submitAcademicScopeAssignmentRequest(
        User $subject,
        User $actor,
        string $assignmentType,
        array $scope,
        ?string $comment = null,
        string $origin = 'unknown'
    ): ?GovernanceAccessRequest {
        $allowedTypes = collect(config('academic.assignment_types', []))
            ->map(fn($value): string => (string) $value)
            ->values()
            ->all();

        if (! in_array($assignmentType, $allowedTypes, true)) {
            throw ValidationException::withMessages([
                'assignment_type' => 'Неподдерживаемый тип academic scope assignment.',
            ]);
        }

        $normalizedScope = $this->normalizeAcademicScopePayload($scope);

        if (! collect([
            $normalizedScope['faculty_id'],
            $normalizedScope['department_id'],
            $normalizedScope['educational_program_id'],
            $normalizedScope['group_id'],
            $normalizedScope['course_number'],
            $normalizedScope['stream_code'],
        ])->contains(fn($value): bool => $value !== null && $value !== '')) {
            throw ValidationException::withMessages([
                'scope' => 'Нужно указать хотя бы один academic scope dimension.',
            ]);
        }

        $effectiveScope = $this->currentAcademicScopePayload($subject, $assignmentType, $normalizedScope);

        if ($effectiveScope === $normalizedScope) {
            return null;
        }

        $authorityScope = $this->resolveAcademicAuthorityScope(
            $subject,
            $normalizedScope['faculty_id'],
            $normalizedScope['department_id'],
            $normalizedScope['faculty_id']
        );

        $authorityScope['assignment_type'] = $assignmentType;
        $authorityScope['scope_dimensions'] = array_filter([
            'educational_program_id' => $normalizedScope['educational_program_id'],
            'group_id' => $normalizedScope['group_id'],
            'course_number' => $normalizedScope['course_number'],
            'stream_code' => $normalizedScope['stream_code'],
        ], fn($value): bool => $value !== null && $value !== '');

        return $this->submitRequest(
            GovernanceAccessRequest::TYPE_ACADEMIC_SCOPE,
            $subject,
            $actor,
            $effectiveScope,
            $normalizedScope,
            GovernanceAccessRequest::ROUTE_ACADEMIC,
            $authorityScope,
            $origin,
            $comment,
        );
    }

    public function submitPositionRequest(
        User $subject,
        User $actor,
        ?int $positionId,
        ?string $comment = null,
        string $origin = 'unknown'
    ): ?GovernanceAccessRequest {
        $effectivePositionId = $subject->position_id ? (int) $subject->position_id : null;
        $requestedPositionId = $positionId ?: null;

        if ($effectivePositionId === $requestedPositionId) {
            return null;
        }

        $position = $requestedPositionId ? Position::query()->findOrFail($requestedPositionId) : null;
        $authorityScope = $this->resolvePositionAuthorityScope($subject, $position);

        return $this->submitRequest(
            GovernanceAccessRequest::TYPE_POSITION,
            $subject,
            $actor,
            [
                'position_id' => $effectivePositionId,
                'position_title' => $subject->position_title ?: $subject->ad_title,
            ],
            [
                'position_id' => $requestedPositionId,
                'position_title' => $position?->name,
            ],
            GovernanceAccessRequest::ROUTE_HR,
            $authorityScope,
            $origin,
            $comment,
        );
    }

    public function submitAcademicRequest(
        User $subject,
        User $actor,
        ?int $facultyId,
        ?int $departmentId,
        ?string $comment = null,
        string $origin = 'unknown'
    ): ?GovernanceAccessRequest {
        $requestedFacultyId = $facultyId ?: null;
        $requestedDepartmentId = $departmentId ?: null;

        if (
            (int) ($subject->faculty_id ?? 0) === (int) ($requestedFacultyId ?? 0)
            && (int) ($subject->department_id ?? 0) === (int) ($requestedDepartmentId ?? 0)
        ) {
            return null;
        }

        $departmentFacultyId = $requestedDepartmentId
            ? Department::query()->whereKey($requestedDepartmentId)->value('faculty_id')
            : null;

        if ($requestedDepartmentId !== null && $requestedFacultyId !== null && (int) $departmentFacultyId !== (int) $requestedFacultyId) {
            throw ValidationException::withMessages([
                'department_id' => 'Выбранная кафедра не принадлежит указанному факультету.',
            ]);
        }

        $effectiveFacultyId = $subject->faculty_id ? (int) $subject->faculty_id : null;
        $effectiveDepartmentId = $subject->department_id ? (int) $subject->department_id : null;

        $authorityScope = $this->resolveAcademicAuthorityScope(
            $subject,
            $requestedFacultyId,
            $requestedDepartmentId,
            $departmentFacultyId
        );

        return $this->submitRequest(
            GovernanceAccessRequest::TYPE_ACADEMIC,
            $subject,
            $actor,
            [
                'faculty_id' => $effectiveFacultyId,
                'department_id' => $effectiveDepartmentId,
            ],
            [
                'faculty_id' => $requestedFacultyId ?? $departmentFacultyId,
                'department_id' => $requestedDepartmentId,
            ],
            GovernanceAccessRequest::ROUTE_ACADEMIC,
            $authorityScope,
            $origin,
            $comment,
        );
    }

    /**
     * @param array<int> $structuralUnitIds
     */
    public function submitStructuralRequest(
        User $subject,
        User $actor,
        array $structuralUnitIds,
        ?string $comment = null,
        string $origin = 'unknown'
    ): ?GovernanceAccessRequest {
        $requestedUnitIds = collect($structuralUnitIds)
            ->map(fn($id): int => (int) $id)
            ->filter(fn(int $id): bool => $id > 0)
            ->unique()
            ->sort()
            ->values();

        $effectiveUnitIds = $subject->kpiStructuralUnits()
            ->pluck('kpi_structural_units.id')
            ->map(fn($id): int => (int) $id)
            ->sort()
            ->values();

        if ($effectiveUnitIds->values()->all() === $requestedUnitIds->values()->all()) {
            return null;
        }

        $requestedUnits = KpiStructuralUnit::query()
            ->whereIn('id', $requestedUnitIds->all())
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        $authorityScope = $this->resolveStructuralAuthorityScope($subject, $requestedUnits);

        return $this->submitRequest(
            GovernanceAccessRequest::TYPE_STRUCTURAL,
            $subject,
            $actor,
            [
                'structural_unit_ids' => $effectiveUnitIds->all(),
            ],
            [
                'structural_unit_ids' => $requestedUnitIds->all(),
            ],
            GovernanceAccessRequest::ROUTE_STRUCTURAL,
            $authorityScope,
            $origin,
            $comment,
        );
    }

    public function approve(GovernanceAccessRequest $request, User $approver, ?string $reviewComment = null, ?string $overrideReason = null): GovernanceAccessRequest
    {
        if (! $request->isPending()) {
            throw ValidationException::withMessages([
                'request' => 'Заявка уже обработана.',
            ]);
        }

        if (! $this->canReview($approver, $request)) {
            throw ValidationException::withMessages([
                'request' => 'У вас нет прав на согласование этой заявки.',
            ]);
        }

        return DB::transaction(function () use ($request, $approver, $reviewComment, $overrideReason): GovernanceAccessRequest {
            /** @var User $subject */
            $subject = $request->subjectUser()->lockForUpdate()->firstOrFail();
            $approvedValue = $request->requested_value ?? [];

            $this->applyEffectiveChange($request, $subject);

            $request->forceFill([
                'status' => GovernanceAccessRequest::STATUS_APPROVED,
                'approver_id' => $approver->id,
                'approved_value' => $approvedValue,
                'effective_value' => $approvedValue,
                'review_comment' => $reviewComment,
                'override_reason' => $overrideReason,
                'approved_at' => now(),
                'effective_applied_at' => now(),
                'rejected_at' => null,
            ])->save();

            return $request->fresh(['subjectUser', 'requester', 'approver']);
        });
    }

    public function reject(GovernanceAccessRequest $request, User $approver, string $rejectionReason, ?string $reviewComment = null, ?string $overrideReason = null): GovernanceAccessRequest
    {
        if (! $request->isPending()) {
            throw ValidationException::withMessages([
                'request' => 'Заявка уже обработана.',
            ]);
        }

        if (! $this->canReview($approver, $request)) {
            throw ValidationException::withMessages([
                'request' => 'У вас нет прав на согласование этой заявки.',
            ]);
        }

        $request->forceFill([
            'status' => GovernanceAccessRequest::STATUS_REJECTED,
            'approver_id' => $approver->id,
            'approved_value' => null,
            'review_comment' => $reviewComment,
            'rejection_reason' => $rejectionReason,
            'override_reason' => $overrideReason,
            'rejected_at' => now(),
            'approved_at' => null,
        ])->save();

        return $request->fresh(['subjectUser', 'requester', 'approver']);
    }

    public function canReview(User $actor, GovernanceAccessRequest $request): bool
    {
        if (in_array($actor->resolvedRoleSlug(), ['admin', 'superadmin'], true)) {
            return true;
        }

        $scope = collect($request->authority_scope ?? []);

        return match ($request->authority_route) {
            GovernanceAccessRequest::ROUTE_HR => KpiAccessGrant::userHasKpiAdmin((int) $actor->id),
            GovernanceAccessRequest::ROUTE_ACADEMIC => $this->matchesAcademicAuthority($actor, $scope),
            GovernanceAccessRequest::ROUTE_STRUCTURAL => $this->matchesStructuralAuthority($actor, $scope),
            default => false,
        };
    }

    public function visibleTo(User $actor): Builder
    {
        $query = GovernanceAccessRequest::query();

        if (in_array($actor->resolvedRoleSlug(), ['admin', 'superadmin'], true) || KpiAccessGrant::userHasKpiAdmin((int) $actor->id)) {
            return $query;
        }

        return $query->where(function (Builder $nested) use ($actor): void {
            $nested->where('subject_user_id', $actor->id)
                ->orWhere('requested_by', $actor->id);
        });
    }

    /**
     * @param array<string, mixed> $currentValue
     * @param array<string, mixed> $requestedValue
     * @param array<string, mixed> $authorityScope
     */
    private function submitRequest(
        string $requestType,
        User $subject,
        User $actor,
        array $currentValue,
        array $requestedValue,
        string $authorityRoute,
        array $authorityScope,
        string $origin,
        ?string $comment
    ): GovernanceAccessRequest {
        $existing = GovernanceAccessRequest::query()
            ->where('subject_user_id', $subject->id)
            ->where('request_type', $requestType)
            ->where('status', GovernanceAccessRequest::STATUS_PENDING)
            ->latest('id')
            ->first();

        if ($existing) {
            if (($existing->requested_value ?? []) === $requestedValue) {
                return $existing;
            }

            throw ValidationException::withMessages([
                'request' => 'У пользователя уже есть активная заявка этого типа.',
            ]);
        }

        return GovernanceAccessRequest::query()->create([
            'request_type' => $requestType,
            'subject_user_id' => $subject->id,
            'requested_by' => $actor->id,
            'origin' => $origin,
            'authority_route' => $authorityRoute,
            'authority_scope' => $authorityScope,
            'current_value' => $currentValue,
            'requested_value' => $requestedValue,
            'approved_value' => null,
            'effective_value' => $currentValue,
            'request_comment' => $comment,
            'status' => GovernanceAccessRequest::STATUS_PENDING,
            'metadata' => [
                'authorization_core' => [
                    'identity_source' => config('academic.identity_source', 'ad'),
                    'academic_context_source' => config('academic.upstream_source', 'platonus_read_only'),
                    'authorization_source' => config('academic.permission_source', 'crm_governance'),
                    'effective_data_rule' => 'authorization_uses_effective_values_only',
                ],
                'candidate_approver_ids' => $authorityScope['candidate_approver_ids'] ?? [],
                'candidate_approvers' => $authorityScope['candidate_approvers'] ?? [],
            ],
        ]);
    }

    private function applyEffectiveChange(GovernanceAccessRequest $request, User $subject): void
    {
        $requested = $request->requested_value ?? [];

        match ($request->request_type) {
            GovernanceAccessRequest::TYPE_POSITION,
            GovernanceAccessRequest::TYPE_POSITION_CHANGE,
            GovernanceAccessRequest::TYPE_DEGREE_CHANGE,
            GovernanceAccessRequest::TYPE_TITLE_CHANGE => $subject->forceFill([
                'position_id' => Arr::get($requested, 'position_id'),
                'position_title' => Arr::get($requested, 'position_title'),
                'position_confirmed' => false,
            ])->save(),
            GovernanceAccessRequest::TYPE_ACADEMIC => $subject->forceFill([
                'faculty_id' => Arr::get($requested, 'faculty_id'),
                'department_id' => Arr::get($requested, 'department_id'),
            ])->save(),
            GovernanceAccessRequest::TYPE_FACULTY_CHANGE => $subject->forceFill([
                'faculty_id' => Arr::get($requested, 'faculty_id'),
            ])->save(),
            GovernanceAccessRequest::TYPE_DEPARTMENT_CHANGE => $subject->forceFill([
                'department_id' => Arr::get($requested, 'department_id'),
            ])->save(),
            GovernanceAccessRequest::TYPE_ACADEMIC_SCOPE => $this->applyAcademicScopeAssignment($request, $subject, $requested),
            GovernanceAccessRequest::TYPE_STRUCTURAL,
            GovernanceAccessRequest::TYPE_DIVISION_CHANGE => $subject->kpiStructuralUnits()->sync(Arr::get($requested, 'structural_unit_ids', [])),
            default => throw ValidationException::withMessages([
                'request' => 'Неподдерживаемый тип governance-заявки.',
            ]),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function resolvePositionAuthorityScope(User $subject, ?Position $position): array
    {
        $approvers = $this->adminAndKpiAdminApprovers();

        return [
            'route_label' => GovernanceAccessRequest::ROUTE_LABELS[GovernanceAccessRequest::ROUTE_HR],
            'target_position' => $position ? ['id' => $position->id, 'name' => $position->name] : null,
            'subject_faculty_id' => $subject->faculty_id,
            'subject_department_id' => $subject->department_id,
            'candidate_approver_ids' => $approvers->pluck('id')->all(),
            'candidate_approvers' => $this->formatApprovers($approvers),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveAcademicAuthorityScope(User $subject, ?int $facultyId, ?int $departmentId, ?int $departmentFacultyId): array
    {
        $effectiveFacultyId = $facultyId ?? $departmentFacultyId ?? ($subject->faculty_id ? (int) $subject->faculty_id : null);
        $effectiveDepartmentId = $departmentId ?? ($subject->department_id ? (int) $subject->department_id : null);

        $approvers = User::query()
            ->with('roleRef:id,slug,name')
            ->where(function (Builder $query) use ($effectiveFacultyId, $effectiveDepartmentId): void {
                $query->whereIn('role', ['admin', 'superadmin', 'dean', 'hod', 'department_head']);

                if ($effectiveFacultyId !== null) {
                    $query->orWhere(function (Builder $nested) use ($effectiveFacultyId): void {
                        $nested->where('faculty_id', $effectiveFacultyId)
                            ->whereIn('role', ['dean', 'admin', 'superadmin']);
                    });
                }

                if ($effectiveDepartmentId !== null) {
                    $query->orWhere(function (Builder $nested) use ($effectiveDepartmentId): void {
                        $nested->where('department_id', $effectiveDepartmentId)
                            ->whereIn('role', ['hod', 'department_head', 'admin', 'superadmin']);
                    });
                }
            })
            ->orderBy('name')
            ->get(['id', 'name', 'display_name', 'email', 'role', 'faculty_id', 'department_id']);

        return [
            'route_label' => GovernanceAccessRequest::ROUTE_LABELS[GovernanceAccessRequest::ROUTE_ACADEMIC],
            'target_faculty_id' => $effectiveFacultyId,
            'target_department_id' => $effectiveDepartmentId,
            'candidate_approver_ids' => $approvers->pluck('id')->all(),
            'candidate_approvers' => $this->formatApprovers($approvers),
        ];
    }

    /**
     * @param Collection<int, KpiStructuralUnit> $requestedUnits
     * @return array<string, mixed>
     */
    private function resolveStructuralAuthorityScope(User $subject, Collection $requestedUnits): array
    {
        $unitIds = $requestedUnits->pluck('id')->map(fn($id): int => (int) $id)->values();

        if ($unitIds->isEmpty()) {
            $unitIds = $subject->kpiStructuralUnits()
                ->pluck('kpi_structural_units.id')
                ->map(fn($id): int => (int) $id)
                ->values();
        }

        $approvers = User::query()
            ->with('roleRef:id,slug,name')
            ->where(function (Builder $query) use ($unitIds): void {
                $query->whereIn('role', ['admin', 'superadmin', 'structural']);

                if ($unitIds->isNotEmpty()) {
                    $query->orWhereHas('kpiStructuralUnits', function (Builder $nested) use ($unitIds): void {
                        $nested->whereIn('kpi_structural_units.id', $unitIds->all());
                    });
                }
            })
            ->orderBy('name')
            ->get(['id', 'name', 'display_name', 'email', 'role']);

        return [
            'route_label' => GovernanceAccessRequest::ROUTE_LABELS[GovernanceAccessRequest::ROUTE_STRUCTURAL],
            'target_structural_unit_ids' => $unitIds->all(),
            'target_structural_units' => $requestedUnits
                ->map(fn(KpiStructuralUnit $unit): array => ['id' => $unit->id, 'name' => $unit->name, 'code' => $unit->code])
                ->values()
                ->all(),
            'candidate_approver_ids' => $approvers->pluck('id')->all(),
            'candidate_approvers' => $this->formatApprovers($approvers),
        ];
    }

    private function matchesAcademicAuthority(User $actor, Collection $scope): bool
    {
        $role = $actor->resolvedRoleSlug();
        $targetFacultyId = $scope->get('target_faculty_id');
        $targetDepartmentId = $scope->get('target_department_id');

        if ($role === 'dean' && $targetFacultyId !== null && (int) $actor->faculty_id === (int) $targetFacultyId) {
            return true;
        }

        return in_array($role, ['hod', 'department_head'], true)
            && $targetDepartmentId !== null
            && (int) $actor->department_id === (int) $targetDepartmentId;
    }

    /**
     * @param array<string, mixed> $scope
     * @return array<string, mixed>
     */
    private function normalizeAcademicScopePayload(array $scope): array
    {
        $inputFacultyId = Arr::get($scope, 'faculty_id');
        $departmentId = Arr::get($scope, 'department_id');
        $groupId = Arr::get($scope, 'group_id');
        $programId = Arr::get($scope, 'educational_program_id');

        $derivedFacultyId = null;
        if ($departmentId) {
            $derivedFacultyId = Department::query()->whereKey((int) $departmentId)->value('faculty_id');
        } elseif ($programId) {
            $derivedFacultyId = EducationalProgram::query()
                ->join('departments', 'departments.id', '=', 'educational_programs.department_id')
                ->where('educational_programs.id', (int) $programId)
                ->value('departments.faculty_id');
        } elseif ($groupId) {
            $derivedFacultyId = Group::query()
                ->join('departments', 'departments.id', '=', 'groups.department_id')
                ->where('groups.id', (int) $groupId)
                ->value('departments.faculty_id');
        }

        if (
            $inputFacultyId !== null
            && $inputFacultyId !== ''
            && $derivedFacultyId !== null
            && (int) $inputFacultyId !== (int) $derivedFacultyId
        ) {
            throw ValidationException::withMessages([
                'faculty_id' => 'Выбранный факультет не соответствует выбранной кафедре/программе/группе.',
            ]);
        }

        return [
            'assignment_type' => (string) Arr::get($scope, 'assignment_type'),
            'faculty_id' => Arr::get($scope, 'faculty_id') ? (int) Arr::get($scope, 'faculty_id') : ($derivedFacultyId ? (int) $derivedFacultyId : null),
            'department_id' => $departmentId ? (int) $departmentId : null,
            'educational_program_id' => $programId ? (int) $programId : null,
            'group_id' => $groupId ? (int) $groupId : null,
            'course_number' => Arr::get($scope, 'course_number') !== null ? (int) Arr::get($scope, 'course_number') : null,
            'stream_code' => ($streamCode = trim((string) Arr::get($scope, 'stream_code', ''))) !== '' ? $streamCode : null,
            'starts_at' => Arr::get($scope, 'starts_at'),
            'ends_at' => Arr::get($scope, 'ends_at'),
            'scope_status' => AcademicScopeAssignment::STATUS_ACTIVE,
        ];
    }

    /**
     * @param array<string, mixed> $normalizedScope
     * @return array<string, mixed>
     */
    private function currentAcademicScopePayload(User $subject, string $assignmentType, array $normalizedScope): array
    {
        $existing = AcademicScopeAssignment::query()
            ->where('user_id', $subject->id)
            ->where('assignment_type', $assignmentType)
            ->where('faculty_id', $normalizedScope['faculty_id'])
            ->where('department_id', $normalizedScope['department_id'])
            ->where('educational_program_id', $normalizedScope['educational_program_id'])
            ->where('group_id', $normalizedScope['group_id'])
            ->where('course_number', $normalizedScope['course_number'])
            ->where('stream_code', $normalizedScope['stream_code'])
            ->latest('id')
            ->first();

        if (! $existing) {
            return [
                'assignment_type' => $assignmentType,
                'faculty_id' => null,
                'department_id' => null,
                'educational_program_id' => null,
                'group_id' => null,
                'course_number' => null,
                'stream_code' => null,
                'starts_at' => null,
                'ends_at' => null,
                'scope_status' => null,
            ];
        }

        return [
            'assignment_type' => $existing->assignment_type,
            'faculty_id' => $existing->faculty_id,
            'department_id' => $existing->department_id,
            'educational_program_id' => $existing->educational_program_id,
            'group_id' => $existing->group_id,
            'course_number' => $existing->course_number,
            'stream_code' => $existing->stream_code,
            'starts_at' => $existing->starts_at?->toIso8601String(),
            'ends_at' => $existing->ends_at?->toIso8601String(),
            'scope_status' => $existing->scope_status,
        ];
    }

    /**
     * @param array<string, mixed> $requested
     */
    private function applyAcademicScopeAssignment(GovernanceAccessRequest $request, User $subject, array $requested): void
    {
        AcademicScopeAssignment::query()->updateOrCreate(
            [
                'user_id' => $subject->id,
                'assignment_type' => (string) Arr::get($requested, 'assignment_type'),
                'faculty_id' => Arr::get($requested, 'faculty_id'),
                'department_id' => Arr::get($requested, 'department_id'),
                'educational_program_id' => Arr::get($requested, 'educational_program_id'),
                'group_id' => Arr::get($requested, 'group_id'),
                'course_number' => Arr::get($requested, 'course_number'),
                'stream_code' => Arr::get($requested, 'stream_code'),
            ],
            [
                'scope_status' => AcademicScopeAssignment::STATUS_ACTIVE,
                'source_system' => 'crm_governance',
                'governance_request_id' => $request->id,
                'approved_by' => $request->approver_id,
                'starts_at' => Arr::get($requested, 'starts_at'),
                'ends_at' => Arr::get($requested, 'ends_at'),
                'metadata' => [
                    'origin' => $request->origin,
                    'authority_route' => $request->authority_route,
                ],
            ]
        );
    }

    private function matchesStructuralAuthority(User $actor, Collection $scope): bool
    {
        $unitIds = collect($scope->get('target_structural_unit_ids', []))
            ->map(fn($id): int => (int) $id)
            ->filter();

        if ($actor->resolvedRoleSlug() !== 'structural' || $unitIds->isEmpty()) {
            return false;
        }

        return $actor->kpiStructuralUnits()
            ->whereIn('kpi_structural_units.id', $unitIds->all())
            ->exists();
    }

    /**
     * @return Collection<int, User>
     */
    private function adminAndKpiAdminApprovers(): Collection
    {
        return User::query()
            ->with('roleRef:id,slug,name')
            ->where(function (Builder $query): void {
                $query->whereIn('role', ['admin', 'superadmin'])
                    ->orWhereHas('kpiAccessGrants', function (Builder $nested): void {
                        $nested->where('permission', KpiAccessGrant::PERM_KPI_ADMIN)
                            ->where('is_active', true);
                    });
            })
            ->orderBy('name')
            ->get(['id', 'name', 'display_name', 'email', 'role']);
    }

    /**
     * @param Collection<int, User> $users
     * @return array<int, array<string, mixed>>
     */
    private function formatApprovers(Collection $users): array
    {
        return $users
            ->unique('id')
            ->values()
            ->map(fn(User $user): array => [
                'id' => $user->id,
                'name' => $user->display_name ?: $user->name,
                'email' => $user->email,
                'role' => $user->resolvedRoleSlug(),
                'role_label' => $user->resolveRoleLabel(),
            ])
            ->all();
    }
}

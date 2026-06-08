<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\EducationalProgram;
use App\Models\Faculty;
use App\Models\GovernanceAccessRequest;
use App\Models\Group;
use App\Models\KpiAccessGrant;
use App\Models\KpiStructuralUnit;
use App\Models\Position;
use App\Models\User;
use App\Services\BusinessActivityLogger;
use App\Services\ElevatedAuthorityService;
use App\Services\GovernanceAccessRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class GovernanceAccessRequestController extends Controller
{
    public function __construct(
        private readonly GovernanceAccessRequestService $requestService,
        private readonly BusinessActivityLogger $activityLogger,
        private readonly ElevatedAuthorityService $elevatedAuthority,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($this->canAccessQueue($request), 403);

        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'status' => trim((string) $request->query('status', GovernanceAccessRequest::STATUS_PENDING)),
            'request_type' => trim((string) $request->query('request_type', '')),
            'authority_route' => trim((string) $request->query('authority_route', '')),
            'ownership' => trim((string) $request->query('ownership', 'review')),
            'per_page' => max(10, min(100, (int) $request->integer('per_page', 25))),
            'page' => max(1, (int) $request->integer('page', 1)),
        ];

        $actor = $request->user();

        $query = $this->baseRequestsQuery($filters, $actor);
        $summary = $this->buildSummary($query);
        $paginator = $this->paginateRequests($query, $filters, $request);
        $requestRows = $this->transformRequests($paginator->getCollection(), $actor);

        return Inertia::render('Governance/AccessRequests', [
            'filters' => $filters,
            'requests' => $requestRows,
            'pagination' => $this->paginationMeta($paginator),
            'summary' => $summary,
            'options' => [
                'request_types' => collect(GovernanceAccessRequest::TYPE_LABELS)
                    ->map(fn(string $label, string $value): array => ['value' => $value, 'label' => $label])
                    ->values(),
                'authority_routes' => collect(GovernanceAccessRequest::ROUTE_LABELS)
                    ->map(fn(string $label, string $value): array => ['value' => $value, 'label' => $label])
                    ->values(),
            ],
            'permissions' => [
                'canManageFoundation' => $this->canManageFoundation($request),
            ],
        ]);
    }

    public function approve(Request $request, GovernanceAccessRequest $governanceAccessRequest): RedirectResponse
    {
        abort_unless($this->requestService->canReview($request->user(), $governanceAccessRequest), 403);
        $decision = $this->abortUnlessDangerousActionAllowed($request, 'governance_access_request_decision');

        $data = $request->validate([
            'review_comment' => ['nullable', 'string', 'max:2000'],
            'reason' => ($decision['reason_required'] ?? false)
                ? ['required', 'string', 'min:8', 'max:500']
                : ['nullable', 'string', 'max:500'],
        ]);

        $approved = $this->requestService->approve(
            $governanceAccessRequest,
            $request->user(),
            $data['review_comment'] ?? null,
            isset($data['reason']) ? trim((string) $data['reason']) : null,
        );

        $this->activityLogger->log(
            'governance_request_approved',
            'Governance request approved',
            $approved,
            [
                'request_type' => $approved->request_type,
                'subject_user_id' => $approved->subject_user_id,
                'authority_route' => $approved->authority_route,
                'authority_decision' => $decision,
            ],
            $request->user(),
            $request,
        );

        return back()->with('success', 'Заявка одобрена, effective data обновлены.');
    }

    public function storeAcademicScope(Request $request): RedirectResponse
    {
        abort_unless($this->canAccessQueue($request), 403);

        $data = $request->validate([
            'subject_user_id' => ['required', 'integer', 'exists:users,id'],
            'assignment_type' => ['required', 'string', 'in:student,curator,registrar,academic_admin,faculty_admin'],
            'faculty_id' => ['nullable', 'integer', 'exists:faculties,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'educational_program_id' => ['nullable', 'integer', 'exists:educational_programs,id'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'course_number' => ['nullable', 'integer', 'min:1', 'max:12'],
            'stream_code' => ['nullable', 'string', 'max:120'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'request_comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $subject = \App\Models\User::query()->findOrFail((int) $data['subject_user_id']);

        $created = $this->requestService->submitAcademicScopeAssignmentRequest(
            $subject,
            $request->user(),
            (string) $data['assignment_type'],
            $data,
            $data['request_comment'] ?? null,
            'governance_academic_scope_admin'
        );

        return back()->with('success', $created ? 'Academic scope request создан.' : 'Изменений для academic scope не обнаружено.');
    }

    public function reject(Request $request, GovernanceAccessRequest $governanceAccessRequest): RedirectResponse
    {
        abort_unless($this->requestService->canReview($request->user(), $governanceAccessRequest), 403);
        $decision = $this->abortUnlessDangerousActionAllowed($request, 'governance_access_request_decision');

        $data = $request->validate([
            'review_comment' => ['nullable', 'string', 'max:2000'],
            'rejection_reason' => ['required', 'string', 'min:5', 'max:2000'],
            'reason' => ($decision['reason_required'] ?? false)
                ? ['required', 'string', 'min:8', 'max:500']
                : ['nullable', 'string', 'max:500'],
        ]);

        $rejected = $this->requestService->reject(
            $governanceAccessRequest,
            $request->user(),
            trim((string) $data['rejection_reason']),
            $data['review_comment'] ?? null,
            isset($data['reason']) ? trim((string) $data['reason']) : null,
        );

        $this->activityLogger->log(
            'governance_request_rejected',
            'Governance request rejected',
            $rejected,
            [
                'request_type' => $rejected->request_type,
                'subject_user_id' => $rejected->subject_user_id,
                'authority_route' => $rejected->authority_route,
                'authority_decision' => $decision,
            ],
            $request->user(),
            $request,
        );

        return back()->with('success', 'Заявка отклонена.');
    }

    private function canAccessQueue(Request $request): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        if ($this->elevatedAuthority->canAccessGovernanceSurface($user)) {
            return true;
        }

        $role = $user?->resolvedRoleSlug();

        if (in_array($role, ['admin', 'superadmin', 'structural', 'dean', 'hod', 'department_head'], true)) {
            return true;
        }

        return $user !== null && KpiAccessGrant::userHasKpiAdmin((int) $user->id);
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

    /**
     * @return array<string, mixed>
     */
    private function abortUnlessDangerousActionAllowed(Request $request, string $action): array
    {
        $user = $request->user();
        abort_unless($user, 403);

        $decision = $this->elevatedAuthority->evaluateDangerousAction($user, $action);

        if (! ($decision['allow'] ?? false)) {
            abort(403, 'Недостаточно категориальных elevated-полномочий.');
        }

        return $decision;
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function baseRequestsQuery(array $filters, ?User $actor): Builder
    {
        $query = GovernanceAccessRequest::query()
            ->with([
                'subjectUser:id,name,display_name,email,faculty_id,department_id,position_id',
                'requester:id,name,display_name,email',
                'approver:id,name,display_name,email',
            ]);

        if ($filters['status'] !== '') {
            $query->where('status', $filters['status']);
        }

        if ($filters['request_type'] !== '') {
            $query->where('request_type', $filters['request_type']);
        }

        if ($filters['authority_route'] !== '') {
            $query->where('authority_route', $filters['authority_route']);
        }

        if ($filters['q'] !== '') {
            $this->applySearchFilter($query, $filters['q']);
        }

        if ($actor && $filters['ownership'] === 'mine') {
            $query->where(function (Builder $nested) use ($actor): void {
                $nested->where('requested_by', $actor->id)
                    ->orWhere('subject_user_id', $actor->id);
            });
        }

        if ($actor && $filters['ownership'] === 'review') {
            $this->applyReviewableFilter($query, $actor);
        }

        return $query;
    }

    private function applySearchFilter(Builder $query, string $search): void
    {
        $needle = mb_strtolower($search);
        $like = '%' . addcslashes($search, '\\%_') . '%';
        $matchingTypes = collect(GovernanceAccessRequest::TYPE_LABELS)
            ->filter(fn(string $label): bool => str_contains(mb_strtolower($label), $needle))
            ->keys()
            ->values()
            ->all();

        $query->where(function (Builder $nested) use ($like, $matchingTypes): void {
            $nested
                ->whereHas('subjectUser', fn(Builder $userQuery): Builder => $this->applyUserSearchFilter($userQuery, $like))
                ->orWhereHas('requester', fn(Builder $userQuery): Builder => $this->applyUserSearchFilter($userQuery, $like));

            if (! empty($matchingTypes)) {
                $nested->orWhereIn('request_type', $matchingTypes);
            }
        });
    }

    private function applyUserSearchFilter(Builder $query, string $like): Builder
    {
        return $query->where(function (Builder $nested) use ($like): void {
            $nested->where('display_name', 'like', $like)
                ->orWhere('name', 'like', $like)
                ->orWhere('email', 'like', $like);
        });
    }

    private function applyReviewableFilter(Builder $query, User $actor): void
    {
        $role = $actor->resolvedRoleSlug();

        if (in_array($role, ['admin', 'superadmin'], true)) {
            return;
        }

        $isKpiAdmin = KpiAccessGrant::userHasKpiAdmin((int) $actor->id);
        $facultyId = $actor->faculty_id ? (int) $actor->faculty_id : null;
        $departmentId = $actor->department_id ? (int) $actor->department_id : null;
        $structuralUnitIds = $role === 'structural'
            ? $actor->kpiStructuralUnits()->pluck('kpi_structural_units.id')->map(fn($id): int => (int) $id)->all()
            : [];

        $hasReviewScope = $isKpiAdmin
            || ($role === 'dean' && $facultyId !== null)
            || (in_array($role, ['hod', 'department_head'], true) && $departmentId !== null)
            || ($role === 'structural' && ! empty($structuralUnitIds));

        if (! $hasReviewScope) {
            $query->whereRaw('0 = 1');
            return;
        }

        $query->where(function (Builder $nested) use ($isKpiAdmin, $role, $facultyId, $departmentId, $structuralUnitIds): void {
            if ($isKpiAdmin) {
                $nested->orWhere('authority_route', GovernanceAccessRequest::ROUTE_HR);
            }

            if ($role === 'dean' && $facultyId !== null) {
                $nested->orWhere(function (Builder $routeQuery) use ($facultyId): void {
                    $routeQuery->where('authority_route', GovernanceAccessRequest::ROUTE_ACADEMIC)
                        ->where('authority_scope->target_faculty_id', $facultyId);
                });
            }

            if (in_array($role, ['hod', 'department_head'], true) && $departmentId !== null) {
                $nested->orWhere(function (Builder $routeQuery) use ($departmentId): void {
                    $routeQuery->where('authority_route', GovernanceAccessRequest::ROUTE_ACADEMIC)
                        ->where('authority_scope->target_department_id', $departmentId);
                });
            }

            if ($role === 'structural' && ! empty($structuralUnitIds)) {
                $nested->orWhere(function (Builder $routeQuery) use ($structuralUnitIds): void {
                    $routeQuery->where('authority_route', GovernanceAccessRequest::ROUTE_STRUCTURAL)
                        ->where(function (Builder $scopeQuery) use ($structuralUnitIds): void {
                            foreach ($structuralUnitIds as $unitId) {
                                $scopeQuery->orWhereJsonContains('authority_scope->target_structural_unit_ids', $unitId);
                            }
                        });
                });
            }
        });
    }

    /**
     * @param Collection<int, GovernanceAccessRequest> $requests
     * @return array<int, array<string, mixed>>
     */
    private function transformRequests(Collection $requests, ?User $actor): array
    {
        $positionIds = $requests->flatMap(function (GovernanceAccessRequest $request): array {
            return array_filter([
                (int) ($request->current_value['position_id'] ?? 0),
                (int) ($request->requested_value['position_id'] ?? 0),
                (int) ($request->approved_value['position_id'] ?? 0),
                (int) ($request->effective_value['position_id'] ?? 0),
            ]);
        })->unique()->values();

        $facultyIds = $requests->flatMap(function (GovernanceAccessRequest $request): array {
            return array_filter([
                (int) ($request->current_value['faculty_id'] ?? 0),
                (int) ($request->requested_value['faculty_id'] ?? 0),
                (int) ($request->approved_value['faculty_id'] ?? 0),
                (int) ($request->effective_value['faculty_id'] ?? 0),
            ]);
        })->unique()->values();

        $departmentIds = $requests->flatMap(function (GovernanceAccessRequest $request): array {
            return array_filter([
                (int) ($request->current_value['department_id'] ?? 0),
                (int) ($request->requested_value['department_id'] ?? 0),
                (int) ($request->approved_value['department_id'] ?? 0),
                (int) ($request->effective_value['department_id'] ?? 0),
            ]);
        })->unique()->values();

        $programIds = $requests->flatMap(function (GovernanceAccessRequest $request): array {
            return array_filter([
                (int) ($request->current_value['educational_program_id'] ?? 0),
                (int) ($request->requested_value['educational_program_id'] ?? 0),
                (int) ($request->approved_value['educational_program_id'] ?? 0),
                (int) ($request->effective_value['educational_program_id'] ?? 0),
            ]);
        })->unique()->values();

        $groupIds = $requests->flatMap(function (GovernanceAccessRequest $request): array {
            return array_filter([
                (int) ($request->current_value['group_id'] ?? 0),
                (int) ($request->requested_value['group_id'] ?? 0),
                (int) ($request->approved_value['group_id'] ?? 0),
                (int) ($request->effective_value['group_id'] ?? 0),
            ]);
        })->unique()->values();

        $structuralIds = $requests->flatMap(function (GovernanceAccessRequest $request): array {
            return array_merge(
                $request->current_value['structural_unit_ids'] ?? [],
                $request->requested_value['structural_unit_ids'] ?? [],
                $request->approved_value['structural_unit_ids'] ?? [],
                $request->effective_value['structural_unit_ids'] ?? [],
            );
        })->map(fn($id): int => (int) $id)->filter()->unique()->values();

        $positions = Position::query()->whereIn('id', $positionIds->all())->pluck('name', 'id');
        $faculties = Faculty::query()->whereIn('id', $facultyIds->all())->pluck('name', 'id');
        $departments = Department::query()->whereIn('id', $departmentIds->all())->pluck('name', 'id');
        $programs = EducationalProgram::query()->whereIn('id', $programIds->all())->pluck('name', 'id');
        $groups = Group::query()->whereIn('id', $groupIds->all())->pluck('name', 'id');
        $structuralUnits = KpiStructuralUnit::query()->whereIn('id', $structuralIds->all())->pluck('name', 'id');

        return $requests->map(function (GovernanceAccessRequest $item) use ($positions, $faculties, $departments, $programs, $groups, $structuralUnits, $actor): array {
            return [
                'id' => $item->id,
                'request_type' => $item->request_type,
                'request_type_label' => $item->typeLabel(),
                'authority_route' => $item->authority_route,
                'authority_route_label' => $item->routeLabel(),
                'origin' => $item->origin,
                'status' => $item->status,
                'status_label' => $item->statusLabel(),
                'subject_user' => [
                    'id' => $item->subjectUser?->id,
                    'name' => $item->subjectUser?->display_name ?: $item->subjectUser?->name,
                    'email' => $item->subjectUser?->email,
                ],
                'requested_by_user' => [
                    'id' => $item->requester?->id,
                    'name' => $item->requester?->display_name ?: $item->requester?->name,
                    'email' => $item->requester?->email,
                ],
                'approver_user' => $item->approver ? [
                    'id' => $item->approver->id,
                    'name' => $item->approver->display_name ?: $item->approver->name,
                    'email' => $item->approver->email,
                ] : null,
                'current_value' => $this->humanizeValue($item->request_type, $item->current_value ?? [], $positions, $faculties, $departments, $programs, $groups, $structuralUnits),
                'requested_value' => $this->humanizeValue($item->request_type, $item->requested_value ?? [], $positions, $faculties, $departments, $programs, $groups, $structuralUnits),
                'approved_value' => $this->humanizeValue($item->request_type, $item->approved_value ?? [], $positions, $faculties, $departments, $programs, $groups, $structuralUnits),
                'effective_value' => $this->humanizeValue($item->request_type, $item->effective_value ?? [], $positions, $faculties, $departments, $programs, $groups, $structuralUnits),
                'request_comment' => $item->request_comment,
                'review_comment' => $item->review_comment,
                'rejection_reason' => $item->rejection_reason,
                'override_reason' => $item->override_reason,
                'authority_scope' => $item->authority_scope,
                'can_review' => $actor !== null && $this->requestService->canReview($actor, $item),
                'is_mine' => (int) $item->requested_by === (int) $actor?->id || (int) $item->subject_user_id === (int) $actor?->id,
                'created_at' => $item->created_at?->toIso8601String(),
                'approved_at' => $item->approved_at?->toIso8601String(),
                'rejected_at' => $item->rejected_at?->toIso8601String(),
                'effective_applied_at' => $item->effective_applied_at?->toIso8601String(),
            ];
        })->all();
    }

    /**
     * @param array<string, mixed> $value
     * @return array<string, mixed>
     */
    private function humanizeValue(
        string $type,
        array $value,
        Collection $positions,
        Collection $faculties,
        Collection $departments,
        Collection $programs,
        Collection $groups,
        Collection $structuralUnits,
    ): array {
        return match ($type) {
            GovernanceAccessRequest::TYPE_POSITION,
            GovernanceAccessRequest::TYPE_POSITION_CHANGE,
            GovernanceAccessRequest::TYPE_DEGREE_CHANGE,
            GovernanceAccessRequest::TYPE_TITLE_CHANGE => [
                'position_id' => $value['position_id'] ?? null,
                'position_title' => $value['position_title'] ?? ($positions->get((int) ($value['position_id'] ?? 0)) ?: null),
            ],
            GovernanceAccessRequest::TYPE_ACADEMIC,
            GovernanceAccessRequest::TYPE_FACULTY_CHANGE,
            GovernanceAccessRequest::TYPE_DEPARTMENT_CHANGE => [
                'faculty_id' => $value['faculty_id'] ?? null,
                'faculty_name' => ($value['faculty_id'] ?? null) ? $faculties->get((int) $value['faculty_id']) : null,
                'department_id' => $value['department_id'] ?? null,
                'department_name' => ($value['department_id'] ?? null) ? $departments->get((int) $value['department_id']) : null,
            ],
            GovernanceAccessRequest::TYPE_ACADEMIC_SCOPE => [
                'assignment_type' => $value['assignment_type'] ?? null,
                'assignment_type_label' => $value['assignment_type'] ? (\App\Models\AcademicScopeAssignment::TYPE_LABELS[$value['assignment_type']] ?? $value['assignment_type']) : null,
                'faculty_id' => $value['faculty_id'] ?? null,
                'faculty_name' => ($value['faculty_id'] ?? null) ? $faculties->get((int) $value['faculty_id']) : null,
                'department_id' => $value['department_id'] ?? null,
                'department_name' => ($value['department_id'] ?? null) ? $departments->get((int) $value['department_id']) : null,
                'educational_program_id' => $value['educational_program_id'] ?? null,
                'educational_program_name' => ($value['educational_program_id'] ?? null) ? $programs->get((int) $value['educational_program_id']) : null,
                'group_id' => $value['group_id'] ?? null,
                'group_name' => ($value['group_id'] ?? null) ? $groups->get((int) $value['group_id']) : null,
                'course_number' => $value['course_number'] ?? null,
                'stream_code' => $value['stream_code'] ?? null,
            ],
            GovernanceAccessRequest::TYPE_STRUCTURAL,
            GovernanceAccessRequest::TYPE_DIVISION_CHANGE => [
                'structural_unit_ids' => collect($value['structural_unit_ids'] ?? [])->map(fn($id): int => (int) $id)->values()->all(),
                'structural_unit_names' => collect($value['structural_unit_ids'] ?? [])
                    ->map(fn($id): ?string => $structuralUnits->get((int) $id))
                    ->filter()
                    ->values()
                    ->all(),
            ],
            default => $value,
        };
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function paginateRequests(Builder $query, array &$filters, Request $request): LengthAwarePaginator
    {
        $paginator = (clone $query)
            ->latest('id')
            ->paginate($filters['per_page'], ['*'], 'page', $filters['page'])
            ->withPath($request->url())
            ->appends($request->query());

        if ($paginator->total() > 0 && $paginator->currentPage() > $paginator->lastPage()) {
            $filters['page'] = $paginator->lastPage();

            $paginator = (clone $query)
                ->latest('id')
                ->paginate($filters['per_page'], ['*'], 'page', $filters['page'])
                ->withPath($request->url())
                ->appends($request->query());
        }

        return $paginator;
    }

    private function paginationMeta(LengthAwarePaginator $paginator): array
    {
        return [
            'total' => $paginator->total(),
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }

    private function buildSummary(Builder $query): array
    {
        return [
            'total' => (clone $query)->count(),
            'pending' => (clone $query)->where('status', GovernanceAccessRequest::STATUS_PENDING)->count(),
            'approved' => (clone $query)->where('status', GovernanceAccessRequest::STATUS_APPROVED)->count(),
            'rejected' => (clone $query)->where('status', GovernanceAccessRequest::STATUS_REJECTED)->count(),
        ];
    }
}

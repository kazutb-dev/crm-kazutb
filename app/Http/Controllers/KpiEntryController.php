<?php

namespace App\Http\Controllers;

use App\Exceptions\Kpi\KpiEntryException;
use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiStatusLog;
use App\Models\User;
use App\Services\KpiEntryFileService;
use App\Services\KpiEntryService;
use App\Services\KpiPeriodService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class KpiEntryController extends Controller
{
    public function __construct(
        private readonly KpiEntryService $entryService,
        private readonly KpiEntryFileService $fileService,
        private readonly KpiPeriodService $periodService,
    ) {
    }

    public function myForm(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);

        /** @var User $user */
        $user = $request->user();
        $stage = trim((string) $request->query('stage', KpiPeriod::STAGE_PLAN));
        $academicYearId = $request->integer('academic_year_id');
        $status = trim((string) $request->query('status', ''));
        $module = trim((string) $request->query('module', ''));
        $groupCode = trim((string) $request->query('group_code', ''));

        $period = $this->periodService->getCurrentOpenPeriod(
            $stage,
            $academicYearId > 0 ? $academicYearId : null,
        );

        $indicatorCollection = KpiIndicator::query()
            ->active()
            ->forEntityType(KpiIndicator::ENTITY_TYPE_TEACHER)
            ->ordered()
            ->get(['id', 'section', 'code', 'name', 'unit', 'requires_file', 'calculation_type']);

        $indicators = $indicatorCollection->map(function (KpiIndicator $indicator): array {
            return [
                'id' => $indicator->id,
                'section' => $indicator->section,
                'module_label' => $this->teacherModuleLabel($indicator->section),
                'group_code' => $this->resolveGroupCode((string) $indicator->code),
                'code' => $indicator->code,
                'name' => $indicator->name,
                'unit' => $indicator->unit,
                'requires_file' => $indicator->requiresFile(),
                'calculation_type' => $indicator->calculation_type,
            ];
        })->values();

        $entriesQuery = KpiEntry::query()
            ->with([
                'indicator:id,section,code,name,unit,requires_file',
                'files:id,kpi_entry_id,file_name,file_path,file_disk,file_type,file_size,uploaded_by',
            ])
            ->forUser($user->id)
            ->forEntityType(KpiEntry::ENTITY_TYPE_TEACHER)
            ->when($period?->id !== null, fn (Builder $query) => $query->where('kpi_period_id', $period->id))
            ->when($status !== '', fn (Builder $query) => $query->where('status', $status))
            ->when($module !== '', fn (Builder $query) => $query->whereHas('indicator', fn (Builder $query) => $query->where('section', $module)))
            ->when($groupCode !== '', fn (Builder $query) => $query->whereHas('indicator', fn (Builder $query) => $query->where('code', 'like', $groupCode . '.%')))
            ->latest('id');

        $entries = $entriesQuery
            ->paginate(15)
            ->withQueryString();

        $summaryQuery = KpiEntry::query()
            ->forUser($user->id)
            ->forEntityType(KpiEntry::ENTITY_TYPE_TEACHER)
            ->when($period?->id !== null, fn (Builder $query) => $query->where('kpi_period_id', $period->id));

        $modules = $indicators
            ->pluck('section')
            ->unique()
            ->map(fn ($section): array => [
                'value' => $section,
                'label' => $this->teacherModuleLabel((string) $section),
            ])
            ->values();

        $groupCodesByModule = [];
        foreach ($modules as $moduleItem) {
            $section = (string) ($moduleItem['value'] ?? '');
            $groupCodesByModule[$section] = $indicators
                ->where('section', $section)
                ->pluck('group_code')
                ->filter()
                ->unique()
                ->sort()
                ->values()
                ->map(fn ($code): array => ['value' => $code, 'label' => $code])
                ->all();
        }

        if ($request->expectsJson()) {
            return response()->json([
                'data' => [
                    'period' => $period,
                    'summary' => [
                        'total_points' => (float) ((clone $summaryQuery)->sum(DB::raw('COALESCE(manual_points, calculated_points, 0)'))),
                        'total_entries' => (int) ((clone $summaryQuery)->count()),
                        'draft_entries' => (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_DRAFT)->count()),
                        'submitted_entries' => (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_SUBMITTED)->count()),
                    ],
                    'entries' => $entries,
                    'indicators' => $indicators,
                    'modules' => $modules,
                    'groupCodesByModule' => $groupCodesByModule,
                    'stageOptions' => [
                        KpiPeriod::STAGE_PLAN,
                        KpiPeriod::STAGE_FACT,
                        KpiPeriod::STAGE_REVIEW,
                    ],
                ],
            ]);
        }

        return Inertia::render('Kpi/TeacherDashboard', [
            'period' => $period,
            'summary' => [
                'total_points' => (float) ((clone $summaryQuery)->sum(DB::raw('COALESCE(manual_points, calculated_points, 0)'))),
                'total_entries' => (int) ((clone $summaryQuery)->count()),
                'draft_entries' => (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_DRAFT)->count()),
                'submitted_entries' => (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_SUBMITTED)->count()),
            ],
            'entries' => $entries,
            'indicators' => $indicators,
            'modules' => $modules,
            'groupCodesByModule' => $groupCodesByModule,
            'stageOptions' => [
                KpiPeriod::STAGE_PLAN,
                KpiPeriod::STAGE_FACT,
                KpiPeriod::STAGE_REVIEW,
            ],
            'statusOptions' => [
                KpiEntry::STATUS_DRAFT,
                KpiEntry::STATUS_SUBMITTED,
                KpiEntry::STATUS_RETURNED,
                KpiEntry::STATUS_APPROVED,
                KpiEntry::STATUS_REJECTED,
            ],
            'filters' => [
                'stage' => $stage,
                'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
                'status' => $status !== '' ? $status : null,
                'module' => $module !== '' ? $module : null,
                'group_code' => $groupCode !== '' ? $groupCode : null,
            ],
            'permissions' => [
                'canManage' => $user->resolvedRoleSlug() === 'teacher',
            ],
        ]);
    }

    public function storeMyEntry(Request $request): RedirectResponse|JsonResponse
    {
        $this->authorize('create', KpiEntry::class);

        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'stage' => ['required', 'string', Rule::in([
                KpiPeriod::STAGE_PLAN,
                KpiPeriod::STAGE_FACT,
            ])],
            'indicator_id' => ['required', 'integer', 'exists:kpi_indicators,id'],
            'value' => ['nullable', 'numeric'],
            'comment' => ['nullable', 'string'],
            'external_source_url' => ['nullable', 'url', 'max:2048'],
            'file' => ['nullable', 'file', 'max:10240'],
            'action' => ['required', 'string', Rule::in(['draft', 'submit'])],
        ]);

        $indicator = KpiIndicator::query()
            ->active()
            ->forEntityType(KpiIndicator::ENTITY_TYPE_TEACHER)
            ->whereKey((int) $data['indicator_id'])
            ->first();

        if (!$indicator) {
            return $this->errorResponse($request, 'Индикатор для преподавателя не найден или неактивен.');
        }

        $period = $this->periodService->getCurrentOpenPeriod((string) $data['stage']);
        if (!$period) {
            return $this->errorResponse($request, 'Нет активного KPI-периода для выбранного этапа.');
        }

        $userFacultyId = $this->userFacultyId($user);
        $userDepartmentId = $this->userDepartmentId($user);

        try {
            $entry = DB::transaction(function () use ($user, $data, $period, $indicator, $userFacultyId, $userDepartmentId): KpiEntry {
                /** @var KpiEntry $entry */
                $entry = KpiEntry::query()->firstOrNew([
                    'kpi_period_id' => $period->id,
                    'academic_year_id' => $period->academic_year_id,
                    'entity_type' => KpiEntry::ENTITY_TYPE_TEACHER,
                    'user_id' => $user->id,
                    'faculty_id' => $userFacultyId,
                    'department_id' => $userDepartmentId,
                    'indicator_id' => $indicator->id,
                ]);

                if ($entry->exists && !$entry->canBeEdited()) {
                    throw new \RuntimeException('Эту KPI-запись нельзя редактировать в текущем статусе.');
                }

                if ((string) $data['stage'] === KpiPeriod::STAGE_PLAN) {
                    $entry->plan_value = $data['value'];
                }

                if ((string) $data['stage'] === KpiPeriod::STAGE_FACT) {
                    $entry->fact_value = $data['value'];
                }

                $entry->comment = $data['comment'] ?? null;
                $entry->external_source_url = $data['external_source_url'] ?? null;
                $entry->status = $entry->exists ? $entry->status : KpiEntry::STATUS_DRAFT;
                $entry->save();

                if (array_key_exists('file', $data) && $data['file'] !== null) {
                    $this->fileService->upload($entry, $data['file'], $user->id);
                }

                if ((string) $data['action'] === 'submit') {
                    if ($indicator->requiresFile() && !$entry->files()->exists()) {
                        throw new \RuntimeException('Для этого индикатора требуется файл. Сохраните черновик и загрузите файл перед отправкой.');
                    }

                    if (!$entry->canBeSubmitted()) {
                        throw new \RuntimeException('Запись нельзя отправить в текущем статусе.');
                    }

                    $fromStatus = $entry->status;
                    $entry->status = KpiEntry::STATUS_SUBMITTED;
                    $entry->submitted_at = Carbon::now();
                    $entry->save();

                    KpiStatusLog::query()->create([
                        'kpi_entry_id' => $entry->id,
                        'from_status' => $fromStatus,
                        'to_status' => KpiEntry::STATUS_SUBMITTED,
                        'action' => KpiStatusLog::ACTION_SUBMIT,
                        'acted_by' => $user->id,
                    ]);
                }

                return $entry->refresh();
            });
        } catch (\Throwable $e) {
            return $this->errorResponse($request, $e->getMessage());
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => (string) $data['action'] === 'submit'
                    ? 'KPI-запись отправлена на проверку.'
                    : 'KPI-запись сохранена как черновик.',
                'data' => $entry,
            ]);
        }

        return back()->with('success', (string) $data['action'] === 'submit'
            ? 'KPI-запись отправлена на проверку.'
            : 'KPI-запись сохранена как черновик.');
    }

    public function updateMyEntry(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('update', $entry);

        $data = $request->validate([
            'stage' => ['required', 'string', Rule::in([
                KpiPeriod::STAGE_PLAN,
                KpiPeriod::STAGE_FACT,
            ])],
            'value' => ['nullable', 'numeric'],
            'comment' => ['nullable', 'string'],
        ]);

        $entry->loadMissing('period');

        if ((string) $data['stage'] === KpiPeriod::STAGE_PLAN) {
            $entry->plan_value = $data['value'];
        }

        if ((string) $data['stage'] === KpiPeriod::STAGE_FACT) {
            $entry->fact_value = $data['value'];
        }

        $entry->comment = $data['comment'] ?? null;
        $entry->save();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'KPI-запись обновлена.',
                'data' => $entry->refresh(),
            ]);
        }

        return back()->with('success', 'KPI-запись обновлена.');
    }

    public function submitMyEntry(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('submit', $entry);

        $entry->loadMissing('indicator');

        if ($entry->entity_type === KpiEntry::ENTITY_TYPE_TEACHER) {
            $entry->faculty_id = $entry->faculty_id ?? $this->userFacultyId($request->user());
            $entry->department_id = $entry->department_id ?? $this->userDepartmentId($request->user());
        }

        if ($entry->indicator?->requiresFile() && !$entry->files()->exists()) {
            return $this->errorResponse($request, 'Для этого индикатора требуется файл перед отправкой.');
        }

        $fromStatus = $entry->status;
        $entry->status = KpiEntry::STATUS_SUBMITTED;
        $entry->submitted_at = Carbon::now();
        $entry->save();

        KpiStatusLog::query()->create([
            'kpi_entry_id' => $entry->id,
            'from_status' => $fromStatus,
            'to_status' => KpiEntry::STATUS_SUBMITTED,
            'action' => KpiStatusLog::ACTION_SUBMIT,
            'acted_by' => $request->user()?->id,
        ]);

        if ($request->expectsJson()) {
            return response()->json(['message' => 'KPI-запись отправлена на проверку.']);
        }

        return back()->with('success', 'KPI-запись отправлена на проверку.');
    }

    public function destroyMyEntry(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('update', $entry);

        $entry->delete();

        if ($request->expectsJson()) {
            return response()->json(['message' => 'KPI-запись удалена.']);
        }

        return back()->with('success', 'KPI-запись удалена.');
    }

    public function savePlan(Request $request, KpiPeriod $period): RedirectResponse|JsonResponse
    {
        $this->authorize('create', KpiEntry::class);

        $data = $request->validate($this->entryRules('plan'));

        try {
            $this->entryService->savePlan($request->user(), $period, $data['entries']);

            return $this->successResponse($request, 'Плановые KPI-данные сохранены.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    public function saveFact(Request $request, KpiPeriod $period): RedirectResponse|JsonResponse
    {
        $this->authorize('create', KpiEntry::class);

        $data = $request->validate($this->entryRules('fact'));

        try {
            $this->entryService->saveFact($request->user(), $period, $data['entries']);

            return $this->successResponse($request, 'Фактические KPI-данные сохранены.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    public function submit(Request $request, KpiPeriod $period): RedirectResponse|JsonResponse
    {
        $this->authorize('create', KpiEntry::class);

        $data = $request->validate([
            'entity_type' => ['required', 'string', Rule::in([
                KpiEntry::ENTITY_TYPE_TEACHER,
                KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD,
                KpiEntry::ENTITY_TYPE_DEAN,
                KpiEntry::ENTITY_TYPE_STRUCTURAL_DIVISION,
            ])],
        ]);

        try {
            $this->entryService->submitEntries($request->user(), $period, $data['entity_type']);

            return $this->successResponse($request, 'KPI-записи отправлены на рассмотрение.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    public function reviewQueue(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);
        $this->abortIfTeacher($request->user());

        $payload = $this->buildModerationQueuePayload($request, KpiEntry::STATUS_SUBMITTED);

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/ReviewQueue', $payload);
    }

    public function approvalQueue(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);
        $this->abortIfTeacher($request->user());

        $payload = $this->buildModerationQueuePayload($request, KpiEntry::STATUS_PENDING_DEAN);

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/ApprovalQueue', $payload);
    }

    public function structuralQueue(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);
        $this->abortIfTeacher($request->user());

        $payload = $this->buildModerationQueuePayload($request, KpiEntry::STATUS_PENDING_STRUCTURAL);

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/StructuralQueue', $payload);
    }

    public function approve(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('approve', $entry);

        $data = $request->validate([
            'comment' => ['nullable', 'string'],
        ]);

        try {
            $approved = $this->entryService->approveEntry($entry, $request->user(), $data['comment'] ?? null);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-запись утверждена.',
                    'data' => $approved,
                ]);
            }

            return back()->with('success', 'KPI-запись утверждена.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    public function reject(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('reject', $entry);

        $data = $request->validate([
            'comment' => ['nullable', 'string'],
        ]);

        try {
            $rejected = $this->entryService->rejectEntry($entry, $request->user(), $data['comment'] ?? null);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-запись отклонена.',
                    'data' => $rejected,
                ]);
            }

            return back()->with('success', 'KPI-запись отклонена.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    public function review(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('review', $entry);

        $data = $request->validate([
            'comment' => ['nullable', 'string'],
        ]);

        try {
            $reviewed = $this->entryService->reviewEntry($entry, $request->user(), $data['comment'] ?? null);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-запись отмечена как проверенная.',
                    'data' => $reviewed,
                ]);
            }

            return back()->with('success', 'KPI-запись отмечена как проверенная.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    public function returnEntry(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('return', $entry);

        $data = $request->validate([
            'comment' => ['nullable', 'string'],
        ]);

        try {
            $returned = $this->entryService->returnEntry($entry, $request->user(), $data['comment'] ?? null);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-запись возвращена исполнителю.',
                    'data' => $returned,
                ]);
            }

            return back()->with('success', 'KPI-запись возвращена исполнителю.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    public function show(Request $request, KpiEntry $entry): Response|JsonResponse
    {
        $this->authorize('view', $entry);

        $entry->load([
            'period:id,name,stage,status,start_date,end_date',
            'academicYear:id,name,start_year,end_year',
            'user:id,name,email',
            'indicator:id,entity_type,section,code,name,description,unit,requires_file',
            'files:id,kpi_entry_id,file_name,file_path,file_disk,file_type,file_size,uploaded_by',
            'statusLogs.actor:id,name',
            'faculty:id,name',
            'department:id,name',
        ]);

        if ($request->expectsJson()) {
            return response()->json(['data' => $entry]);
        }

        return Inertia::render('Kpi/EntryShow', [
            'entry' => $entry,
            'permissions' => [
                'canReview' => $request->user()?->can('review', $entry) ?? false,
                'canReturn' => $request->user()?->can('return', $entry) ?? false,
                'canApprove' => $request->user()?->can('approve', $entry) ?? false,
                'canReject' => $request->user()?->can('reject', $entry) ?? false,
            ],
        ]);
    }

    public function uploadFile(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('update', $entry);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:10240'],
        ]);

        try {
            $file = $this->fileService->upload($entry, $data['file'], $request->user()?->id);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Файл успешно загружен.',
                    'data' => $file,
                ], 201);
            }

            return back()->with('success', 'Файл успешно загружен.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function entryRules(string $mode): array
    {
        $valueField = $mode === 'plan' ? 'plan_value' : 'fact_value';

        return [
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.indicator_id' => ['required', 'integer', 'exists:kpi_indicators,id'],
            'entries.*.entity_type' => ['required', 'string', Rule::in([
                KpiEntry::ENTITY_TYPE_TEACHER,
                KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD,
                KpiEntry::ENTITY_TYPE_DEAN,
                KpiEntry::ENTITY_TYPE_STRUCTURAL_DIVISION,
            ])],
            'entries.*.faculty_id' => ['nullable', 'integer', 'exists:faculties,id'],
            'entries.*.department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'entries.*.' . $valueField => ['nullable', 'numeric'],
            'entries.*.manual_points' => ['nullable', 'numeric'],
            'entries.*.comment' => ['nullable', 'string'],
        ];
    }

    private function visibleEntriesQuery(User $user): Builder
    {
        $query = KpiEntry::query();
        $role = $user->resolvedRoleSlug();

        if ($role === 'admin' || $role === 'superadmin') {
            return $query;
        }

        if ($role === 'teacher') {
            return $query->where('user_id', $user->id);
        }

        if ($role === 'department_head' || $role === 'hod') {
            $departmentId = $this->userDepartmentId($user);

            return $query->where('department_id', $departmentId ?? 0);
        }

        if ($role === 'dean') {
            $facultyId = $this->userFacultyId($user);

            return $query->where(function (Builder $q) use ($facultyId): void {
                $q->where('faculty_id', $facultyId ?? 0)
                  ->orWhereNull('faculty_id');
            });
        }

        if ($role === 'department') {
            // Стр. подразделения видят свои записи и записи ППС на финальном рассмотрении
            return $query->where(function (Builder $q) use ($user): void {
                $q->where('user_id', $user->id)
                  ->orWhereIn('status', [
                      KpiEntry::STATUS_PENDING_STRUCTURAL,
                      KpiEntry::STATUS_APPROVED,
                      KpiEntry::STATUS_REJECTED,
                  ]);
            });
        }

        return $query->whereRaw('1 = 0');
    }

    /**
     * @return array<string, mixed>
     */
    private function buildModerationQueuePayload(Request $request, string $defaultStatus): array
    {
        /** @var User $user */
        $user = $request->user();
        $status = trim((string) $request->query('status', $defaultStatus));
        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');
        $departmentId = $request->integer('department_id');
        $facultyId = $request->integer('faculty_id');
        $userId = $request->integer('user_id');

        $baseQuery = $this->visibleEntriesQuery($user);
        $entriesQuery = $this->applyQueueFilters(
            (clone $baseQuery)->with([
                'user:id,name,email',
                'period:id,name,stage,status,academic_year_id,start_date,end_date',
                'indicator:id,code,name,section',
                'faculty:id,name',
                'department:id,name',
                'academicYear:id,name,start_year,end_year',
            ]),
            $academicYearId,
            $periodId,
            $status,
            $departmentId,
            $facultyId,
            $userId,
        );

        $entries = $entriesQuery
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        $academicYears = AcademicYear::query()
            ->orderByDesc('start_year')
            ->get(['id', 'name', 'start_year', 'end_year'])
            ->unique('id')
            ->values();

        $periods = KpiPeriod::query()
            ->when($academicYearId > 0, fn (Builder $query) => $query->where('academic_year_id', $academicYearId))
            ->orderByDesc('start_date')
            ->get(['id', 'name', 'stage', 'status', 'academic_year_id']);

        $userFacultyId = $this->userFacultyId($user);
        $userDepartmentId = $this->userDepartmentId($user);

        $faculties = Faculty::query()
            ->when($userFacultyId !== null, fn (Builder $query) => $query->whereKey($userFacultyId))
            ->orderBy('name')
            ->get(['id', 'name']);

        $departments = Department::query()
            ->when($userDepartmentId !== null, fn (Builder $query) => $query->whereKey($userDepartmentId))
            ->when($userFacultyId !== null, fn (Builder $query) => $query->where('faculty_id', $userFacultyId))
            ->orderBy('name')
            ->get(['id', 'name', 'faculty_id']);

        $visibleUserIds = $this->applyQueueFilters(
            (clone $baseQuery)->select('user_id')->distinct(),
            $academicYearId,
            $periodId,
            $status,
            $departmentId,
            $facultyId,
            $userId,
        )->pluck('user_id');

        $users = User::query()
            ->whereIn('id', $visibleUserIds)
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return [
            'entries' => $entries,
            'academicYears' => $academicYears,
            'periods' => $periods,
            'faculties' => $faculties,
            'departments' => $departments,
            'users' => $users,
            'statusOptions' => [
                KpiEntry::STATUS_SUBMITTED,
                KpiEntry::STATUS_PENDING_DEAN,
                KpiEntry::STATUS_PENDING_STRUCTURAL,
                KpiEntry::STATUS_REVIEWED,
                KpiEntry::STATUS_RETURNED,
                KpiEntry::STATUS_APPROVED,
                KpiEntry::STATUS_REJECTED,
            ],
            'filters' => [
                'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
                'period_id' => $periodId > 0 ? $periodId : null,
                'status' => $status !== '' ? $status : null,
                'department_id' => $departmentId > 0 ? $departmentId : null,
                'faculty_id' => $facultyId > 0 ? $facultyId : null,
                'user_id' => $userId > 0 ? $userId : null,
            ],
            'permissions' => [
                'canModerate' => !in_array($user->resolvedRoleSlug(), ['superadmin', 'teacher'], true),
            ],
        ];
    }

    private function applyQueueFilters(
        Builder $query,
        int $academicYearId,
        int $periodId,
        string $status,
        int $departmentId,
        int $facultyId,
        int $userId,
    ): Builder {
        if ($academicYearId > 0) {
            $query->where('academic_year_id', $academicYearId);
        }

        if ($periodId > 0) {
            $query->where('kpi_period_id', $periodId);
        }

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($departmentId > 0) {
            $query->where('department_id', $departmentId);
        }

        if ($facultyId > 0) {
            $query->where('faculty_id', $facultyId);
        }

        if ($userId > 0) {
            $query->where('user_id', $userId);
        }

        return $query;
    }

    private function abortIfTeacher(User $user): void
    {
        if ($user->resolvedRoleSlug() === 'teacher') {
            abort(403);
        }
    }

    private function userDepartmentId(User $user): ?int
    {
        $departmentId = $user->department_id ?? null;

        if ($departmentId === null || $departmentId === '') {
            return null;
        }

        return (int) $departmentId;
    }

    private function userFacultyId(User $user): ?int
    {
        $facultyId = $user->faculty_id ?? null;

        if ($facultyId === null || $facultyId === '') {
            return null;
        }

        return (int) $facultyId;
    }

    private function successResponse(Request $request, string $message): RedirectResponse|JsonResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $message]);
        }

        return back()->with('success', $message);
    }

    private function errorResponse(Request $request, string $message): RedirectResponse|JsonResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $message], 422);
        }

        return back()->withErrors(['kpi_entry' => $message])->withInput();
    }

    /**
     * @param Collection<int, KpiEntry> $entries
     * @return Collection<int, array<string, mixed>>
     */
    private function buildTeacherFormRows(Collection $entries): Collection
    {
        $indicatorMap = KpiIndicator::query()
            ->active()
            ->forEntityType(KpiIndicator::ENTITY_TYPE_TEACHER)
            ->ordered()
            ->get()
            ->keyBy('id');

        $entriesByIndicator = $entries->keyBy('indicator_id');

        return $indicatorMap->map(function (KpiIndicator $indicator) use ($entriesByIndicator): array {
            /** @var KpiEntry|null $entry */
            $entry = $entriesByIndicator->get($indicator->id);

            return [
                'entry_id' => $entry?->id,
                'indicator_id' => $indicator->id,
                'entity_type' => KpiIndicator::ENTITY_TYPE_TEACHER,
                'section' => $indicator->section,
                'code' => $indicator->code,
                'name' => $indicator->name,
                'unit' => $indicator->unit,
                'requires_file' => $indicator->requiresFile(),
                'plan_value' => $entry?->plan_value,
                'fact_value' => $entry?->fact_value,
                'calculated_points' => $entry?->calculated_points ?? '0.00',
                'manual_points' => $entry?->manual_points,
                'comment' => $entry?->comment,
                'status' => $entry?->status ?? KpiEntry::STATUS_DRAFT,
                'files' => $entry?->files?->map(fn ($file) => [
                    'id' => $file->id,
                    'file_name' => $file->file_name,
                    'file_url' => $file->file_url,
                ])->values()->all() ?? [],
            ];
        })->values();
    }

    /**
     * @param Collection<int, array<string, mixed>> $rows
     */
    private function resolveOverallStatus(Collection $rows): string
    {
        if ($rows->isEmpty()) {
            return KpiEntry::STATUS_DRAFT;
        }

        $statuses = $rows->pluck('status')->unique()->values();

        if ($statuses->count() === 1) {
            return (string) $statuses->first();
        }

        return 'mixed';
    }

    private function teacherModuleLabel(string $section): string
    {
        return match ($section) {
            KpiIndicator::SECTION_TEACHING => 'УМР',
            KpiIndicator::SECTION_SCIENCE => 'НИР',
            KpiIndicator::SECTION_SOCIAL => 'Общественная деятельность',
            KpiIndicator::SECTION_QUALIFICATION => 'Повышение квалификации',
            KpiIndicator::SECTION_SURVEY => 'Опросные показатели',
            default => $section,
        };
    }

    private function resolveGroupCode(string $code): string
    {
        $parts = explode('.', trim($code));

        if (count($parts) >= 2) {
            return $parts[0] . '.' . $parts[1];
        }

        return $code;
    }
}

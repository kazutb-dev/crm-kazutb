<?php

namespace App\Http\Controllers;

use App\Exceptions\Kpi\KpiEntryException;
use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Division;
use App\Models\Faculty;
use App\Models\KpiAccessGrant;
use App\Models\KpiEntryFile;
use App\Models\KpiResult;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiStructuralUnit;
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
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class KpiEntryController extends Controller
{
    /**
     * Подтверждение KPI-записи от структурного подразделения (СП)
     */
    public function structuralConfirm(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('structuralConfirm', $entry);

        $data = $request->validate([
            'comment' => ['nullable', 'string'],
            'structural_unit_id' => ['nullable', 'integer', 'exists:kpi_structural_units,id'],
        ]);

        try {
            $result = $this->entryService->structuralConfirm(
                $entry,
                $request->user(),
                $data['comment'] ?? null,
                isset($data['structural_unit_id']) ? (int) $data['structural_unit_id'] : null,
            );

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-запись подтверждена вашим подразделением.',
                    'data' => $result,
                ]);
            }

            return back()->with('success', 'KPI-запись подтверждена вашим подразделением.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }

    /**
     * Отклонение KPI-записи от структурного подразделения (СП)
     */
    public function structuralReject(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('structuralReject', $entry);

        $data = $request->validate([
            'comment' => ['nullable', 'string'],
            'structural_unit_id' => ['nullable', 'integer', 'exists:kpi_structural_units,id'],
        ]);

        try {
            $result = $this->entryService->structuralReject(
                $entry,
                $request->user(),
                $data['comment'] ?? null,
                isset($data['structural_unit_id']) ? (int) $data['structural_unit_id'] : null,
            );

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-запись отклонена вашим подразделением.',
                    'data' => $result,
                ]);
            }

            return back()->with('success', 'KPI-запись отклонена вашим подразделением.');
        } catch (KpiEntryException $e) {
            return $this->errorResponse($request, $e->getMessage());
        }
    }
    public function __construct(
        private readonly KpiEntryService $entryService,
        private readonly KpiEntryFileService $fileService,
        private readonly KpiPeriodService $periodService,
    ) {}

    public function myForm(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);

        /** @var User $user */
        $user = $request->user();
        $stage = trim((string) $request->query('stage', KpiPeriod::STAGE_PLAN));
        $activeFactSeason = KpiPeriod::query()
            ->active()
            ->where('stage', KpiPeriod::STAGE_FACT)
            ->orderByDesc('academic_year_id')
            ->first(['academic_year_id']);
        $academicYearId = $request->integer('academic_year_id') ?: (int) ($activeFactSeason?->academic_year_id ?? 0);
        $periodId = $request->integer('period_id');
        $status = trim((string) $request->query('status', ''));
        $module = trim((string) $request->query('module', ''));
        $groupCode = trim((string) $request->query('group_code', ''));

        $roleSlug = $user->resolvedRoleSlug();
        $entityType = match ($roleSlug) {
            'hod', 'department_head' => KpiIndicator::ENTITY_TYPE_DEPARTMENT_HEAD,
            'dean' => KpiIndicator::ENTITY_TYPE_DEAN,
            default => KpiIndicator::ENTITY_TYPE_TEACHER,
        };

        // Resolve period: prefer period_id, else fall back to stage+year
        if ($periodId > 0) {
            $period = KpiPeriod::find($periodId);
        } else {
            $period = $this->periodService->getCurrentOpenPeriod(
                $stage,
                $academicYearId > 0 ? $academicYearId : null,
            );
        }

        // Resolve academic year
        $academicYear = $period?->academic_year_id
            ? AcademicYear::find($period->academic_year_id, ['id', 'name', 'start_year', 'end_year'])
            : ($academicYearId > 0 ? AcademicYear::find($academicYearId, ['id', 'name', 'start_year', 'end_year']) : null);

        $indicatorCollection = KpiIndicator::query()
            ->active()
            ->forEntityType($entityType)
            ->ordered()
            ->get(['id', 'section', 'code', 'name', 'description', 'unit', 'requires_file', 'calculation_type', 'base_points', 'scoring_rules']);

        $indicators = $indicatorCollection->map(function (KpiIndicator $indicator) use ($entityType): array {
            return [
                'id' => $indicator->id,
                'entity_type' => $entityType,
                'section' => $indicator->section,
                'module_label' => $this->teacherModuleLabel($indicator->section),
                'group_code' => $this->resolveGroupCode((string) $indicator->code),
                'code' => $indicator->code,
                'name' => $indicator->name,
                'description' => $indicator->description,
                'unit' => $indicator->unit,
                'requires_file' => $indicator->requiresFile(),
                'calculation_type' => $indicator->calculation_type,
                'base_points' => $indicator->base_points,
                'scoring_rules' => $indicator->scoring_rules,
            ];
        })->values();

        $indicatorReference = KpiIndicator::query()
            ->active()
            ->where('entity_type', $entityType)
            ->with([
                'checkerStructuralUnit:id,name',
                'structuralUnits:id,name',
            ])
            ->ordered()
            ->get([
                'id',
                'entity_type',
                'section',
                'code',
                'name',
                'description',
                'unit',
                'base_points',
                'calculation_type',
                'scoring_rules',
                'requires_file',
                'is_active',
                'checker_structural_unit_id',
            ])
            ->map(function (KpiIndicator $indicator): array {
                return [
                    'id' => (int) $indicator->id,
                    'entity_type' => (string) $indicator->entity_type,
                    'section' => (string) $indicator->section,
                    'module_label' => $this->teacherModuleLabel((string) $indicator->section),
                    'code' => (string) $indicator->code,
                    'name' => (string) $indicator->name,
                    'description' => (string) $indicator->description,
                    'unit' => $indicator->unit,
                    'base_points' => $indicator->base_points,
                    'calculation_type' => (string) $indicator->calculation_type,
                    'scoring_rules' => $indicator->scoring_rules,
                    'requires_file' => (bool) $indicator->requires_file,
                    'is_active' => (bool) $indicator->is_active,
                    'checker_structural_unit' => $indicator->checkerStructuralUnit
                        ? [
                            'id' => (int) $indicator->checkerStructuralUnit->id,
                            'name' => (string) $indicator->checkerStructuralUnit->name,
                        ]
                        : null,
                    'structural_units' => $indicator->structuralUnits
                        ->map(fn(KpiStructuralUnit $unit): array => [
                            'id' => (int) $unit->id,
                            'name' => (string) $unit->name,
                        ])
                        ->values()
                        ->all(),
                ];
            })
            ->values();

        $entriesQuery = KpiEntry::query()
            ->with([
                'indicator:id,section,code,name,unit,requires_file,base_points,checker_structural_unit_id',
                'indicator.checkerStructuralUnit:id,code,name',
                'indicator.structuralUnits:id,code,name',
                'files:id,kpi_entry_id,file_name,file_path,file_disk,file_type,file_size,uploaded_by',
                'statusLogs' => fn($q) => $q->orderBy('created_at', 'asc'),
                'statusLogs.actor:id,name,display_name',
                'statusLogs.actor.kpiStructuralUnits:id,code,name',
                'structuralConfirmations:id,kpi_record_id,structural_unit_id,confirmed_by,status,comment,confirmed_at',
                'structuralConfirmations.structuralUnit:id,code,name',
                'structuralConfirmations.confirmer:id,name,display_name',
            ])
            ->forUser($user->id)
            ->forEntityType($entityType)
            ->when($period?->id !== null, fn(Builder $query) => $query->where('kpi_period_id', $period->id))
            ->when($status !== '', fn(Builder $query) => $query->where('status', $status))
            ->when($module !== '', fn(Builder $query) => $query->whereHas('indicator', fn(Builder $query) => $query->where('section', $module)))
            ->when($groupCode !== '', fn(Builder $query) => $query->whereHas('indicator', fn(Builder $query) => $query->where('code', 'like', $groupCode . '.%')))
            ->latest('id');

        $entries = $entriesQuery
            ->paginate(50)
            ->withQueryString();

        $entries->getCollection()->transform(function (KpiEntry $entry): KpiEntry {
            $entry->history = $entry->statusLogs->map(fn($log) => [
                'id' => $log->id,
                'action' => $log->action,
                'from_status' => $log->from_status,
                'to_status' => $log->to_status,
                'comment' => $log->comment,
                'actor_name' => $log->actor?->display_name ?? $log->actor?->name ?? '—',
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values()->all();

            $expectedUnits = $entry->indicator?->structuralUnits;
            if (!($expectedUnits instanceof Collection) || $expectedUnits->isEmpty()) {
                $expectedUnits = collect();
                if ($entry->indicator?->checkerStructuralUnit !== null) {
                    $expectedUnits = collect([$entry->indicator->checkerStructuralUnit]);
                }
            }

            $rawConfirmations = $entry->structuralConfirmations instanceof Collection
                ? $entry->structuralConfirmations
                : collect();

            $confirmationsByUnit = $rawConfirmations
                ->filter(fn($item) => $item?->structural_unit_id !== null)
                ->keyBy(fn($item) => (int) $item->structural_unit_id);

            $resolvedConfirmations = $expectedUnits->map(function ($unit) use ($confirmationsByUnit): array {
                $unitId = (int) ($unit->id ?? 0);
                $confirmation = $confirmationsByUnit->get($unitId);

                return [
                    'structural_unit_id' => $unitId,
                    'name' => trim((string) ($unit->code ?? '')) && trim((string) ($unit->name ?? ''))
                        ? trim((string) $unit->code) . ' — ' . trim((string) $unit->name)
                        : (trim((string) ($unit->name ?? '')) ?: trim((string) ($unit->code ?? ''))),
                    'status' => $confirmation?->status ?? 'pending',
                    'comment' => $confirmation?->comment,
                    'confirmed_by' => $confirmation?->confirmer?->display_name
                        ?? $confirmation?->confirmer?->name
                        ?? null,
                    'confirmed_at' => $confirmation?->confirmed_at?->toIso8601String(),
                ];
            })->values();

            $extraConfirmations = $rawConfirmations
                ->filter(fn($item) => !$resolvedConfirmations->contains(fn($row) => (int) $row['structural_unit_id'] === (int) $item->structural_unit_id))
                ->map(function ($item): array {
                    $unit = $item->structuralUnit;
                    $name = trim((string) ($unit?->code ?? '')) && trim((string) ($unit?->name ?? ''))
                        ? trim((string) $unit->code) . ' — ' . trim((string) $unit->name)
                        : (trim((string) ($unit?->name ?? '')) ?: trim((string) ($unit?->code ?? '')));

                    return [
                        'structural_unit_id' => (int) ($item->structural_unit_id ?? 0),
                        'name' => $name !== '' ? $name : 'Структурное подразделение',
                        'status' => $item->status ?? 'pending',
                        'comment' => $item->comment,
                        'confirmed_by' => $item->confirmer?->display_name ?? $item->confirmer?->name ?? null,
                        'confirmed_at' => $item->confirmed_at?->toIso8601String(),
                    ];
                })
                ->values();

            $matrix = $resolvedConfirmations
                ->concat($extraConfirmations)
                ->values();

            // Fallback for historical entries: some old rejects were logged in status history
            // without creating/updating a structural confirmation row.
            $hasRejectedInMatrix = $matrix->contains(fn($row) => ($row['status'] ?? null) === 'rejected');
            if ($entry->status === KpiEntry::STATUS_REJECTED && !$hasRejectedInMatrix) {
                $rejectLog = $entry->statusLogs
                    ->filter(fn($log) => $log->action === KpiStatusLog::ACTION_REJECT)
                    ->sortByDesc('created_at')
                    ->first();

                if ($rejectLog) {
                    $expectedUnitIds = $expectedUnits
                        ->pluck('id')
                        ->filter()
                        ->map(fn($id) => (int) $id)
                        ->values();

                    $candidateIds = collect();

                    $actorUnitIds = $rejectLog->actor?->kpiStructuralUnits
                        ? $rejectLog->actor->kpiStructuralUnits
                        ->pluck('id')
                        ->filter()
                        ->map(fn($id) => (int) $id)
                        : collect();

                    if ($actorUnitIds->isNotEmpty()) {
                        $candidateIds = $expectedUnitIds->isNotEmpty()
                            ? $actorUnitIds->intersect($expectedUnitIds)->values()
                            : $actorUnitIds->values();
                    }

                    if ($candidateIds->isEmpty() && $expectedUnits->isNotEmpty()) {
                        $commentText = mb_strtolower((string) ($rejectLog->comment ?? ''), 'UTF-8');

                        foreach ($expectedUnits as $unit) {
                            $unitCode = mb_strtolower(trim((string) ($unit->code ?? '')), 'UTF-8');
                            $unitName = mb_strtolower(trim((string) ($unit->name ?? '')), 'UTF-8');

                            if (
                                ($unitCode !== '' && str_contains($commentText, $unitCode))
                                || ($unitName !== '' && str_contains($commentText, $unitName))
                            ) {
                                $candidateIds->push((int) $unit->id);
                            }
                        }
                    }

                    $candidateIds = $candidateIds->unique()->values();

                    if ($candidateIds->isNotEmpty()) {
                        foreach ($candidateIds as $candidateId) {
                            $index = $matrix->search(
                                fn($row) => (int) ($row['structural_unit_id'] ?? 0) === (int) $candidateId,
                                true
                            );

                            $unit = $expectedUnits->first(fn($item) => (int) ($item->id ?? 0) === (int) $candidateId);
                            $resolvedName = trim((string) ($unit?->code ?? '')) && trim((string) ($unit?->name ?? ''))
                                ? trim((string) $unit->code) . ' — ' . trim((string) $unit->name)
                                : (trim((string) ($unit?->name ?? '')) ?: trim((string) ($unit?->code ?? '')) ?: 'Структурное подразделение');

                            $payload = [
                                'structural_unit_id' => (int) $candidateId,
                                'name' => $resolvedName,
                                'status' => 'rejected',
                                'comment' => $rejectLog->comment,
                                'confirmed_by' => $rejectLog->actor?->display_name ?? $rejectLog->actor?->name ?? null,
                                'confirmed_at' => $rejectLog->created_at?->toIso8601String(),
                            ];

                            if ($index === false) {
                                $matrix->push($payload);
                            } else {
                                $matrix->put((int) $index, $payload);
                            }
                        }
                    }
                }
            }

            $entry->structural_confirmation_matrix = $matrix
                ->values()
                ->all();

            return $entry;
        });

        $summaryQuery = KpiEntry::query()
            ->forUser($user->id)
            ->forEntityType($entityType)
            ->when($period?->id !== null, fn(Builder $query) => $query->where('kpi_period_id', $period->id));

        // KPI result for current period
        $result = $period
            ? KpiResult::query()
            ->where('kpi_period_id', $period->id)
            ->where('result_type', KpiResult::RESULT_TYPE_USER)
            ->where('user_id', $user->id)
            ->first(['rank_score', 'k1_score', 'k2_score', 'k3_score', 'k4_score', 'k5_score', 'k6_score', 'approved_entries_count'])
            : null;

        $modules = $indicators
            ->pluck('section')
            ->unique()
            ->map(fn($section): array => [
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
                ->map(fn($code): string => trim((string) $code))
                ->filter(fn(string $code): bool => $code !== '')
                ->uniqueStrict()
                ->sort(fn(string $left, string $right): int => strnatcasecmp($left, $right))
                ->values()
                ->map(fn($code): array => [
                    'value' => $code,
                    'label' => $code . ' — ' . $this->resolveGroupLabel($entityType, (string) $code),
                ])
                ->all();
        }
        $totalPointsQuery = KpiEntry::query()
            ->from('kpi_entries')
            ->leftJoin('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->where('kpi_entries.user_id', $user->id)
            ->where('kpi_entries.entity_type', $entityType)
            ->when($period?->id !== null, fn(Builder $query) => $query->where('kpi_entries.kpi_period_id', $period->id));

        $totalPoints = (float) ($totalPointsQuery
            ->selectRaw("
            ROUND(SUM(
                CASE
                    WHEN kpi_entries.manual_points IS NOT NULL
                        AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(kpi_entries.calculation_details, '$.rule_kind')), '') <> ''
                        THEN kpi_entries.manual_points
                    WHEN kpi_entries.calculated_points IS NOT NULL AND kpi_entries.calculated_points <> 0 THEN kpi_entries.calculated_points
                    WHEN kpi_entries.fact_value IS NOT NULL THEN COALESCE(kpi_indicators.base_points, 0) * kpi_entries.fact_value
                    WHEN kpi_entries.plan_value IS NOT NULL THEN COALESCE(kpi_indicators.base_points, 0) * kpi_entries.plan_value
                    WHEN kpi_entries.manual_points IS NOT NULL THEN kpi_entries.manual_points
                    WHEN kpi_entries.calculated_points IS NOT NULL THEN kpi_entries.calculated_points
                    ELSE 0
                END
            ), 2) as total_points
        ")
            ->value('total_points') ?? 0);
        $totalEntries = (int) ((clone $summaryQuery)->count());
        $approvedEntries = (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_APPROVED)->count());
        $rejectedEntries = (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_REJECTED)->count());
        $draftEntries = (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_DRAFT)->count());
        $submittedEntries = (int) ((clone $summaryQuery)->where('status', KpiEntry::STATUS_SUBMITTED)->count());
        $pendingEntries = (int) ((clone $summaryQuery)->whereIn('status', [
            KpiEntry::STATUS_REVIEWED,
        ])->count());

        $availableAcademicYears = AcademicYear::query()
            ->whereIn('id', KpiPeriod::query()->select('academic_year_id')->distinct())
            ->orderByDesc('start_year')
            ->get(['id', 'name', 'start_year', 'end_year']);

        $filterOptions = [
            'academicYears' => $availableAcademicYears,
            'periods' => $academicYear
                ? KpiPeriod::query()->where('academic_year_id', $academicYear->id)->orderByDesc('start_date')->get(['id', 'name', 'stage', 'status'])
                : ($period ? KpiPeriod::query()->where('academic_year_id', $period->academic_year_id)->orderByDesc('start_date')->get(['id', 'name', 'stage', 'status']) : collect()),
        ];

        // Show ALL active (status=active) fact seasons — no date filter.
        $activeSeasons = KpiPeriod::query()
            ->active()
            ->where('stage', KpiPeriod::STAGE_FACT)
            ->with('academicYear:id,name,start_year,end_year')
            ->orderByDesc('academic_year_id')
            ->get(['id', 'academic_year_id'])
            ->unique('academic_year_id')
            ->map(function (KpiPeriod $item): array {
                $label = $item->academicYear?->name;

                if (!$label && $item->academicYear?->start_year && $item->academicYear?->end_year) {
                    $label = $item->academicYear->start_year . '/' . $item->academicYear->end_year;
                }

                return [
                    'academic_year_id' => (int) $item->academic_year_id,
                    'label' => $label ?: (string) $item->academic_year_id,
                ];
            })
            ->values()
            ->all();

        if ($request->expectsJson()) {
            return response()->json([
                'data' => [
                    'period' => $period,
                    'summary' => [
                        'total_points' => $totalPoints,
                        'total_entries' => $totalEntries,
                        'draft_entries' => $draftEntries,
                        'submitted_entries' => $submittedEntries,
                    ],
                    'entries' => $entries,
                    'indicators' => $indicators,
                    'indicator_reference' => $indicatorReference,
                    'modules' => $modules,
                    'groupCodesByModule' => $groupCodesByModule,
                    'activeSeasons' => $activeSeasons,
                    'stageOptions' => [
                        KpiPeriod::STAGE_PLAN,
                        KpiPeriod::STAGE_FACT,
                        KpiPeriod::STAGE_REVIEW,
                    ],
                ],
            ]);
        }

        return Inertia::render('Kpi/TeacherDashboard', [
            'currentUser' => [
                'name' => $user->display_name ?? $user->name,
                'title' => $user->ad_title,
                'division' => $user->ad_division,
                'department_name' => $user->department_id
                    ? Department::query()->where('id', $user->department_id)->value('name')
                    : null,
                'faculty_name' => $user->faculty_id
                    ? Faculty::query()->where('id', $user->faculty_id)->value('name')
                    : null,
            ],
            'period' => $period ? $period->only(['id', 'name', 'stage', 'status', 'start_date', 'end_date']) : null,
            'academicYear' => $academicYear ? $academicYear->only(['id', 'name']) : null,
            'result' => $result ? [
                'rank_score' => (float) ($result->rank_score ?? 0),
                'k1' => (float) ($result->k1_score ?? 0),
                'k2' => (float) ($result->k2_score ?? 0),
                'k3' => (float) ($result->k3_score ?? 0),
                'k4' => (float) ($result->k4_score ?? 0),
                'k5' => (float) ($result->k5_score ?? 0),
                'k6' => (float) ($result->k6_score ?? 0),
                'approved_entries' => (int) ($result->approved_entries_count ?? 0),
            ] : null,
            'summary' => [
                'total_points' => $totalPoints,
                'total_entries' => $totalEntries,
                'approved_entries' => $approvedEntries,
                'rejected_entries' => $rejectedEntries,
                'pending_entries' => $submittedEntries + $pendingEntries,
                'draft_entries' => $draftEntries,
                'submitted_entries' => $submittedEntries,
            ],
            'entries' => $entries,
            'indicators' => $indicators,
            'indicator_reference' => $indicatorReference,
            'modules' => $modules,
            'groupCodesByModule' => $groupCodesByModule,
            'filterOptions' => $filterOptions,
            'activeSeasons' => $activeSeasons,
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
                'academic_year_id' => $academicYear?->id ?? ($academicYearId > 0 ? $academicYearId : null),
                'period_id' => $period?->id ?? ($periodId > 0 ? $periodId : null),
                'status' => $status !== '' ? $status : null,
                'module' => $module !== '' ? $module : null,
                'group_code' => $groupCode !== '' ? $groupCode : null,
            ],
            'permissions' => [
                'canManage' => in_array($roleSlug, ['teacher', 'hod', 'department_head', 'dean'], true),
                'userLevel' => $entityType,
            ],
        ]);
    }

    public function storeMyEntry(Request $request): RedirectResponse|JsonResponse
    {
        $this->authorize('create', KpiEntry::class);

        /** @var User $user */
        $user = $request->user();
        $roleSlug = $user->resolvedRoleSlug();
        $entityType = match ($roleSlug) {
            'hod', 'department_head' => KpiIndicator::ENTITY_TYPE_DEPARTMENT_HEAD,
            'dean' => KpiIndicator::ENTITY_TYPE_DEAN,
            default => KpiIndicator::ENTITY_TYPE_TEACHER,
        };
        $data = $request->validate([
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'module' => ['required', 'string', 'max:64'],
            'group_code' => ['required', 'string', 'max:64'],
            'indicator_id' => ['required', 'integer', 'exists:kpi_indicators,id'],
            'value' => ['required', 'integer', 'min:1'],
            'manual_points' => ['nullable', 'numeric'],
            'calculation_details' => ['nullable', 'array'],
            'comment' => ['required', 'string'],
            'external_source_url' => ['nullable', 'url', 'max:2048'],
            'external_source_urls' => ['nullable', 'array', 'max:10'],
            'external_source_urls.*' => ['nullable', 'url', 'max:2048'],
            'file' => ['nullable', 'file', 'max:102400'],
            'files' => ['nullable', 'array'],
            'files.*' => ['file', 'max:102400'],
            'action' => ['required', 'string', Rule::in(['draft', 'submit'])],
        ]);

        $externalLinks = collect($data['external_source_urls'] ?? [])
            ->map(static fn($url) => trim((string) $url))
            ->filter(static fn($url) => $url !== '')
            ->values()
            ->take(10);

        if ($externalLinks->isNotEmpty()) {
            $data['external_source_url'] = $externalLinks->first();
        } elseif (array_key_exists('external_source_url', $data)) {
            $data['external_source_url'] = trim((string) $data['external_source_url']) !== ''
                ? trim((string) $data['external_source_url'])
                : null;
        }

        $filesToUpload = [];
        if (array_key_exists('files', $data) && is_array($data['files'])) {
            $filesToUpload = array_values(array_filter($data['files']));
        } elseif (array_key_exists('file', $data) && $data['file'] !== null) {
            $filesToUpload = [$data['file']];
        }

        if ($externalLinks->isEmpty() && empty($data['external_source_url']) && count($filesToUpload) === 0) {
            throw ValidationException::withMessages([
                'evidence' => 'Укажите хотя бы одну ссылку на внешний источник или прикрепите файл подтверждения.',
            ]);
        }

        // Stage is always 'fact' — seasons are no longer stage-separated.
        $data['stage'] = KpiPeriod::STAGE_FACT;

        $indicator = KpiIndicator::query()
            ->active()
            ->forEntityType($entityType)
            ->whereKey((int) $data['indicator_id'])
            ->first();

        if (!$indicator) {
            return $this->errorResponse($request, 'Индикатор не найден или неактивен.');
        }

        if ((string) $indicator->section !== (string) $data['module']) {
            throw ValidationException::withMessages([
                'module' => 'Выбранный показатель не соответствует модулю.',
            ]);
        }

        $requestedGroupCode = $this->normalizeGroupCodeInput((string) ($data['group_code'] ?? ''));
        $indicatorGroupCode = $this->normalizeGroupCodeInput(
            (string) ($indicator->group_code ?: $this->resolveGroupCode((string) $indicator->code))
        );

        if ($indicatorGroupCode === '' || $requestedGroupCode !== $indicatorGroupCode) {
            throw ValidationException::withMessages([
                'group_code' => 'Выбранный показатель не соответствует коду блока.',
            ]);
        }

        $period = $this->periodService->getCurrentOpenPeriod(
            KpiPeriod::STAGE_FACT,
            (int) $data['academic_year_id'],
        );

        if (!$period) {
            return $this->errorResponse($request, 'Нет активного KPI-сезона для выбранного учебного года.');
        }

        $data['calculation_details'] = $this->normalizeRuleDrivenCalculationDetails(
            $indicator,
            $data['calculation_details'] ?? null,
        );

        $this->assertIndicatorValueRules($indicator, $data['value'] ?? null, 'value');
        $this->assertRuleDrivenFields($indicator, $data['calculation_details'] ?? null, 'value');
        $resolvedManualPoints = $this->resolveRuleBasedManualPoints(
            $indicator,
            $data['value'] ?? null,
            $data['calculation_details'] ?? null,
        );

        $userFacultyId = $this->userFacultyId($user);
        $userDepartmentId = $this->userDepartmentId($user);

        try {
            $entry = DB::transaction(function () use ($user, $data, $period, $indicator, $userFacultyId, $userDepartmentId, $entityType, $filesToUpload, $resolvedManualPoints): KpiEntry {
                $entry = new KpiEntry([
                    'kpi_period_id' => $period->id,
                    'academic_year_id' => $period->academic_year_id,
                    'entity_type' => $entityType,
                    'user_id' => $user->id,
                    'faculty_id' => $userFacultyId,
                    'department_id' => $userDepartmentId,
                    'indicator_id' => $indicator->id,
                ]);

                if ((string) $data['stage'] === KpiPeriod::STAGE_PLAN) {
                    $entry->plan_value = $data['value'];
                }

                if ((string) $data['stage'] === KpiPeriod::STAGE_FACT) {
                    $entry->fact_value = $data['value'];
                }

                $entry->manual_points = $resolvedManualPoints;
                if ($entry->manual_points !== null) {
                    $entry->calculated_points = '0.00';
                } else {
                    $entry->calculated_points = $this->resolveAutoCalculatedPoints(
                        $indicator,
                        $entry->fact_value ?? $entry->plan_value,
                    );
                }
                $entry->calculation_details = $data['calculation_details'] ?? null;

                $entry->comment = $data['comment'] ?? null;
                $entry->external_source_url = $data['external_source_url'] ?? null;
                $entry->status = KpiEntry::STATUS_DRAFT;
                $entry->save();

                $coreFieldsChanged = $entry->wasChanged([
                    'plan_value',
                    'fact_value',
                    'manual_points',
                    'calculation_details',
                    'comment',
                    'external_source_url',
                ]);

                $uploadedFilesCount = 0;

                $this->assertTotalUploadSizeWithinLimit($filesToUpload);

                foreach ($filesToUpload as $file) {
                    $this->fileService->upload($entry, $file, $user->id);
                    $uploadedFilesCount++;
                }

                if ((string) $data['action'] === 'submit') {
                    $requiresRevision = in_array($entry->status, [
                        KpiEntry::STATUS_RETURNED,
                        KpiEntry::STATUS_REJECTED,
                    ], true);

                    if ($requiresRevision && !$coreFieldsChanged && $uploadedFilesCount === 0) {
                        throw new \RuntimeException('Сначала исправьте запись (или прикрепите новый файл) через форму редактирования, затем отправьте повторно.');
                    }

                    if ($indicator->requiresFile() && !$entry->files()->exists()) {
                        throw new \RuntimeException('Для этого индикатора требуется файл. Сохраните черновик и загрузите файл перед отправкой.');
                    }

                    if (!$entry->canBeSubmitted()) {
                        throw new \RuntimeException('Запись нельзя отправить в текущем статусе.');
                    }

                    $fromStatus = $entry->status;
                    $newStatus = KpiEntryService::resolveInitialSubmitStatus((string) $entry->entity_type);
                    $entry->status = $newStatus;
                    $entry->submitted_at = Carbon::now();
                    $entry->save();

                    KpiStatusLog::query()->create([
                        'kpi_entry_id' => $entry->id,
                        'from_status' => $fromStatus,
                        'to_status' => $newStatus,
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
            'stage' => ['nullable', 'string', Rule::in([
                KpiPeriod::STAGE_PLAN,
                KpiPeriod::STAGE_FACT,
            ])],
            'value' => ['required', 'integer', 'min:1'],
            'manual_points' => ['nullable', 'numeric'],
            'comment' => ['required', 'string'],
            'calculation_details' => ['nullable', 'array'],
            'external_source_url' => ['nullable', 'url', 'max:2048'],
            'external_source_urls' => ['nullable', 'array', 'max:10'],
            'external_source_urls.*' => ['nullable', 'url', 'max:2048'],
            'file' => ['nullable', 'file', 'max:102400'],
            'files' => ['nullable', 'array'],
            'files.*' => ['file', 'max:102400'],
        ]);

        $externalLinks = collect($data['external_source_urls'] ?? [])
            ->map(static fn($url) => trim((string) $url))
            ->filter(static fn($url) => $url !== '')
            ->values()
            ->take(10)
            ->all();

        $details = is_array($data['calculation_details'] ?? null)
            ? $data['calculation_details']
            : [];

        if (! empty($externalLinks)) {
            $details['external_source_urls'] = $externalLinks;
            $data['external_source_url'] = $externalLinks[0];
        } elseif (array_key_exists('external_source_url', $data)) {
            $data['external_source_url'] = trim((string) $data['external_source_url']) !== ''
                ? trim((string) $data['external_source_url'])
                : null;
            unset($details['external_source_urls']);
        }

        $data['calculation_details'] = ! empty($details) ? $details : null;

        $filesToUpload = [];
        if (array_key_exists('files', $data) && is_array($data['files'])) {
            $filesToUpload = array_values(array_filter($data['files']));
        } elseif (array_key_exists('file', $data) && $data['file'] !== null) {
            $filesToUpload = [$data['file']];
        }

        $entry->loadMissing('files');
        $hasAnyFile = count($filesToUpload) > 0 || $entry->files->isNotEmpty();
        $hasAnyLink = ! empty($externalLinks) || ! empty($data['external_source_url']) || ! empty($entry->external_source_url);

        if (! $hasAnyFile && ! $hasAnyLink) {
            throw ValidationException::withMessages([
                'evidence' => 'Укажите хотя бы одну ссылку на внешний источник или прикрепите файл подтверждения.',
            ]);
        }

        $entry->loadMissing('period');
        $entry->loadMissing('indicator:id,base_points,unit');

        $stage = (string) ($data['stage'] ?? KpiPeriod::STAGE_FACT);

        $data['calculation_details'] = $this->normalizeRuleDrivenCalculationDetails(
            $entry->indicator,
            $data['calculation_details'] ?? null,
        );

        $this->assertIndicatorValueRules(
            $entry->indicator,
            $data['value'] ?? null,
            'value',
        );
        $this->assertRuleDrivenFields($entry->indicator, $data['calculation_details'] ?? null, 'value');
        $resolvedManualPoints = $this->resolveRuleBasedManualPoints(
            $entry->indicator,
            $data['value'] ?? null,
            $data['calculation_details'] ?? null,
        );

        if (array_key_exists('value', $data) && $stage === KpiPeriod::STAGE_PLAN) {
            $entry->plan_value = $data['value'];
        }

        if (array_key_exists('value', $data) && $stage === KpiPeriod::STAGE_FACT) {
            $entry->fact_value = $data['value'];
        }

        $entry->manual_points = $resolvedManualPoints;
        if ($entry->manual_points !== null) {
            $entry->calculated_points = '0.00';
        } else {
            $entry->calculated_points = $this->resolveAutoCalculatedPoints(
                $entry->indicator,
                $entry->fact_value ?? $entry->plan_value,
            );
        }
        $entry->comment = $data['comment'] ?? null;
        $entry->calculation_details = $data['calculation_details'] ?? null;
        $entry->external_source_url = $data['external_source_url'] ?? null;
        $entry->save();

        $this->assertTotalUploadSizeWithinLimit($filesToUpload);

        foreach ($filesToUpload as $file) {
            $this->fileService->upload($entry, $file, $request->user()?->id);
        }

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

        $this->assertIndicatorValueRules(
            $entry->indicator,
            $entry->fact_value ?? $entry->plan_value,
            'value',
        );
        $this->assertRuleDrivenFields($entry->indicator, $entry->calculation_details, 'value');

        if ($entry->entity_type === KpiEntry::ENTITY_TYPE_TEACHER) {
            $entry->faculty_id = $entry->faculty_id ?? $this->userFacultyId($request->user());
            $entry->department_id = $entry->department_id ?? $this->userDepartmentId($request->user());
        }

        if ($entry->indicator?->requiresFile() && !$entry->files()->exists()) {
            return $this->errorResponse($request, 'Для этого индикатора требуется файл перед отправкой.');
        }

        $fromStatus = $entry->status;
        $newStatus = KpiEntryService::resolveInitialSubmitStatus((string) $entry->entity_type);
        $entry->status = $newStatus;
        $entry->submitted_at = Carbon::now();
        $entry->save();

        KpiStatusLog::query()->create([
            'kpi_entry_id' => $entry->id,
            'from_status' => $fromStatus,
            'to_status' => $newStatus,
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
        $this->authorize('delete', $entry);

        $this->fileService->purgeForEntry($entry);
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
        $this->assertBulkEntryValueRules($data['entries'], 'plan');

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
        $this->assertBulkEntryValueRules($data['entries'], 'fact');

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
        $this->abortIfNotQueueAccess($request->user(), KpiAccessGrant::PERM_REVIEW_QUEUE);

        $payload = $this->buildModerationQueuePayload($request, KpiEntry::STATUS_SUBMITTED);

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/ReviewQueue', $payload);
    }

    public function approvalQueue(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);
        $this->abortIfNotQueueAccess($request->user(), KpiAccessGrant::PERM_APPROVAL_QUEUE);

        $payload = $this->buildModerationQueuePayload($request, KpiEntry::STATUS_PENDING_DEAN);

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/ApprovalQueue', $payload);
    }

    public function structuralQueue(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);
        $this->abortIfNotQueueAccess($request->user(), KpiAccessGrant::PERM_STRUCTURAL_QUEUE);

        $payload = $this->buildModerationQueuePayload($request, KpiEntry::STATUS_PENDING_STRUCTURAL);

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/StructuralQueue', $payload);
    }

    public function approvedEmployees(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiEntry::class);

        $entityType = $request->get('entity_type', KpiEntry::ENTITY_TYPE_TEACHER);
        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');
        $search = trim((string) $request->get('search', ''));

        $validEntityTypes = [
            KpiEntry::ENTITY_TYPE_TEACHER,
            KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD,
            KpiEntry::ENTITY_TYPE_DEAN,
        ];

        if (!in_array($entityType, $validEntityTypes, true)) {
            $entityType = KpiEntry::ENTITY_TYPE_TEACHER;
        }

        $query = KpiEntry::query()
            ->where('status', KpiEntry::STATUS_APPROVED)
            ->where('entity_type', $entityType)
            ->when($academicYearId > 0, fn(Builder $q) => $q->where('academic_year_id', $academicYearId))
            ->when($periodId > 0, fn(Builder $q) => $q->where('kpi_period_id', $periodId))
            ->select('user_id', 'faculty_id', 'department_id', 'academic_year_id', 'kpi_period_id')
            ->selectRaw('COUNT(*) as approved_count')
            ->selectRaw('ROUND(SUM(COALESCE(manual_points, calculated_points, 0)), 2) as total_points')
            ->selectRaw('MAX(approved_at) as last_approved_at')
            ->groupBy('user_id', 'faculty_id', 'department_id', 'academic_year_id', 'kpi_period_id');

        $rows = $query->get();

        $userIds = $rows->pluck('user_id')->unique()->values();

        $users = User::query()
            ->whereIn('id', $userIds)
            ->when($search !== '', fn(Builder $q) => $q->where(function (Builder $inner) use ($search): void {
                $inner->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('ad_department', 'like', "%{$search}%");
            }))
            ->get(['id', 'name', 'email', 'ad_department', 'ad_title'])
            ->keyBy('id');

        $departmentIds = $rows->pluck('department_id')->filter()->unique();

        $departments = Department::query()->whereIn('id', $departmentIds)->get(['id', 'name', 'faculty_id'])->keyBy('id');
        $facultyIds = $rows->pluck('faculty_id')
            ->filter()
            ->merge($departments->pluck('faculty_id')->filter())
            ->unique();

        $faculties = Faculty::query()->whereIn('id', $facultyIds)->get(['id', 'name'])->keyBy('id');

        $employees = $rows
            ->filter(fn($row) => $users->has($row->user_id))
            ->map(fn($row) => [
                'user_id' => $row->user_id,
                'name' => $users[$row->user_id]->name,
                'email' => $users[$row->user_id]->email,
                'ad_department' => $users[$row->user_id]->ad_department,
                'ad_title' => $users[$row->user_id]->ad_title,
                'department' => $row->department_id ? ($departments[$row->department_id]?->name ?? null) : null,
                'faculty' => $row->faculty_id
                    ? ($faculties[$row->faculty_id]?->name ?? null)
                    : ($row->department_id ? ($faculties[$departments[$row->department_id]?->faculty_id]?->name ?? null) : null),
                'approved_count' => (int) $row->approved_count,
                'total_points' => (float) $row->total_points,
                'last_approved_at' => $row->last_approved_at,
                'academic_year_id' => $row->academic_year_id,
                'kpi_period_id' => $row->kpi_period_id,
            ])
            ->sortByDesc('total_points')
            ->values();

        $academicYears = AcademicYear::query()->orderByDesc('start_year')->get(['id', 'name']);
        $periods = KpiPeriod::query()
            ->when($academicYearId > 0, fn(Builder $q) => $q->where('academic_year_id', $academicYearId))
            ->orderByDesc('start_date')
            ->get(['id', 'name', 'stage', 'status', 'academic_year_id']);

        $payload = [
            'employees' => $employees,
            'filters' => [
                'entity_type' => $entityType,
                'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
                'period_id' => $periodId > 0 ? $periodId : null,
                'search' => $search !== '' ? $search : null,
            ],
            'academicYears' => $academicYears,
            'periods' => $periods,
        ];

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/ApprovedEmployees', $payload);
    }

    public function approve(Request $request, KpiEntry $entry): RedirectResponse|JsonResponse
    {
        $this->authorize('approve', $entry);

        $data = $request->validate([
            'comment' => ['nullable', 'string'],
        ]);

        try {
            $approved = $this->entryService->approveEntry($entry, $request->user(), $data['comment'] ?? null);
            $successMessage = match ($approved->status) {
                KpiEntry::STATUS_PENDING_DEAN => 'KPI-запись передана на корректировку декану.',
                KpiEntry::STATUS_PENDING_STRUCTURAL => 'KPI-запись передана на финальное утверждение СП.',
                KpiEntry::STATUS_APPROVED => 'KPI-запись утверждена.',
                default => 'KPI-запись обновлена.',
            };

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $successMessage,
                    'data' => $approved,
                ]);
            }

            return back()->with('success', $successMessage);
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
        $actorStructuralUnitIds = $this->resolveStructuralUnitIds($request->user())->values();
        $roleSlug = $request->user()?->resolvedRoleSlug();

        $entry->load([
            'period:id,name,stage,status,start_date,end_date',
            'academicYear:id,name,start_year,end_year',
            'user:id,name,email,faculty_id,department_id',
            'user.faculty:id,name',
            'user.department:id,name',
            'indicator:id,entity_type,section,code,name,description,unit,requires_file,base_points,checker_structural_unit_id',
            'indicator.checkerStructuralUnit:id,code,name',
            'indicator.structuralUnits:id,code,name',
            'structuralConfirmations:id,kpi_record_id,structural_unit_id,confirmed_by,status,comment,confirmed_at',
            'structuralConfirmations.structuralUnit:id,code,name',
            'structuralConfirmations.confirmer:id,name,display_name',
            'files:id,kpi_entry_id,file_name,file_path,file_disk,file_type,file_size,uploaded_by',
            'statusLogs.actor:id,name',
            'faculty:id,name',
            'department:id,name',
        ]);

        if ($entry->faculty_id === null && $entry->user?->faculty_id !== null) {
            $entry->setRelation('faculty', $entry->user->faculty);
        }

        if ($entry->department_id === null && $entry->user?->department_id !== null) {
            $entry->setRelation('department', $entry->user->department);
        }

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
            'moderationContext' => [
                'role_slug' => $roleSlug,
                'is_admin' => in_array($roleSlug, ['admin', 'superadmin'], true) || KpiAccessGrant::userHasKpiAdmin((int) $request->user()?->id),
                'actor_structural_unit_ids' => $actorStructuralUnitIds->all(),
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

    public function destroyFile(Request $request, KpiEntry $entry, KpiEntryFile $file): RedirectResponse|JsonResponse
    {
        $this->authorize('update', $entry);

        if ((int) $file->kpi_entry_id !== (int) $entry->id) {
            abort(404);
        }

        try {
            $this->fileService->deleteFile($entry, $file);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Файл удален.',
                ]);
            }

            return back()->with('success', 'Файл удален.');
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
            'entries.*.' . $valueField => ['nullable', 'integer', 'min:1'],
            'entries.*.manual_points' => ['nullable', 'numeric'],
            'entries.*.comment' => ['nullable', 'string'],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $entries
     */
    private function assertBulkEntryValueRules(array $entries, string $mode): void
    {
        if (empty($entries)) {
            return;
        }

        $valueField = $mode === 'plan' ? 'plan_value' : 'fact_value';
        $indicatorIds = collect($entries)
            ->pluck('indicator_id')
            ->filter()
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values();

        $indicators = KpiIndicator::query()
            ->whereIn('id', $indicatorIds)
            ->get(['id', 'unit'])
            ->keyBy('id');

        foreach ($entries as $index => $entry) {
            $indicator = $indicators->get((int) ($entry['indicator_id'] ?? 0));
            if (! $indicator) {
                continue;
            }

            $this->assertIndicatorValueRules(
                $indicator,
                $entry[$valueField] ?? null,
                sprintf('entries.%d.%s', $index, $valueField),
            );
        }
    }

    /**
     * @param mixed $value
     */
    private function assertIndicatorValueRules(?KpiIndicator $indicator, $value, string $field): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $numericValue = (float) $value;

        if ($numericValue <= 0) {
            throw ValidationException::withMessages([
                $field => 'Значение KPI должно быть целым числом больше 0.',
            ]);
        }

        if (! $this->isWholeNumber($numericValue)) {
            throw ValidationException::withMessages([
                $field => 'Значение KPI должно быть целым числом.',
            ]);
        }
    }

    private function assertRuleDrivenFields(?KpiIndicator $indicator, $details, string $field): void
    {
        $ruleKind = $this->detectIndicatorRuleKind($indicator);
        if ($ruleKind === 'none') {
            return;
        }

        $details = is_array($details) ? $details : [];

        if ($ruleKind === 'coauthors') {
            if (! $this->isPositiveWholeNumber($details['sheet_count'] ?? null)) {
                throw ValidationException::withMessages([
                    'rule_sheet_count' => 'Количество печатных листов должно быть целым числом больше 0.',
                ]);
            }

            if (! $this->isPositiveWholeNumber($details['coauthors_count'] ?? null)) {
                throw ValidationException::withMessages([
                    'rule_coauthors_count' => 'Количество соавторов должно быть целым числом больше 0.',
                ]);
            }

            return;
        }

        if (in_array($ruleKind, ['podium', 'improvement', 'roleSplit', 'quartile', 'optionRate'], true)) {
            $selectionPoints = $this->parseNumericValue($details['selection_points'] ?? null);

            $isMissingSelection = $selectionPoints === null;
            $requiresPositiveSelection = in_array($ruleKind, ['podium', 'roleSplit', 'quartile'], true);
            $isInvalidPositiveSelection = $requiresPositiveSelection && $selectionPoints !== null && $selectionPoints <= 0;

            if ($isMissingSelection || $isInvalidPositiveSelection) {
                throw ValidationException::withMessages([
                    $field => 'Для выбранного индикатора нужно заполнить все поля расчета по правилу.',
                ]);
            }
        }
    }

    private function resolveRuleBasedManualPoints(?KpiIndicator $indicator, $value, $details): ?string
    {
        $ruleKind = $this->detectIndicatorRuleKind($indicator);
        if ($ruleKind === 'none') {
            return null;
        }

        $quantity = $this->parseNumericValue($value);
        if ($quantity === null || $quantity <= 0) {
            return null;
        }

        $details = is_array($details) ? $details : [];

        if ($ruleKind === 'coauthors') {
            $perSheet = $this->parseNumericValue($details['per_sheet_points'] ?? ($indicator?->base_points ?? 0)) ?? 0.0;
            $sheetCount = $this->parseNumericValue($details['sheet_count'] ?? null);
            $coauthorsCount = $this->parseNumericValue($details['coauthors_count'] ?? null);

            if ($sheetCount === null || $coauthorsCount === null || $sheetCount <= 0 || $coauthorsCount <= 0) {
                return null;
            }

            return number_format($quantity * $perSheet * $sheetCount / $coauthorsCount, 2, '.', '');
        }

        $selectionPoints = $this->parseNumericValue($details['selection_points'] ?? null);
        if ($selectionPoints === null) {
            return null;
        }

        if (in_array($ruleKind, ['podium', 'roleSplit', 'quartile'], true) && $selectionPoints <= 0) {
            return null;
        }

        return number_format($quantity * $selectionPoints, 2, '.', '');
    }

    private function detectIndicatorRuleKind(?KpiIndicator $indicator): string
    {
        $rawRules = preg_replace('/\s+/u', ' ', trim((string) ($indicator?->scoring_rules ?? '')));
        $lowerRules = mb_strtolower($rawRules);

        if ($lowerRules === '') {
            return 'none';
        }

        if (str_contains($lowerRules, '1 место') && str_contains($lowerRules, '2 место') && str_contains($lowerRules, '3 место')) {
            return 'podium';
        }

        if (str_contains($lowerRules, 'улучш') && str_contains($lowerRules, 'ухудш')) {
            return 'improvement';
        }

        if (str_contains($lowerRules, 'соавтор') && str_contains($lowerRules, 'п.л')) {
            return 'coauthors';
        }

        if (str_contains($lowerRules, 'руководитель') && str_contains($lowerRules, 'исполнитель')) {
            return 'roleSplit';
        }

        if ((str_contains($lowerRules, 'q1') || str_contains($lowerRules, 'q2')) && (str_contains($lowerRules, 'wos') || str_contains($lowerRules, 'scopus'))) {
            return 'quartile';
        }

        if (count($this->parseScoringRuleOptions($rawRules)) >= 2) {
            return 'optionRate';
        }

        return 'none';
    }

    private function parseScoringRuleOptions(string $rawRules): array
    {
        $text = trim(preg_replace('/\s+/u', ' ', $rawRules));
        if ($text === '') {
            return [];
        }

        $parts = preg_split('/\s*[\/;]\s*/u', $text) ?: [];
        $options = [];

        foreach ($parts as $part) {
            $part = trim(str_replace('−', '-', $part));
            if ($part === '') {
                continue;
            }

            if (preg_match('/^(.+?)\s*:\s*([-+]?\d+(?:[.,]\d+)?)\s*б/iu', $part)) {
                $options[] = $part;
                continue;
            }

            if (preg_match('/^([-+]?\d+(?:[.,]\d+)?)\s*балл(?:а|ов)?\s+за\s+(.+)$/iu', $part)) {
                $options[] = $part;
            }
        }

        return $options;
    }

    private function parseNumericValue($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $normalized = str_replace(['−', ','], ['-', '.'], trim((string) $value));
        if (! is_numeric($normalized)) {
            return null;
        }

        return (float) $normalized;
    }

    /**
     * Normalize rule payload to avoid sign inversions from stale frontend bundles.
     *
     * @param mixed $details
     * @return array<string, mixed>|null
     */
    private function normalizeRuleDrivenCalculationDetails(?KpiIndicator $indicator, $details): ?array
    {
        if (!is_array($details)) {
            return null;
        }

        $ruleKind = $this->detectIndicatorRuleKind($indicator);
        if ($ruleKind !== 'improvement') {
            return !empty($details) ? $details : null;
        }

        $selectionPoints = $this->parseNumericValue($details['selection_points'] ?? null);
        $selectionLabel = mb_strtolower(trim((string) ($details['selection_label'] ?? '')));

        if ($selectionPoints !== null) {
            if ($selectionLabel !== '' && str_contains($selectionLabel, 'ухудш') && $selectionPoints > 0) {
                $selectionPoints = -1 * abs($selectionPoints);
            }

            if ($selectionLabel !== '' && str_contains($selectionLabel, 'улучш') && $selectionPoints < 0) {
                $selectionPoints = abs($selectionPoints);
            }

            $details['selection_points'] = $selectionPoints;
        }

        return !empty($details) ? $details : null;
    }

    private function isPositiveWholeNumber($value): bool
    {
        $parsed = $this->parseNumericValue($value);
        return $parsed !== null && $parsed > 0 && $this->isWholeNumber($parsed);
    }

    private function resolveAutoCalculatedPoints(?KpiIndicator $indicator, ?float $value): string
    {
        if (! $indicator || $value === null || $value <= 0) {
            return '0.00';
        }

        $basePoints = (float) ($indicator->base_points ?? 0);
        $calculated = $basePoints * (float) $value;

        return number_format($calculated, 2, '.', '');
    }

    private function isWholeNumber(float $value): bool
    {
        return abs($value - round($value)) < 0.000001;
    }

    private function visibleEntriesQuery(User $user): Builder
    {
        $query = KpiEntry::query();
        $role = $user->resolvedRoleSlug();

        if ($role === 'admin' || $role === 'superadmin') {
            return $query;
        }

        if ($role === 'teacher') {
            if (
                KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_REVIEW_QUEUE)
                || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_APPROVAL_QUEUE)
                || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                || KpiAccessGrant::userHasKpiAdmin($user->id)
            ) {
                return $query;
            }

            return $query->where('user_id', $user->id);
        }

        if ($role === 'department_head' || $role === 'hod') {
            $departmentId = $this->userDepartmentId($user);

            return $query->where(function (Builder $q) use ($departmentId): void {
                $q->where('department_id', $departmentId ?? 0)
                    ->orWhere(function (Builder $inner): void {
                        $inner->whereNull('faculty_id')->whereNull('department_id');
                    });
            });
        }

        if ($role === 'dean') {
            $facultyId = $this->userFacultyId($user);

            return $query->where(function (Builder $q) use ($facultyId): void {
                $q->where('faculty_id', $facultyId ?? 0)
                    ->orWhere(function (Builder $inner): void {
                        $inner->whereNull('faculty_id')->whereNull('department_id');
                    });
            });
        }

        if (in_array($role, ['department', 'structural'], true)) {
            $divisionIds = collect();
            $hasUnrestricted = false;

            if ($role === 'structural') {
                $divisionIds = $this->resolveStructuralUnitIds($user);
            } else {
                // Legacy department access is driven by explicit grants.
                $grants = KpiAccessGrant::query()
                    ->where('user_id', $user->id)
                    ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                    ->where('is_active', true)
                    ->get(['division_id']);

                $divisionIds = $this->mapLegacyDivisionIdsToStructuralUnitIds(
                    $grants->whereNotNull('division_id')->pluck('division_id')
                );
                $hasUnrestricted = $grants->where('division_id', null)->isNotEmpty();
            }

            if ($hasUnrestricted) {
                return $query->whereIn('status', [
                    KpiEntry::STATUS_PENDING_STRUCTURAL,
                    KpiEntry::STATUS_APPROVED,
                    KpiEntry::STATUS_REJECTED,
                ]);
            }

            if ($divisionIds->isNotEmpty()) {
                return $query
                    ->whereIn('status', [
                        KpiEntry::STATUS_PENDING_STRUCTURAL,
                        KpiEntry::STATUS_APPROVED,
                        KpiEntry::STATUS_REJECTED,
                    ])
                    ->whereHas('indicator', function (Builder $ind) use ($divisionIds): void {
                        $ind->where(function (Builder $q) use ($divisionIds): void {
                            $q->whereIn('checker_structural_unit_id', $divisionIds)
                                ->orWhereHas('structuralUnits', function (Builder $units) use ($divisionIds): void {
                                    $units->whereIn('kpi_structural_units.id', $divisionIds);
                                });
                        });
                    });
            }

            // For legacy department users without configured grants keep own records only.
            if ($role === 'department') {
                return $query->where('user_id', $user->id);
            }

            // Structural role without assigned divisions sees no structural queue records.
            return $query->whereRaw('1 = 0');
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
        $sort = trim((string) $request->query('sort', 'newest'));
        if (!in_array($sort, ['newest', 'oldest'], true)) {
            $sort = 'newest';
        }
        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');
        $departmentId = $request->integer('department_id');
        $facultyId = $request->integer('faculty_id');
        $userId = $request->integer('user_id');
        $tab = trim((string) $request->query('tab', 'scope')); // 'scope' | 'unlinked'

        $roleSlug = $user->resolvedRoleSlug();
        $isHodOrDean = in_array($roleSlug, ['department_head', 'hod', 'dean'], true);
        $userFacultyId = $this->userFacultyId($user);
        $userDepartmentId = $this->userDepartmentId($user);

        $baseQuery = $this->visibleEntriesQuery($user);

        // For unlinked tab: restrict to entries with null faculty AND null department
        $scopedBase = (clone $baseQuery);
        if ($isHodOrDean && $tab === 'unlinked') {
            $scopedBase->whereNull('faculty_id')->whereNull('department_id');
        } elseif ($isHodOrDean && $tab === 'scope') {
            // Restrict to only the scoped entries (exclude unlinked)
            if (in_array($roleSlug, ['department_head', 'hod'], true)) {
                $scopedBase->where('department_id', $userDepartmentId ?? 0);
            } else {
                // dean
                $scopedBase->where('faculty_id', $userFacultyId ?? 0);
            }
        }

        $entriesQuery = $this->applyQueueFilters(
            (clone $scopedBase)->with([
                'user:id,name,email,faculty_id,department_id',
                'user.faculty:id,name',
                'user.department:id,name',
                'period:id,name,stage,status,academic_year_id,start_date,end_date',
                'indicator:id,code,name,section,base_points,checker_structural_unit_id',
                'indicator.checkerStructuralUnit:id,code,name',
                'indicator.structuralUnits:id,code,name',
                'structuralConfirmations:id,kpi_record_id,structural_unit_id,confirmed_by,status,comment,confirmed_at',
                'structuralConfirmations.structuralUnit:id,code,name',
                'structuralConfirmations.confirmer:id,name,display_name',
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
            ->when(
                $sort === 'oldest',
                fn(Builder $query) => $query->orderBy('created_at')->orderBy('id'),
                fn(Builder $query) => $query->orderByDesc('created_at')->orderByDesc('id')
            )
            ->paginate(15)
            ->withQueryString();

        $entries->getCollection()->transform(function (KpiEntry $entry) use ($tab): KpiEntry {
            if ($tab === 'unlinked') {
                return $entry;
            }

            if ($entry->faculty_id === null && $entry->user?->faculty_id !== null) {
                $entry->setRelation('faculty', $entry->user->faculty);
            }

            if ($entry->department_id === null && $entry->user?->department_id !== null) {
                $entry->setRelation('department', $entry->user->department);
            }

            return $entry;
        });

        $academicYears = AcademicYear::query()
            ->orderByDesc('start_year')
            ->get(['id', 'name', 'start_year', 'end_year'])
            ->unique('id')
            ->values();

        $periods = KpiPeriod::query()
            ->when($academicYearId > 0, fn(Builder $query) => $query->where('academic_year_id', $academicYearId))
            ->orderByDesc('start_date')
            ->get(['id', 'name', 'stage', 'status', 'academic_year_id']);

        $userFacultyId = $this->userFacultyId($user);
        $userDepartmentId = $this->userDepartmentId($user);

        // Count unlinked entries (faculty_id IS NULL AND department_id IS NULL) for badge
        $unlinkedCount = $isHodOrDean
            ? $this->applyQueueFilters(
                (clone $baseQuery)->whereNull('faculty_id')->whereNull('department_id'),
                $academicYearId,
                $periodId,
                $status,
                0,
                0,
                $userId,
            )->count()
            : 0;

        $faculties = Faculty::query()
            ->when($userFacultyId !== null, fn(Builder $query) => $query->whereKey($userFacultyId))
            ->orderBy('name')
            ->get(['id', 'name']);

        $departments = Department::query()
            ->when($userDepartmentId !== null, fn(Builder $query) => $query->whereKey($userDepartmentId))
            ->orderBy('name')
            ->get(['id', 'name']);

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

        $requiredQueuePermission = match ($defaultStatus) {
            KpiEntry::STATUS_SUBMITTED => KpiAccessGrant::PERM_REVIEW_QUEUE,
            KpiEntry::STATUS_PENDING_DEAN => KpiAccessGrant::PERM_APPROVAL_QUEUE,
            KpiEntry::STATUS_PENDING_STRUCTURAL => KpiAccessGrant::PERM_STRUCTURAL_QUEUE,
            default => null,
        };

        $canModerateByGrant = $requiredQueuePermission !== null
            && KpiAccessGrant::userHas($user->id, $requiredQueuePermission);

        $roleSlug = $user->resolvedRoleSlug();
        $reviewScope = null;
        $structuralScope = null;
        $actorStructuralUnitIds = $this->resolveStructuralUnitIds($user);

        if (in_array($roleSlug, ['department_head', 'hod'], true)) {
            $departmentName = Department::query()
                ->whereKey($userDepartmentId)
                ->value('name');

            $reviewScope = [
                'type' => 'department',
                'label' => $departmentName ?: ($user->ad_department ?: 'Не указана кафедра'),
            ];
        } elseif ($roleSlug === 'dean') {
            $facultyName = Faculty::query()
                ->whereKey($userFacultyId)
                ->value('name');

            $reviewScope = [
                'type' => 'faculty',
                'label' => $facultyName ?: 'Не указан факультет',
            ];
        }

        // For structural queue mode - determine what divisions/access user has
        if ($defaultStatus === KpiEntry::STATUS_PENDING_STRUCTURAL) {
            if (in_array($roleSlug, ['admin', 'superadmin'], true) || KpiAccessGrant::userHasKpiAdmin($user->id)) {
                $adminDivisionIds = KpiStructuralUnit::query()->pluck('id')->map(fn($id) => (int) $id)->values();

                $structuralScope = [
                    'type' => 'admin',
                    'label' => 'Вы видите все записи (администратор)',
                    'actor_division_ids' => $adminDivisionIds,
                ];
            } elseif ($roleSlug === 'structural') {
                $divisionIds = $this->resolveStructuralUnitIds($user);

                if ($divisionIds->isNotEmpty()) {
                    $divisions = KpiStructuralUnit::query()
                        ->whereIn('id', $divisionIds)
                        ->get(['id', 'code', 'name']);

                    $structuralScope = [
                        'type' => 'divisions',
                        'label' => $divisions->count() === 1
                            ? 'Вы просматриваете KPI отдела:'
                            : 'Вы просматриваете KPI отделов:',
                        'divisions' => $divisions,
                        'actor_division_ids' => $divisionIds,
                    ];
                } else {
                    $structuralScope = [
                        'type' => 'info',
                        'label' => 'Подразделение сотрудника: ' . ($user->ad_division ?: 'не назначено') . '.',
                        'actor_division_ids' => $actorStructuralUnitIds,
                    ];
                }
            } elseif ($roleSlug === 'department') {
                // For structural queue - check if user is assigned to specific divisions
                $grants = KpiAccessGrant::query()
                    ->where('user_id', $user->id)
                    ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                    ->where('is_active', true)
                    ->get(['division_id']);

                $divisionIds = $this->mapLegacyDivisionIdsToStructuralUnitIds(
                    $grants->whereNotNull('division_id')->pluck('division_id')
                );
                $hasUnrestricted = $grants->where('division_id', null)->isNotEmpty();

                if ($hasUnrestricted) {
                    $structuralScope = [
                        'type' => 'unrestricted',
                        'label' => 'Вы видите все записи (без ограничений)',
                        'actor_division_ids' => $actorStructuralUnitIds,
                    ];
                } elseif ($divisionIds->isNotEmpty()) {
                    $divisions = KpiStructuralUnit::query()
                        ->whereIn('id', $divisionIds)
                        ->get(['id', 'code', 'name']);

                    $structuralScope = [
                        'type' => 'divisions',
                        'label' => 'Вы видите записи подразделений:',
                        'divisions' => $divisions,
                        'actor_division_ids' => $divisionIds,
                    ];
                }
            } elseif ($roleSlug === 'teacher' && KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)) {
                // Teacher with structural queue access
                $grants = KpiAccessGrant::query()
                    ->where('user_id', $user->id)
                    ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                    ->where('is_active', true)
                    ->get(['division_id']);

                $divisionIds = $this->mapLegacyDivisionIdsToStructuralUnitIds(
                    $grants->whereNotNull('division_id')->pluck('division_id')
                );
                $hasUnrestricted = $grants->where('division_id', null)->isNotEmpty();

                if ($hasUnrestricted) {
                    $structuralScope = [
                        'type' => 'unrestricted',
                        'label' => 'Вы видите все записи (без ограничений)',
                        'actor_division_ids' => $actorStructuralUnitIds,
                    ];
                } elseif ($divisionIds->isNotEmpty()) {
                    $divisions = KpiStructuralUnit::query()
                        ->whereIn('id', $divisionIds)
                        ->get(['id', 'code', 'name']);

                    $structuralScope = [
                        'type' => 'divisions',
                        'label' => 'Вы видите записи подразделений:',
                        'divisions' => $divisions,
                        'actor_division_ids' => $divisionIds,
                    ];
                }
            }
        }

        $canAdminModerate = in_array($roleSlug, ['admin', 'superadmin'], true)
            || KpiAccessGrant::userHasKpiAdmin($user->id);

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
                'sort' => $sort,
                'department_id' => $departmentId > 0 ? $departmentId : null,
                'faculty_id' => $facultyId > 0 ? $facultyId : null,
                'user_id' => $userId > 0 ? $userId : null,
                'tab' => $tab,
            ],
            'permissions' => [
                'canModerate' => $user->resolvedRoleSlug() !== 'teacher' || $canModerateByGrant || KpiAccessGrant::userHasKpiAdmin($user->id),
                'canAdminModerate' => $canAdminModerate,
            ],
            'reviewScope' => $reviewScope,
            'structuralScope' => $structuralScope,
            'activeTab' => $tab,
            'unlinkedCount' => $unlinkedCount,
            'showTabs' => $isHodOrDean,
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

    /**
     * Блокирует доступ к очереди, если:
     * - пользователь — учитель без соответствующего гранта
     * Пользователи с активным грантом всегда пропускаются.
     */
    private function abortIfNotQueueAccess(User $user, string $permission): void
    {
        // Грант разрешает вход независимо от роли
        if (KpiAccessGrant::userHas($user->id, $permission)) {
            return;
        }

        // Учителя без гранта — запрет
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

    /**
     * @return Collection<int, int>
     */
    private function resolveStructuralUnitIds(User $user): Collection
    {
        $divisionIds = $user->kpiStructuralUnits()->pluck('kpi_structural_units.id');

        if ($divisionIds->isNotEmpty()) {
            return $divisionIds->unique()->values();
        }

        $grantDivisionIds = KpiAccessGrant::query()
            ->where('user_id', $user->id)
            ->where('permission', KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
            ->where('is_active', true)
            ->whereNotNull('division_id')
            ->pluck('division_id');

        if ($grantDivisionIds->isNotEmpty()) {
            return $this->mapLegacyDivisionIdsToStructuralUnitIds($grantDivisionIds);
        }

        $adDivision = trim((string) $user->ad_division);

        if ($adDivision === '') {
            return collect();
        }

        $normalized = mb_strtolower($adDivision);

        $exact = KpiStructuralUnit::query()
            ->whereRaw('LOWER(TRIM(name)) = ?', [$normalized])
            ->orWhereRaw('LOWER(TRIM(code)) = ?', [$normalized])
            ->pluck('id')
            ->unique()
            ->values();

        if ($exact->isNotEmpty()) {
            return $exact;
        }

        $aliases = [
            'омоиам' => 'ОМОиАМ',
            'ориа' => 'ОРиА',
            'умифк' => 'УМиФК',
            'уоп' => 'УОП',
            'унивс' => 'УНиВС',
            'цк' => 'ЦК',
            'ck' => 'ЦК',
            'cc' => 'ЦК',
            'оуп' => 'ОУП',
            'уокиа' => 'УОКиА',
            'виср' => 'ВиСР',
            'эф' => 'ЭФ',
        ];

        $units = KpiStructuralUnit::query()->get(['id', 'code', 'name']);

        foreach ($aliases as $needle => $code) {
            if (!str_contains($normalized, $needle)) {
                continue;
            }

            $match = $units->first(fn(KpiStructuralUnit $unit): bool => mb_strtolower(trim((string) $unit->code)) === mb_strtolower($code));
            if ($match) {
                return collect([(int) $match->id]);
            }
        }

        $fuzzy = $units
            ->filter(function (KpiStructuralUnit $unit) use ($normalized): bool {
                $code = mb_strtolower(trim((string) $unit->code));
                $name = mb_strtolower(trim((string) $unit->name));

                return ($code !== '' && str_contains($normalized, $code))
                    || ($name !== '' && str_contains($normalized, $name));
            })
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values();

        return $fuzzy;
    }

    /**
     * @param Collection<int, int|string> $legacyDivisionIds
     * @return Collection<int, int>
     */
    private function mapLegacyDivisionIdsToStructuralUnitIds(Collection $legacyDivisionIds): Collection
    {
        if ($legacyDivisionIds->isEmpty()) {
            return collect();
        }

        $legacyDivisions = Division::query()
            ->whereIn('id', $legacyDivisionIds->filter()->values())
            ->get(['id', 'code', 'name']);

        $unitMap = KpiStructuralUnit::query()
            ->get(['id', 'code', 'name'])
            ->keyBy(fn(KpiStructuralUnit $unit): string => mb_strtolower(trim((string) $unit->code)));

        $aliases = [
            'омоиам' => 'ОМОиАМ',
            'ориа' => 'ОРиА',
            'умифк' => 'УМиФК',
            'уоп' => 'УОП',
            'унивс' => 'УНиВС',
            'цк' => 'ЦК',
            'ck' => 'ЦК',
            'cc' => 'ЦК',
            'оуп' => 'ОУП',
            'уокиа' => 'УОКиА',
            'виср' => 'ВиСР',
            'эф' => 'ЭФ',
        ];

        return $legacyDivisions
            ->map(function (Division $division) use ($unitMap, $aliases): ?int {
                $candidates = [
                    mb_strtolower(trim((string) $division->code)),
                    mb_strtolower(trim((string) $division->name)),
                ];

                foreach ($candidates as $candidate) {
                    if ($candidate === '') {
                        continue;
                    }

                    if ($unitMap->has($candidate)) {
                        return (int) $unitMap->get($candidate)->id;
                    }

                    foreach ($aliases as $needle => $code) {
                        if (str_contains($candidate, $needle) && $unitMap->has(mb_strtolower($code))) {
                            return (int) $unitMap->get(mb_strtolower($code))->id;
                        }
                    }
                }

                return null;
            })
            ->filter()
            ->unique()
            ->values();
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
     * @param array<int, mixed> $files
     */
    private function assertTotalUploadSizeWithinLimit(array $files): void
    {
        $totalSize = 0;

        foreach ($files as $file) {
            $size = is_object($file) && method_exists($file, 'getSize') ? (int) $file->getSize() : 0;
            $totalSize += max(0, $size);
        }

        if ($totalSize > 100 * 1024 * 1024) {
            throw new \RuntimeException('Общий размер прикрепленных файлов не должен превышать 100 МБ.');
        }
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
                'files' => $entry?->files?->map(fn($file) => [
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

    private function resolveGroupLabel(string $entityType, string $groupCode): string
    {
        $map = [
            KpiIndicator::ENTITY_TYPE_TEACHER => [
                '1.1'  => 'Проектирование и актуализация ОП и курсов',
                '1.2'  => 'Разработка и издание учебных материалов',
                '1.3'  => 'Разработка онлайн-курсов (МООК)',
                '1.4'  => 'Чтение лекций в вузах-партнёрах',
                '2.1'  => 'Госбюджетные и инициативные НИР',
                '2.2'  => 'Публикация научных статей',
                '2.3'  => 'Тезисы и доклады на конференциях',
                '2.4'  => 'Охранные документы (патенты, авторские свидетельства)',
                '2.5'  => 'Публикация монографий',
                '2.6'  => 'Подготовка студентов (НИРС, конкурсы, стартапы)',
                '2.7'  => 'Экспертная деятельность',
                '3.1'  => 'Спортивные соревнования',
                '3.2'  => 'Профориентация абитуриентов',
                '3.3'  => 'Имиджевые публикации в СМИ',
                '3.4'  => 'Привлечение средств в Эндаумент фонд',
                '3.5'  => 'Привлечение экспертов в рейтинг QS',
                '4.1'  => 'Повышение квалификации',
                '4.1b' => 'Повышение квалификации (курсы и тренинги)',
            ],
            KpiIndicator::ENTITY_TYPE_DEPARTMENT_HEAD => [
                '1.1'  => 'Аккредитация образовательных программ',
                '1.10' => 'Доля дипломных работ/проектов по заказу предприятий',
                '1.2'  => 'Участие в национальных и международных рейтингах',
                '1.3'  => 'Гостевые лекции ППС из вузов-партнёров',
                '1.4'  => 'Академическая мобильность обучающихся',
                '1.5'  => 'Доля практикующих преподавателей',
                '1.6'  => 'Инновационные ОП бакалавриата',
                '1.7'  => 'Программы микроквалификаций',
                '1.8'  => 'Филиалы кафедр на предприятиях',
                '1.9'  => 'МООС на международных платформах',
                '1.11' => 'Стартап-проекты в дипломных работах',
                '1.12' => 'Дуальное обучение (дисциплины)',
                '1.13' => 'Дуальное обучение (обучающиеся)',
                '1.14' => 'Работа внутреннего аудитора',
                '1.15' => 'Проверки КРК',
                '2.1'  => 'Публикация научных статей',
                '2.2'  => 'Финансируемые НИР',
                '2.3'  => 'Научные стажировки молодых учёных',
                '3.1'  => 'Воспитательные мероприятия',
                '3.2'  => 'Спортивные соревнования',
                '3.3'  => 'Имиджевые публикации в СМИ',
                '3.4'  => 'Привлечение средств в Эндаумент фонд',
                '3.5'  => 'Привлечение экспертов в рейтинг QS',
                '3.6'  => 'Привлечение абитуриентов (выставки)',
                '3.7'  => 'Профориентация абитуриентов',
                '4.1'  => 'Повышение квалификации',
                '4.2'  => 'Трудоустройство выпускников',
            ],
            KpiIndicator::ENTITY_TYPE_DEAN => [
                '1.1'  => 'Контингент обучающихся (всего)',
                '1.2'  => 'Контингент по государственному гранту',
                '1.3'  => 'Гостевые лекции из вузов-партнёров',
                '1.4'  => 'Академическая мобильность обучающихся',
                '1.5'  => 'Доля магистрантов',
                '1.6'  => 'Трудоустройство выпускников бакалавриата',
                '1.7'  => 'Гранты и именные стипендии ректора',
                '1.8'  => 'Аккредитация образовательных программ',
                '1.9'  => 'Участие в национальных и международных рейтингах',
                '2.1'  => 'Публикация научных статей',
                '2.2'  => 'Организация научных мероприятий',
                '2.3'  => 'Подготовка научных и научно-педагогических кадров',
                '2.4'  => 'Финансируемые НИР',
                '2.5'  => 'Привлечение зарубежных учёных',
                '2.6'  => 'Государственные научные премии',
                '3.1'  => 'Воспитательные мероприятия',
                '3.2'  => 'Привлечение экспертов в рейтинг QS',
                '3.3'  => 'Имиджевые публикации в СМИ',
                '3.4'  => 'Привлечение средств в Эндаумент фонд',
                '3.5'  => 'Привлечение абитуриентов',
                '3.6'  => 'Профориентация абитуриентов',
                '4.1'  => 'Повышение квалификации',
            ],
        ];

        return $map[$entityType][$groupCode] ?? $groupCode;
    }

    private function resolveGroupCode(string $code): string
    {
        $parts = explode('.', trim($code));

        if (count($parts) >= 2) {
            return $parts[0] . '.' . $parts[1];
        }

        return $code;
    }

    private function normalizeGroupCodeInput(string $value): string
    {
        $normalized = trim($value);

        // Support UI values that may include label, e.g. "1.2 — Разработка ..."
        $normalized = preg_replace('/\s*[—-].*$/u', '', $normalized) ?? $normalized;
        $normalized = trim($normalized);

        if ($normalized === '') {
            return '';
        }

        return $this->resolveGroupCode($normalized);
    }
}

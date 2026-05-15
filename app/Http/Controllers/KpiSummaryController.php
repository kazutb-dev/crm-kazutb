<?php

namespace App\Http\Controllers;

use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\KpiAccessGrant;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiResult;
use App\Models\KpiStatusLog;
use App\Models\KpiStructuralUnit;
use App\Models\User;
use App\Services\KpiNpuSettingsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class KpiSummaryController extends Controller
{
    private function availableAcademicYears()
    {
        return AcademicYear::query()
            ->whereIn('id', KpiPeriod::query()->select('academic_year_id')->distinct())
            ->orderByDesc('start_year')
            ->get(['id', 'name', 'start_year', 'end_year']);
    }

    private function resolveSummaryAcademicYear(int $academicYearId = 0): array
    {
        $academicYears = $this->availableAcademicYears();

        $academicYear = $academicYearId > 0
            ? $academicYears->firstWhere('id', $academicYearId)
            : $academicYears->first();

        if (! $academicYear) {
            $academicYear = $academicYears->first();
        }

        return [$academicYears, $academicYear];
    }

    private function deanNpuThreshold(): int
    {
        return (int) ($this->npuSettings()['dean']['points'] ?? 0);
    }

    /** @return array<string, mixed> */
    private function npuSettings(): array
    {
        static $settings;

        if ($settings === null) {
            $settings = app(KpiNpuSettingsService::class)->get();
        }

        return $settings;
    }

    /** НПУ threshold for HOD based on department code. */
    private function hodNpuThreshold(?string $deptCode): int
    {
        $hodSettings = $this->npuSettings()['hod'] ?? [];
        $specialDepartmentCodes = $hodSettings['special_department_codes'] ?? [];

        if ($deptCode && in_array($deptCode, $specialDepartmentCodes, true)) {
            return (int) ($hodSettings['special_points'] ?? 0);
        }

        return (int) ($hodSettings['default_points'] ?? 0);
    }

    /**
     * НПУ threshold for a teacher based on their position title (ad_title).
     * Order of checks matters — check more specific titles first.
     */
    private function teacherNpuThreshold(?string $title): int
    {
        $teacherSettings = $this->npuSettings()['teacher'] ?? [];

        if (! $title) {
            return (int) ($teacherSettings['default_points'] ?? 0);
        }

        $t = mb_strtolower($title);

        foreach (($teacherSettings['rules'] ?? []) as $rule) {
            foreach (($rule['keywords'] ?? []) as $keyword) {
                if ($keyword !== '' && str_contains($t, mb_strtolower((string) $keyword))) {
                    return (int) ($rule['points'] ?? 0);
                }
            }
        }

        return (int) ($teacherSettings['default_points'] ?? 0);
    }

    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $roleSlug = $user->resolvedRoleSlug();
        $effectiveRoleSlug = (KpiAccessGrant::userHasKpiAdmin($user->id) || $roleSlug === 'structural')
            ? 'admin'
            : $roleSlug;

        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');

        // Resolve academic year from years that actually have KPI seasons.
        [$academicYears, $academicYear] = $this->resolveSummaryAcademicYear($academicYearId);

        // Resolve period — latest active or closed in that year
        $period = null;
        if ($periodId > 0) {
            $period = KpiPeriod::query()->find($periodId);
        } elseif ($academicYear) {
            $period = KpiPeriod::query()
                ->where('academic_year_id', $academicYear->id)
                ->whereIn('status', [KpiPeriod::STATUS_ACTIVE, KpiPeriod::STATUS_CLOSED])
                ->orderByDesc('start_date')
                ->first();
        }

        // Filter options
        $periods = $academicYear
            ? KpiPeriod::query()
                ->where('academic_year_id', $academicYear->id)
                ->orderByDesc('start_date')
                ->get(['id', 'name', 'stage', 'status'])
            : collect();

        // Build role-specific summary
        $summary = $this->buildSummary($user, $roleSlug, $period);

        return Inertia::render('Kpi/Summary', [
            'roleSlug' => $effectiveRoleSlug,
            'summary' => $summary,
            'academicYear' => $academicYear ? $academicYear->only(['id', 'name', 'start_year', 'end_year']) : null,
            'period' => $period ? $period->only(['id', 'name', 'stage', 'status']) : null,
            'filters' => [
                'academic_year_id' => $academicYear?->id,
                'period_id' => $period?->id,
            ],
            'filterOptions' => [
                'academicYears' => $academicYears,
                'periods' => $periods,
            ],
        ]);
    }

    // -----------------------------------------------------------------------
    // Scope dispatching
    // -----------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function buildSummary(User $user, string $roleSlug, ?KpiPeriod $period): array
    {
        if (in_array($roleSlug, ['admin', 'superadmin'], true) || KpiAccessGrant::userHasKpiAdmin($user->id)) {
            return $this->adminSummary($period);
        }

        if ($roleSlug === 'structural') {
            return $this->adminSummary($period);
        }

        if ($roleSlug === 'dean') {
            return $this->deanSummary($user, $period);
        }

        if (in_array($roleSlug, ['hod', 'department_head'], true)) {
            return $this->hodSummary($user, $period);
        }

        if ($roleSlug === 'department') {
            return $this->structuralSummary($user, $period);
        }

        return $this->teacherSummary($user, $period);
    }

    // -----------------------------------------------------------------------
    // Teacher
    // -----------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function teacherSummary(User $user, ?KpiPeriod $period): array
    {
        $entries = KpiEntry::query()
            ->with('indicator:id,section,code,name,unit,base_points')
            ->where('user_id', $user->id)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'status', 'comment']);

        // Finalized result if exists
        $result = $period
            ? KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->where('user_id', $user->id)
                ->first(['rank_score', 'k1_score', 'k2_score', 'k3_score', 'k4_score', 'k5_score', 'k6_score', 'section_scores'])
            : null;

        return [
            'scope' => 'teacher',
            'user' => [
                'id' => $user->id,
                'name' => $user->display_name ?? $user->name,
                'title' => $user->ad_title,
                'division' => $user->ad_division,
            ],
            'result' => $result ? (function () use ($result) {
                $r = $this->formatResult($result);
                $r['rank_score'] = $this->teacherRankScore($r['k1'], $r['k2'], $r['k3'], $r['k4'], $r['k5'], $r['k6']);
                return $r;
            })() : null,
            'entries' => $this->groupEntriesBySection($entries),
            'totals' => $this->calcTotals($entries),
        ];
    }

    // -----------------------------------------------------------------------
    // HOD
    // -----------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function hodSummary(User $user, ?KpiPeriod $period): array
    {
        $department = $user->department_id
            ? Department::query()->find($user->department_id, ['id', 'name', 'code'])
            : null;

        $hodNpu = $this->hodNpuThreshold($department?->code);

        // Own entries (HOD form)
        $ownEntries = KpiEntry::query()
            ->with('indicator:id,section,code,name,unit,base_points')
            ->where('user_id', $user->id)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereIn('entity_type', [KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD, KpiEntry::ENTITY_TYPE_TEACHER])
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'status', 'entity_type']);

        $ownResult = $period
            ? KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->where('user_id', $user->id)
                ->first(['rank_score', 'k1_score', 'k2_score', 'k3_score', 'k4_score', 'k5_score', 'k6_score'])
            : null;

        $ownResultFormatted = null;
        if ($ownResult) {
            $ownResultFormatted = $this->formatResult($ownResult);
            $ownResultFormatted['npu_threshold'] = $hodNpu;
            $k1234 = $ownResultFormatted['k1'] + $ownResultFormatted['k2'] + $ownResultFormatted['k3'] + $ownResultFormatted['k4'];
            $ownResultFormatted['rank_score'] = $k1234 - $hodNpu;
        }

        // Teachers in department
        $teachers = $this->departmentTeachersRanking($department?->id, $period, excludeUserId: $user->id);

        // Department result
        $deptResult = ($period && $department)
            ? KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_DEPARTMENT)
                ->where('department_id', $department->id)
                ->first(['rank_score', 'k1_score', 'k2_score', 'k3_score', 'k4_score', 'k5_score', 'k6_score', 'approved_entries_count'])
            : null;

        return [
            'scope' => 'hod',
            'user' => [
                'id' => $user->id,
                'name' => $user->display_name ?? $user->name,
                'title' => $user->ad_title,
            ],
            'department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'own_result' => $ownResultFormatted,
            'own_entries' => $this->groupEntriesBySection($ownEntries),
            'own_totals' => $this->calcTotals($ownEntries),
            'dept_result' => $deptResult ? $this->formatResult($deptResult) : null,
            'teachers' => $teachers,
        ];
    }

    // -----------------------------------------------------------------------
    // Dean
    // -----------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function deanSummary(User $user, ?KpiPeriod $period): array
    {
        $faculty = $user->faculty_id
            ? Faculty::query()->find($user->faculty_id, ['id', 'name'])
            : null;

        // Own entries
        $ownEntries = KpiEntry::query()
            ->with('indicator:id,section,code,name,unit,base_points')
            ->where('user_id', $user->id)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereIn('entity_type', [KpiEntry::ENTITY_TYPE_DEAN, KpiEntry::ENTITY_TYPE_TEACHER])
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'status', 'entity_type']);

        $ownResult = $period
            ? KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->where('user_id', $user->id)
                ->first(['rank_score', 'k1_score', 'k2_score', 'k3_score', 'k4_score', 'k5_score', 'k6_score'])
            : null;

        // Faculty result
        $facultyResult = ($period && $faculty)
            ? KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_FACULTY)
                ->where('faculty_id', $faculty->id)
                ->first(['rank_score', 'approved_entries_count'])
            : null;

        // Departments in faculty — from KpiEntry grouping
        $departments = $this->facultyDeptRanking($faculty?->id, $period);

        // Teachers in faculty from KpiResult or KpiEntry
        $teachers = $this->facultyTeachersRanking($faculty?->id, $period);

        $deanResultFormatted = null;
        if ($ownResult) {
            $deanResultFormatted = $this->formatResult($ownResult);
            $deanResultFormatted['npu_threshold'] = $this->deanNpuThreshold();
            $k1234 = $deanResultFormatted['k1'] + $deanResultFormatted['k2'] + $deanResultFormatted['k3'] + $deanResultFormatted['k4'];
            $deanResultFormatted['rank_score'] = $k1234 - $this->deanNpuThreshold();
        }

        return [
            'scope' => 'dean',
            'user' => [
                'id' => $user->id,
                'name' => $user->display_name ?? $user->name,
                'title' => $user->ad_title,
            ],
            'faculty' => $faculty ? ['id' => $faculty->id, 'name' => $faculty->name] : null,
            'own_result' => $deanResultFormatted,
            'own_entries' => $this->groupEntriesBySection($ownEntries),
            'own_totals' => $this->calcTotals($ownEntries),
            'faculty_result' => $facultyResult ? $this->formatResult($facultyResult) : null,
            'departments' => $departments,
            'teachers' => $teachers,
        ];
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function adminSummary(?KpiPeriod $period): array
    {
        // Status counters (exclude drafts from display totals)
        $statusCounts = KpiEntry::query()
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        // Faculty summaries with result scores
        $faculties = Faculty::query()->get(['id', 'name']);
        $facultySummaries = [];
        foreach ($faculties as $faculty) {
            $entryStats = KpiEntry::query()
                ->where('faculty_id', $faculty->id)
                ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
                ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
                ->selectRaw('COUNT(DISTINCT user_id) as user_count, COUNT(*) as total_entries, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved', [KpiEntry::STATUS_APPROVED])
                ->first();

            $facultyResult = $period
                ? KpiResult::query()
                    ->where('kpi_period_id', $period->id)
                    ->where('result_type', KpiResult::RESULT_TYPE_FACULTY)
                    ->where('faculty_id', $faculty->id)
                    ->value('rank_score')
                : null;

            $facultySummaries[] = [
                'id' => $faculty->id,
                'name' => $faculty->name,
                'user_count' => (int) ($entryStats->user_count ?? 0),
                'total_entries' => (int) ($entryStats->total_entries ?? 0),
                'approved' => (int) ($entryStats->approved ?? 0),
                'rank_score' => $facultyResult !== null ? (float) $facultyResult : null,
            ];
        }

        // Top teachers ranking (from kpi_results)
        $topTeachers = $this->allTeachersRanking($period, limit: 50);

        // HOD and Dean rankings
        $topHods = $this->allHodsRanking($period);
        $topDeans = $this->allDeansRanking($period);

        // Department summaries
        $deptSummaries = $this->allDeptRanking($period);

        // Section stats — entries/points per KPI section
        $sectionStats = KpiEntry::query()
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->join('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->selectRaw(
                'kpi_indicators.section, COUNT(*) as total, SUM(CASE WHEN kpi_entries.status = ? THEN 1 ELSE 0 END) as approved, ROUND(SUM(COALESCE(kpi_entries.manual_points, kpi_entries.calculated_points, 0)), 2) as total_points',
                [KpiEntry::STATUS_APPROVED]
            )
            ->groupBy('kpi_indicators.section')
            ->get()
            ->mapWithKeys(fn ($r) => [$r->section => [
                'total' => (int) $r->total,
                'approved' => (int) $r->approved,
                'total_points' => (float) $r->total_points,
            ]])
            ->toArray();

        return [
            'scope' => 'admin',
            'status_counts' => $statusCounts,
            'section_stats' => $sectionStats,
            'faculties' => $facultySummaries,
            'top_teachers' => $topTeachers,
            'top_hods' => $topHods,
            'top_deans' => $topDeans,
            'departments' => $deptSummaries,
        ];
    }

    // -----------------------------------------------------------------------
    // Structural
    // -----------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function structuralSummary(User $user, ?KpiPeriod $period): array
    {
        $divisionIds = $user->kpiStructuralUnits()->pluck('kpi_structural_units.id')->toArray();

        // If user has no divisions, return empty summary
        if (empty($divisionIds)) {
            return [
                'scope' => 'structural',
                'divisions' => [],
                'faculties' => [],
                'pending_teachers' => [],
            ];
        }

        // Get indicators assigned to this user's divisions
        $indicatorIds = KpiIndicator::query()
            ->where(function (Builder $query) use ($divisionIds): void {
                $query->whereIn('checker_structural_unit_id', $divisionIds)
                    ->orWhereHas('structuralUnits', function (Builder $units) use ($divisionIds): void {
                        $units->whereIn('kpi_structural_units.id', $divisionIds);
                    });
            })
            ->pluck('id')
            ->toArray();

        // Get faculties with their stats for entries using indicators assigned to this user's divisions
        $faculties = Faculty::query()->get(['id', 'name']);
        $summaries = [];

        foreach ($faculties as $faculty) {
            $stats = KpiEntry::query()
                ->where('faculty_id', $faculty->id)
                ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
                ->when(!empty($indicatorIds), fn ($q) => $q->whereIn('indicator_id', $indicatorIds))
                ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
                ->selectRaw('COUNT(DISTINCT user_id) as user_count, COUNT(*) as total_entries, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending', [KpiEntry::STATUS_APPROVED, KpiEntry::STATUS_PENDING_STRUCTURAL])
                ->first();

            $summaries[] = [
                'id' => $faculty->id,
                'name' => $faculty->name,
                'user_count' => (int) ($stats->user_count ?? 0),
                'total_entries' => (int) ($stats->total_entries ?? 0),
                'approved' => (int) ($stats->approved ?? 0),
                'pending' => (int) ($stats->pending ?? 0),
            ];
        }

        // Teachers pending structural approval (for this user's divisions)
        $pendingTeachers = KpiEntry::query()
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->when(!empty($indicatorIds), fn ($q) => $q->whereIn('indicator_id', $indicatorIds))
            ->where('status', KpiEntry::STATUS_PENDING_STRUCTURAL)
            ->join('users', 'users.id', '=', 'kpi_entries.user_id')
            ->join('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->select([
                'kpi_entries.user_id',
                'users.display_name',
                'users.name',
                'users.ad_title',
                'kpi_indicators.name as indicator_name',
                'kpi_entries.fact_value',
                'kpi_entries.calculated_points',
                'kpi_entries.manual_points',
                'kpi_entries.created_at',
            ])
            ->orderByDesc('kpi_entries.created_at')
            ->limit(100)
            ->get()
            ->map(fn ($e) => [
                'id' => $e->user_id,
                'name' => $e->display_name ?? $e->name ?? '—',
                'title' => $e->ad_title,
                'indicator' => $e->indicator_name ?? '—',
                'fact_value' => $e->fact_value,
                'points' => $e->manual_points ?? $e->calculated_points ?? 0,
            ])
            ->values()
            ->all();

        return [
            'scope' => 'structural',
            'divisions' => $user->kpiStructuralUnits->map(fn (KpiStructuralUnit $d) => ['id' => $d->id, 'name' => $d->name, 'code' => $d->code])->values()->all(),
            'faculties' => $summaries,
            'pending_teachers' => $pendingTeachers,
        ];
    }

    // -----------------------------------------------------------------------
    // Ranking helpers
    // -----------------------------------------------------------------------

    /**
     * Get ranked teacher list for a specific department.
     * Tries kpi_results first, falls back to kpi_entries aggregation.
     *
     * @return array<int, array<string, mixed>>
     */
    private function departmentTeachersRanking(?int $deptId, ?KpiPeriod $period, ?int $excludeUserId = null): array
    {
        if (! $deptId) {
            return [];
        }

        // Try kpi_results (finalized)
        if ($period) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->where('kpi_results.department_id', $deptId)
                ->when($excludeUserId, fn ($q) => $q->where('user_id', '!=', $excludeUserId))
                ->join('users', 'users.id', '=', 'kpi_results.user_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.user_id',
                    'users.display_name',
                    'users.name',
                    'users.ad_title',
                    'faculties.name as faculty_name',
                    'kpi_results.rank_score',
                    'kpi_results.k1_score',
                    'kpi_results.k2_score',
                    'kpi_results.k3_score',
                    'kpi_results.k4_score',
                    'kpi_results.k5_score',
                    'kpi_results.k6_score',
                    'kpi_results.approved_entries_count',
                ])
                ->orderByDesc('kpi_results.rank_score')
                ->get();

            if ($results->isNotEmpty()) {
                return $results->map(fn ($r) => [
                    'id' => $r->user_id,
                    'name' => $r->display_name ?? $r->name ?? '—',
                    'title' => $r->ad_title,
                    'faculty_name' => $r->faculty_name,
                    'npu_threshold' => $this->teacherNpuThreshold($r->ad_title),
                    'rank_score' => $this->teacherRankScore((float) $r->k1_score, (float) $r->k2_score, (float) $r->k3_score, (float) $r->k4_score, (float) $r->k5_score, (float) $r->k6_score),
                    'k1' => (float) $r->k1_score,
                    'k2' => (float) $r->k2_score,
                    'k3' => (float) $r->k3_score,
                    'k4' => (float) $r->k4_score,
                    'k5' => (float) $r->k5_score,
                    'k6' => (float) $r->k6_score,
                    'approved_entries' => (int) $r->approved_entries_count,
                    'source' => 'result',
                ])->values()->all();
            }
        }

        // Fallback: live kpi_entries aggregation
        return $this->liveTeachersAggregation(
            deptId: $deptId,
            facultyId: null,
            period: $period,
            excludeUserId: $excludeUserId
        );
    }

    /**
     * Get ranked teacher list for a faculty.
     *
     * @return array<int, array<string, mixed>>
     */
    private function facultyTeachersRanking(?int $facultyId, ?KpiPeriod $period): array
    {
        if (! $facultyId) {
            return [];
        }

        if ($period) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->where('kpi_results.faculty_id', $facultyId)
                ->join('users', 'users.id', '=', 'kpi_results.user_id')
                ->leftJoin('departments', 'departments.id', '=', 'kpi_results.department_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.user_id',
                    'kpi_results.department_id',
                    'users.display_name',
                    'users.name',
                    'users.ad_title',
                    'departments.name as department_name',
                    'faculties.name as faculty_name',
                    'kpi_results.rank_score',
                    'kpi_results.k1_score',
                    'kpi_results.k2_score',
                    'kpi_results.k3_score',
                    'kpi_results.k4_score',
                    'kpi_results.k5_score',
                    'kpi_results.k6_score',
                    'kpi_results.approved_entries_count',
                ])
                ->orderByDesc('kpi_results.rank_score')
                ->get();

            if ($results->isNotEmpty()) {
                return $results->map(fn ($r) => [
                    'id' => $r->user_id,
                    'name' => $r->display_name ?? $r->name ?? '—',
                    'title' => $r->ad_title,
                    'department_name' => $r->department_name,
                    'faculty_name' => $r->faculty_name,
                    'npu_threshold' => $this->teacherNpuThreshold($r->ad_title),
                    'rank_score' => $this->teacherRankScore((float) $r->k1_score, (float) $r->k2_score, (float) $r->k3_score, (float) $r->k4_score, (float) $r->k5_score, (float) $r->k6_score),
                    'k1' => (float) $r->k1_score,
                    'k2' => (float) $r->k2_score,
                    'k3' => (float) $r->k3_score,
                    'k4' => (float) $r->k4_score,
                    'k5' => (float) $r->k5_score,
                    'k6' => (float) $r->k6_score,
                    'approved_entries' => (int) $r->approved_entries_count,
                    'source' => 'result',
                ])->values()->all();
            }
        }

        return $this->liveTeachersAggregation(
            deptId: null,
            facultyId: $facultyId,
            period: $period,
        );
    }

    /**
     * All HODs (department heads) across all faculties (admin view).
     *
     * @return array<int, array<string, mixed>>
     */
    private function allHodsRanking(?KpiPeriod $period): array
    {
        $hodUserIds = KpiEntry::query()
            ->where('entity_type', KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->distinct()
            ->pluck('user_id')
            ->filter()
            ->values();

        if ($hodUserIds->isEmpty()) {
            return [];
        }

        if ($period) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->whereIn('kpi_results.user_id', $hodUserIds)
                ->join('users', 'users.id', '=', 'kpi_results.user_id')
                ->leftJoin('departments', 'departments.id', '=', 'kpi_results.department_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.user_id',
                    'kpi_results.department_id',
                    'users.display_name',
                    'users.name',
                    'users.ad_title',
                    'departments.name as department_name',
                    'departments.code as department_code',
                    'faculties.name as faculty_name',
                    'kpi_results.rank_score',
                    'kpi_results.k1_score',
                    'kpi_results.k2_score',
                    'kpi_results.k3_score',
                    'kpi_results.k4_score',
                    'kpi_results.k5_score',
                    'kpi_results.k6_score',
                    'kpi_results.approved_entries_count',
                ])
                ->orderByDesc('kpi_results.rank_score')
                ->get();

            if ($results->isNotEmpty()) {
                return $results->map(function ($r) {
                    $npu = $this->hodNpuThreshold($r->department_code);
                    $k1234 = (float) $r->k1_score + (float) $r->k2_score + (float) $r->k3_score + (float) $r->k4_score;

                    return [
                        'id' => $r->user_id,
                        'name' => $r->display_name ?? $r->name ?? '—',
                        'title' => $r->ad_title,
                        'department_name' => $r->department_name,
                        'faculty_name' => $r->faculty_name,
                        'npu_threshold' => $npu,
                        'rank_score' => $k1234 - $npu,
                        'k1' => (float) $r->k1_score,
                        'k2' => (float) $r->k2_score,
                        'k3' => (float) $r->k3_score,
                        'k4' => (float) $r->k4_score,
                        'k5' => (float) $r->k5_score,
                        'k6' => (float) $r->k6_score,
                        'approved_entries' => (int) $r->approved_entries_count,
                        'source' => 'result',
                    ];
                })->values()->all();
            }
        }

        // Fallback: live aggregation
        return $this->liveEntityAggregation(KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD, $period, $hodUserIds->all());
    }

    /**
     * All Deans across all faculties (admin view).
     *
     * @return array<int, array<string, mixed>>
     */
    private function allDeansRanking(?KpiPeriod $period): array
    {
        $deanUserIds = KpiEntry::query()
            ->where('entity_type', KpiEntry::ENTITY_TYPE_DEAN)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->distinct()
            ->pluck('user_id')
            ->filter()
            ->values();

        if ($deanUserIds->isEmpty()) {
            return [];
        }

        if ($period) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->whereIn('kpi_results.user_id', $deanUserIds)
                ->join('users', 'users.id', '=', 'kpi_results.user_id')
                ->leftJoin('departments', 'departments.id', '=', 'kpi_results.department_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.user_id',
                    'kpi_results.department_id',
                    'users.display_name',
                    'users.name',
                    'users.ad_title',
                    'departments.name as department_name',
                    'faculties.name as faculty_name',
                    'kpi_results.rank_score',
                    'kpi_results.k1_score',
                    'kpi_results.k2_score',
                    'kpi_results.k3_score',
                    'kpi_results.k4_score',
                    'kpi_results.k5_score',
                    'kpi_results.k6_score',
                    'kpi_results.approved_entries_count',
                ])
                ->orderByDesc('kpi_results.rank_score')
                ->get();

            if ($results->isNotEmpty()) {
                return $results->map(function ($r) {
                    $k1234 = (float) $r->k1_score + (float) $r->k2_score + (float) $r->k3_score + (float) $r->k4_score;

                    return [
                        'id' => $r->user_id,
                        'name' => $r->display_name ?? $r->name ?? '—',
                        'title' => $r->ad_title,
                        'department_name' => $r->department_name,
                        'faculty_name' => $r->faculty_name,
                        'npu_threshold' => $this->deanNpuThreshold(),
                        'rank_score' => $k1234 - $this->deanNpuThreshold(),
                        'k1' => (float) $r->k1_score,
                        'k2' => (float) $r->k2_score,
                        'k3' => (float) $r->k3_score,
                        'k4' => (float) $r->k4_score,
                        'k5' => (float) $r->k5_score,
                        'k6' => (float) $r->k6_score,
                        'approved_entries' => (int) $r->approved_entries_count,
                        'source' => 'result',
                    ];
                })->values()->all();
            }
        }

        // Fallback: live aggregation
        return $this->liveEntityAggregation(KpiEntry::ENTITY_TYPE_DEAN, $period, $deanUserIds->all());
    }

    /**
     * Live aggregation for a specific entity_type (hod/dean fallback).
     *
     * @param  array<int>  $userIds
     * @return array<int, array<string, mixed>>
     */
    private function liveEntityAggregation(string $entityType, ?KpiPeriod $period, array $userIds): array
    {
        $rows = KpiEntry::query()
            ->where('entity_type', $entityType)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereIn('user_id', $userIds)
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->selectRaw('user_id, MAX(department_id) as department_id, MAX(faculty_id) as faculty_id, COUNT(*) as total_entries, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved, COALESCE(SUM(manual_points), 0) + COALESCE(SUM(calculated_points), 0) as total_points', [KpiEntry::STATUS_APPROVED])
            ->groupBy('user_id')
            ->orderByDesc('approved')
            ->get();

        if ($rows->isEmpty()) {
            return [];
        }

        $fetchedUserIds = $rows->pluck('user_id')->filter()->values();
        $users = User::query()
            ->whereIn('id', $fetchedUserIds)
            ->get(['id', 'display_name', 'name', 'ad_title'])
            ->keyBy('id');

        $deptIds = $rows->pluck('department_id')->filter()->unique()->values();
        $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');
        $deptCodes = $deptIds->isNotEmpty()
            ? Department::query()->whereIn('id', $deptIds)->pluck('code', 'id')
            : collect();

        $facultyIds = $rows->pluck('faculty_id')->filter()->unique()->values();
        $facultyNames = Faculty::query()->whereIn('id', $facultyIds)->pluck('name', 'id');

        $isHod  = $entityType === KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD;
        $isDean = $entityType === KpiEntry::ENTITY_TYPE_DEAN;

        return $rows->map(function ($r) use ($users, $deptNames, $deptCodes, $facultyNames, $isHod, $isDean) {
            if ($isHod) {
                $deptCode = $r->department_id ? ($deptCodes[$r->department_id] ?? null) : null;
                $npu = $this->hodNpuThreshold($deptCode);
            } elseif ($isDean) {
                $npu = $this->deanNpuThreshold();
            } else {
                $npu = 0;
            }

            return [
                'id' => $r->user_id,
                'name' => ($users[$r->user_id]?->display_name ?? $users[$r->user_id]?->name) ?? '—',
                'title' => $users[$r->user_id]?->ad_title,
                'department_name' => $r->department_id ? ($deptNames[$r->department_id] ?? null) : null,
                'faculty_name' => $r->faculty_id ? ($facultyNames[$r->faculty_id] ?? null) : null,
                'npu_threshold' => $npu,
                'rank_score' => (float) $r->total_points - $npu,
                'k1' => 0.0,
                'k2' => 0.0,
                'k3' => 0.0,
                'k4' => 0.0,
                'k5' => 0.0,
                'k6' => 0.0,
                'approved_entries' => (int) $r->approved,
                'source' => 'live',
            ];
        })->values()->all();
    }

    /**
     * All teachers across all faculties (admin view).
     *
     * @return array<int, array<string, mixed>>
     */
    private function allTeachersRanking(?KpiPeriod $period, int $limit = 50, ?string $statusFilter = null): array
    {
        if ($period && ! $statusFilter) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->join('users', 'users.id', '=', 'kpi_results.user_id')
                ->leftJoin('departments', 'departments.id', '=', 'kpi_results.department_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.user_id',
                    'kpi_results.department_id',
                    'kpi_results.faculty_id',
                    'users.display_name',
                    'users.name',
                    'users.ad_title',
                    'departments.name as department_name',
                    'faculties.name as faculty_name',
                    'kpi_results.rank_score',
                    'kpi_results.k1_score',
                    'kpi_results.k2_score',
                    'kpi_results.k3_score',
                    'kpi_results.k4_score',
                    'kpi_results.k5_score',
                    'kpi_results.k6_score',
                    'kpi_results.approved_entries_count',
                ])
                ->orderByDesc('kpi_results.rank_score')
                ->limit($limit)
                ->get();

            if ($results->isNotEmpty()) {
                return $results->map(fn ($r) => [
                    'id' => $r->user_id,
                    'name' => $r->display_name ?? $r->name ?? '—',
                    'title' => $r->ad_title,
                    'department_name' => $r->department_name,
                    'faculty_name' => $r->faculty_name,
                    'npu_threshold' => $this->teacherNpuThreshold($r->ad_title),
                    'rank_score' => $this->teacherRankScore((float) $r->k1_score, (float) $r->k2_score, (float) $r->k3_score, (float) $r->k4_score, (float) $r->k5_score, (float) $r->k6_score),
                    'k1' => (float) $r->k1_score,
                    'k2' => (float) $r->k2_score,
                    'k3' => (float) $r->k3_score,
                    'k4' => (float) $r->k4_score,
                    'k5' => (float) $r->k5_score,
                    'k6' => (float) $r->k6_score,
                    'approved_entries' => (int) $r->approved_entries_count,
                    'source' => 'result',
                ])->values()->all();
            }
        }

        return $this->liveTeachersAggregation(
            deptId: null,
            facultyId: null,
            period: $period,
            statusFilter: $statusFilter,
            limit: $limit
        );
    }

    /**
     * Department summaries for a faculty (dean view).
     *
     * @return array<int, array<string, mixed>>
     */
    private function facultyDeptRanking(?int $facultyId, ?KpiPeriod $period): array
    {
        if (! $facultyId) {
            return [];
        }

        // Aggregate from entries
        $rows = KpiEntry::query()
            ->where('faculty_id', $facultyId)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereNotNull('department_id')
            ->whereIn('entity_type', [KpiEntry::ENTITY_TYPE_TEACHER, KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD])
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->selectRaw('department_id, COUNT(DISTINCT user_id) as teacher_count, COUNT(*) as total_entries, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved', [KpiEntry::STATUS_APPROVED])
            ->groupBy('department_id')
            ->get();

        $deptIds = $rows->pluck('department_id')->filter()->values();
        $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');

        // Merge with kpi_results dept score if available
        $deptScores = [];
        if ($period && $deptIds->isNotEmpty()) {
            $deptScores = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_DEPARTMENT)
                ->whereIn('department_id', $deptIds)
                ->pluck('rank_score', 'department_id')
                ->toArray();
        }

        return $rows->map(fn ($row) => [
            'id' => $row->department_id,
            'name' => $deptNames[$row->department_id] ?? 'Кафедра #' . $row->department_id,
            'teacher_count' => (int) $row->teacher_count,
            'total_entries' => (int) $row->total_entries,
            'approved' => (int) $row->approved,
            'rank_score' => isset($deptScores[$row->department_id]) ? (float) $deptScores[$row->department_id] : null,
        ])->sortByDesc('approved')->values()->all();
    }

    /**
     * All department summaries (admin view).
     *
     * @return array<int, array<string, mixed>>
     */
    private function allDeptRanking(?KpiPeriod $period): array
    {
        if ($period) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_DEPARTMENT)
                ->join('departments', 'departments.id', '=', 'kpi_results.department_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.department_id',
                    'departments.name as department_name',
                    'faculties.name as faculty_name',
                    'kpi_results.rank_score',
                    'kpi_results.approved_entries_count',
                ])
                ->orderByDesc('kpi_results.rank_score')
                ->get();

            if ($results->isNotEmpty()) {
                return $results->map(fn ($r) => [
                    'id' => $r->department_id,
                    'name' => $r->department_name,
                    'faculty_name' => $r->faculty_name,
                    'rank_score' => (float) $r->rank_score,
                    'approved_entries' => (int) $r->approved_entries_count,
                    'source' => 'result',
                ])->values()->all();
            }
        }

        // Fallback
        $rows = KpiEntry::query()
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereNotNull('department_id')
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->selectRaw('department_id, COUNT(DISTINCT user_id) as user_count, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved', [KpiEntry::STATUS_APPROVED])
            ->groupBy('department_id')
            ->get();

        $deptIds = $rows->pluck('department_id')->filter()->values();
        $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');

        return $rows->map(fn ($r) => [
            'id' => $r->department_id,
            'name' => $deptNames[$r->department_id] ?? 'Кафедра #' . $r->department_id,
            'faculty_name' => null,
            'rank_score' => null,
            'approved_entries' => (int) $r->approved,
        ])->sortByDesc('approved_entries')->values()->all();
    }

    /**
     * Live aggregation fallback when kpi_results is empty.
     *
     * @return array<int, array<string, mixed>>
     */
    private function liveTeachersAggregation(
        ?int $deptId,
        ?int $facultyId,
        ?KpiPeriod $period,
        ?int $excludeUserId = null,
        ?string $statusFilter = null,
        int $limit = 100
    ): array {
        $rows = KpiEntry::query()
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->when($deptId, fn ($q) => $q->where('department_id', $deptId))
            ->when($facultyId, fn ($q) => $q->where('faculty_id', $facultyId))
            ->when($excludeUserId, fn ($q) => $q->where('user_id', '!=', $excludeUserId))
            ->when($statusFilter, fn ($q) => $q->where('status', $statusFilter))
            ->when(! $statusFilter, fn ($q) => $q->whereNotIn('status', [KpiEntry::STATUS_DRAFT]))
            ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
            ->selectRaw('user_id, MAX(department_id) as department_id, MAX(faculty_id) as faculty_id, COUNT(*) as total_entries, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved, COALESCE(SUM(manual_points), 0) + COALESCE(SUM(calculated_points), 0) as total_points', [KpiEntry::STATUS_APPROVED])
            ->groupBy('user_id')
            ->orderByDesc('approved')
            ->limit($limit)
            ->get();

        if ($rows->isEmpty()) {
            return [];
        }

        $userIds = $rows->pluck('user_id')->filter()->values();
        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'display_name', 'name', 'ad_title'])
            ->keyBy('id');

        $deptIds = $rows->pluck('department_id')->filter()->unique()->values();
        $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');

        $facultyIds = $rows->pluck('faculty_id')->filter()->unique()->values();
        $facultyNames = Faculty::query()->whereIn('id', $facultyIds)->pluck('name', 'id');

        return $rows->map(fn ($r) => [
            'id' => $r->user_id,
            'name' => ($users[$r->user_id]?->display_name ?? $users[$r->user_id]?->name) ?? '—',
            'title' => $users[$r->user_id]?->ad_title,
            'department_name' => $r->department_id ? ($deptNames[$r->department_id] ?? null) : null,
            'faculty_name' => $r->faculty_id ? ($facultyNames[$r->faculty_id] ?? null) : null,
            'npu_threshold' => $this->teacherNpuThreshold($users[$r->user_id]?->ad_title),
            'rank_score' => (float) $r->total_points,
            'k1' => 0.0,
            'k2' => 0.0,
            'k3' => 0.0,
            'k4' => 0.0,
            'k5' => 0.0,
            'k6' => 0.0,
            'approved_entries' => (int) $r->approved,
            'source' => 'live',
        ])->values()->all();
    }

    // -----------------------------------------------------------------------
    // Entry helpers
    // -----------------------------------------------------------------------

    /**
     * @param \Illuminate\Database\Eloquent\Collection<int, KpiEntry> $entries
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function groupEntriesBySection($entries): array
    {
        $grouped = [];
        foreach ($entries as $entry) {
            $section = $entry->indicator?->section ?? 'other';
            $grouped[$section][] = [
                'id' => $entry->id,
                'code' => $entry->indicator?->code,
                'name' => $entry->indicator?->name,
                'unit' => $entry->indicator?->unit,
                'plan_value' => $entry->plan_value,
                'fact_value' => $entry->fact_value,
                'points' => (float) ($entry->manual_points ?? $entry->calculated_points ?? 0),
                'status' => $entry->status,
            ];
        }

        return $grouped;
    }

    /**
     * @param \Illuminate\Database\Eloquent\Collection<int, KpiEntry> $entries
     * @return array{total: int, approved: int, submitted: int, pending: int, total_points: float}
     */
    private function calcTotals($entries): array
    {
        $approved = $submitted = $pending = 0;
        $totalPoints = 0.0;

        foreach ($entries as $entry) {
            match ($entry->status) {
                KpiEntry::STATUS_APPROVED => $approved++,
                KpiEntry::STATUS_SUBMITTED => $submitted++,
                KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_PENDING_STRUCTURAL, KpiEntry::STATUS_REVIEWED => $pending++,
                default => null,
            };
            $totalPoints += (float) ($entry->manual_points ?? $entry->calculated_points ?? 0);
        }

        return [
            'total' => $entries->count(),
            'approved' => $approved,
            'submitted' => $submitted,
            'pending' => $pending,
            'total_points' => $totalPoints,
        ];
    }

    /** @return array<string, mixed> */
    /** Rппс = (K1+K2+K3+K4+K5) − K6 */
    private function teacherRankScore(float $k1, float $k2, float $k3, float $k4, float $k5, float $k6): float
    {
        return ($k1 + $k2 + $k3 + $k4 + $k5) - $k6;
    }

    private function formatResult(KpiResult $result): array
    {
        return [
            'rank_score' => (float) ($result->rank_score ?? 0),
            'k1' => (float) ($result->k1_score ?? 0),
            'k2' => (float) ($result->k2_score ?? 0),
            'k3' => (float) ($result->k3_score ?? 0),
            'k4' => (float) ($result->k4_score ?? 0),
            'k5' => (float) ($result->k5_score ?? 0),
            'k6' => (float) ($result->k6_score ?? 0),
            'approved_entries' => (int) ($result->approved_entries_count ?? 0),
        ];
    }

    // -----------------------------------------------------------------------
    // Teacher card (for drilldown from ППС tables)
    // -----------------------------------------------------------------------

    public function showTeacher(Request $request, int $userId): Response
    {
        /** @var User $viewer */
        $viewer = $request->user();

        if ($viewer->resolvedRoleSlug() === 'teacher' && (int) $viewer->id !== (int) $userId) {
            abort(403);
        }

        $teacher = User::query()->findOrFail($userId, ['id', 'name', 'display_name', 'email', 'ad_title', 'ad_division', 'department_id', 'faculty_id']);

        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');

        [$academicYears, $academicYear] = $this->resolveSummaryAcademicYear($academicYearId);

        $period = null;
        if ($periodId > 0) {
            $period = KpiPeriod::query()->find($periodId);
        } elseif ($academicYear) {
            $period = KpiPeriod::query()
                ->where('academic_year_id', $academicYear->id)
                ->whereIn('status', [KpiPeriod::STATUS_ACTIVE, KpiPeriod::STATUS_CLOSED])
                ->orderByDesc('start_date')
                ->first();
        }

        // Personal card can be opened from teacher/dean/hod rankings;
        // load all relevant KPI entry entity types to avoid role-mapping gaps.
        $entryEntityTypes = [
            KpiEntry::ENTITY_TYPE_TEACHER,
            KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD,
            KpiEntry::ENTITY_TYPE_DEAN,
        ];

        // Load entries with indicator + status logs + actor
        $entries = KpiEntry::query()
            ->with([
                'indicator:id,section,code,name,unit,base_points',
                'files:id,kpi_entry_id,file_name,file_path,file_disk,file_size',
                'statusLogs' => function ($q) {
                    $q->orderBy('created_at', 'asc');
                },
                'statusLogs.actor:id,name,display_name',
            ])
            ->where('user_id', $userId)
            ->when($period, fn ($q) => $q->where('kpi_period_id', $period->id))
            ->whereIn('entity_type', array_values(array_unique($entryEntityTypes)))
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->orderBy('created_at')
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'status', 'comment', 'submitted_at', 'reviewed_at', 'approved_at', 'created_at', 'updated_at']);

        // Finalized result
        $result = $period
            ? KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->where('user_id', $userId)
                ->first(['rank_score', 'k1_score', 'k2_score', 'k3_score', 'k4_score', 'k5_score', 'k6_score', 'section_scores', 'approved_entries_count'])
            : null;

        // Group entries by section, include history
        $grouped = [];
        foreach ($entries as $entry) {
            $section = $entry->indicator?->section ?? 'other';
            $grouped[$section][] = [
                'id' => $entry->id,
                'code' => $entry->indicator?->code,
                'name' => $entry->indicator?->name,
                'unit' => $entry->indicator?->unit,
                'plan_value' => $entry->plan_value,
                'fact_value' => $entry->fact_value,
                'points' => (float) ($entry->manual_points ?? $entry->calculated_points ?? 0),
                'status' => $entry->status,
                'comment' => $entry->comment,
                'submitted_at' => $entry->submitted_at?->toIso8601String(),
                'approved_at' => $entry->approved_at?->toIso8601String(),
                'files' => $entry->files->map(fn ($file) => [
                    'id' => $file->id,
                    'file_name' => $file->file_name,
                    'file_size' => $file->file_size,
                    'file_url' => $file->file_url,
                ])->values()->all(),
                'history' => $entry->statusLogs->map(fn ($log) => [
                    'id' => $log->id,
                    'action' => $log->action,
                    'from_status' => $log->from_status,
                    'to_status' => $log->to_status,
                    'comment' => $log->comment,
                    'actor_name' => $log->actor?->display_name ?? $log->actor?->name ?? '—',
                    'created_at' => $log->created_at?->toIso8601String(),
                ])->values()->all(),
            ];
        }

        // Totals
        $approved = $entries->where('status', KpiEntry::STATUS_APPROVED)->count();
        $submitted = $entries->where('status', KpiEntry::STATUS_SUBMITTED)->count();
        $pending = $entries->whereIn('status', [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_PENDING_STRUCTURAL, KpiEntry::STATUS_REVIEWED])->count();
        $totalPoints = $entries->sum(fn ($e) => (float) ($e->manual_points ?? $e->calculated_points ?? 0));

        $filterOptions = [
            'academicYears' => $academicYears,
            'periods' => $academicYear
                ? KpiPeriod::query()->where('academic_year_id', $academicYear->id)->orderByDesc('start_date')->get(['id', 'name', 'stage', 'status'])
                : collect(),
        ];

        return Inertia::render('Kpi/SummaryTeacherCard', [
            'teacher' => [
                'id' => $teacher->id,
                'name' => $teacher->display_name ?? $teacher->name,
                'email' => $teacher->email,
                'title' => $teacher->ad_title,
                'division' => $teacher->ad_division,
                'department_id' => $teacher->department_id,
                'department_name' => $teacher->department_id
                    ? Department::query()->where('id', $teacher->department_id)->value('name')
                    : null,
                'faculty_id' => $teacher->faculty_id,
                'faculty_name' => $teacher->faculty_id
                    ? Faculty::query()->where('id', $teacher->faculty_id)->value('name')
                    : null,
            ],
            'result' => $result ? $this->formatResult($result) : null,
            'entries' => $grouped,
            'totals' => [
                'total' => $entries->count(),
                'approved' => $approved,
                'submitted' => $submitted,
                'pending' => $pending,
                'total_points' => $totalPoints,
            ],
            'academicYear' => $academicYear ? $academicYear->only(['id', 'name']) : null,
            'period' => $period ? $period->only(['id', 'name', 'stage', 'status']) : null,
            'filters' => [
                'academic_year_id' => $academicYear?->id,
                'period_id' => $period?->id,
            ],
            'filterOptions' => $filterOptions,
        ]);
    }

    // -----------------------------------------------------------------------
    // Export
    // -----------------------------------------------------------------------

    public function exportExcel(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $roleSlug = $user->resolvedRoleSlug();
        $effectiveRoleSlug = KpiAccessGrant::userHasKpiAdmin($user->id) ? 'admin' : $roleSlug;

        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');

        // Resolve academic year
        [$academicYears, $academicYear] = $this->resolveSummaryAcademicYear($academicYearId);

        // Resolve period
        $period = null;
        if ($periodId > 0) {
            $period = KpiPeriod::query()->find($periodId);
        } elseif ($academicYear) {
            $period = KpiPeriod::query()
                ->where('academic_year_id', $academicYear->id)
                ->whereIn('status', [KpiPeriod::STATUS_ACTIVE, KpiPeriod::STATUS_CLOSED])
                ->orderByDesc('start_date')
                ->first();
        }

        // Build summary data
        $summary = $this->buildSummary($user, $roleSlug, $period);

        $filename = 'KPI_Сводка_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($summary, $academicYear, $period): void {
            $handle = fopen('php://output', 'wb');

            if (!$handle) {
                return;
            }

            // UTF-8 BOM for Excel
            fwrite($handle, "\xEF\xBB\xBF");

            // Header info
            $period_name = $period?->name ?? '(без периода)';
            $year_name = $academicYear?->name ?? '(без года)';
            fputcsv($handle, ['КПИ Сводка']);
            fputcsv($handle, ['Период', $period_name]);
            fputcsv($handle, ['Учебный год', $year_name]);
            fputcsv($handle, ['Роль', $summary['scope'] ?? '']);
            fputcsv($handle, []);

            // Role-specific export
            if (in_array($summary['scope'] ?? null, ['teacher'], true)) {
                $this->exportTeacherSummary($handle, $summary);
            } elseif (in_array($summary['scope'] ?? null, ['hod', 'department_head'], true)) {
                $this->exportHodSummary($handle, $summary);
            } elseif (in_array($summary['scope'] ?? null, ['dean'], true)) {
                $this->exportDeanSummary($handle, $summary);
            } elseif (in_array($summary['scope'] ?? null, ['admin', 'superadmin'], true)) {
                $this->exportAdminSummary($handle, $summary);
            } elseif (in_array($summary['scope'] ?? null, ['department', 'structural'], true)) {
                $this->exportStructuralSummary($handle, $summary);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=utf-8',
        ]);
    }

    private function exportTeacherSummary($handle, array $summary): void
    {
        // User info
        $user = $summary['user'] ?? [];
        fputcsv($handle, ['ФИО', $user['name'] ?? '']);
        fputcsv($handle, ['Должность', $user['title'] ?? '']);
        fputcsv($handle, ['Подразделение', $user['division'] ?? '']);
        fputcsv($handle, []);

        // Result
        if ($summary['result'] ?? null) {
            fputcsv($handle, ['Итоговый рейтинг (R)', $summary['result']['rank_score'] ?? 0]);
            fputcsv($handle, []);
        }

        // Totals
        $totals = $summary['totals'] ?? [];
        fputcsv($handle, ['Всего записей', $totals['total'] ?? 0]);
        fputcsv($handle, ['Утверждено', $totals['approved'] ?? 0]);
        fputcsv($handle, ['На проверке', ($totals['submitted'] ?? 0) + ($totals['pending'] ?? 0)]);
        fputcsv($handle, ['Всего баллов', $totals['total_points'] ?? 0]);
        fputcsv($handle, []);

        // Entries by section
        $entries = $summary['entries'] ?? [];
        $sectionLabels = [
            'teaching' => 'УМР — Учебно-методическая работа',
            'science' => 'НИР — Научно-исследовательская работа',
            'social' => 'СВР — Социально-воспитательная работа',
            'qualification' => 'УПК — Уровень профессиональной квалификации',
            'survey' => 'К5 — Опросы / студенческие оценки',
        ];

        foreach ($entries as $section => $items) {
            $label = $sectionLabels[$section] ?? $section;
            fputcsv($handle, [$label]);
            fputcsv($handle, ['Код', 'Название', 'План', 'Факт', 'Баллы', 'Статус']);

            foreach ($items as $item) {
                fputcsv($handle, [
                    $item['code'] ?? '',
                    $item['name'] ?? '',
                    $item['plan_value'] ?? '',
                    $item['fact_value'] ?? '',
                    $item['points'] ?? 0,
                    $this->statusLabel($item['status'] ?? ''),
                ]);
            }
            fputcsv($handle, []);
        }
    }

    public function exportPdf(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $roleSlug = $user->resolvedRoleSlug();

        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');

        [$academicYears, $academicYear] = $this->resolveSummaryAcademicYear($academicYearId);

        $period = null;
        if ($periodId > 0) {
            $period = KpiPeriod::query()->find($periodId);
        } elseif ($academicYear) {
            $period = KpiPeriod::query()
                ->where('academic_year_id', $academicYear->id)
                ->whereIn('status', [KpiPeriod::STATUS_ACTIVE, KpiPeriod::STATUS_CLOSED])
                ->orderByDesc('start_date')
                ->first();
        }

        unset($academicYears);

        $summary = $this->buildSummary($user, $roleSlug, $period);

        $sectionLabels = [
            'teaching' => 'УМР — Учебно-методическая работа',
            'science' => 'НИР — Научно-исследовательская работа',
            'social' => 'СВР — Социально-воспитательная работа',
            'qualification' => 'УПК — Уровень профессиональной квалификации',
            'survey' => 'К5 — Опросы / студенческие оценки',
            'other' => 'Прочее',
        ];

        $statusLabels = [
            'draft' => 'Черновик',
            'submitted' => 'Подано',
            'returned' => 'Возвращено',
            'reviewed' => 'Проверено',
            'pending_dean' => 'У декана',
            'pending_structural' => 'На утверждении',
            'approved' => 'Утверждено',
            'rejected' => 'Отклонено',
            'locked' => 'Заблокировано',
        ];

        $filename = 'KPI_Сводка_' . now()->format('Ymd_His') . '.pdf';

        return Pdf::loadView('kpi.summary-export-pdf', [
            'summary' => $summary,
            'academicYear' => $academicYear,
            'period' => $period,
            'sectionLabels' => $sectionLabels,
            'statusLabels' => $statusLabels,
            'generatedAt' => now()->format('d.m.Y H:i'),
        ])
            ->setPaper('a4', 'landscape')
            ->setOption('defaultFont', 'DejaVu Sans')
            ->download($filename);
    }

    public function exportRatingPdf(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $roleSlug = $user->resolvedRoleSlug();
        $isKpiAdmin = KpiAccessGrant::userHasKpiAdmin($user->id);

        if (! in_array($roleSlug, ['admin', 'superadmin'], true) && ! $isKpiAdmin) {
            abort(403);
        }

        $report = (string) $request->query('report', 'teachers');
        if (! in_array($report, ['teachers', 'deans', 'hods'], true)) {
            $report = 'teachers';
        }

        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');

        [$academicYears, $academicYear] = $this->resolveSummaryAcademicYear($academicYearId);

        $period = null;
        if ($periodId > 0) {
            $period = KpiPeriod::query()->find($periodId);
        } elseif ($academicYear) {
            $period = KpiPeriod::query()
                ->where('academic_year_id', $academicYear->id)
                ->whereIn('status', [KpiPeriod::STATUS_ACTIVE, KpiPeriod::STATUS_CLOSED])
                ->orderByDesc('start_date')
                ->first();
        }

        unset($academicYears);

        $summary = $this->adminSummary($period);

        $reportMeta = [
            'teachers' => [
                'title' => 'Результаты профессионального рейтинга ППС',
                'filename' => 'KPI_PPS_',
            ],
            'deans' => [
                'title' => 'Результаты рейтинга деканов',
                'filename' => 'KPI_DEANS_',
            ],
            'hods' => [
                'title' => 'Результаты рейтинга зав. кафедрами',
                'filename' => 'KPI_HODS_',
            ],
        ][$report];

        $rows = match ($report) {
            'deans' => $summary['top_deans'] ?? [],
            'hods' => $summary['top_hods'] ?? [],
            default => $summary['top_teachers'] ?? [],
        };

        $filename = $reportMeta['filename'] . now()->format('Ymd_His') . '.pdf';

        return Pdf::loadView('kpi.rating-report-pdf', [
            'report' => $report,
            'title' => $reportMeta['title'],
            'rows' => $rows,
            'academicYear' => $academicYear,
            'period' => $period,
            'generatedAt' => now()->format('d.m.Y H:i'),
        ])
            ->setPaper('a4', 'landscape')
            ->setOption('defaultFont', 'Times New Roman')
            ->download($filename);
    }

    public function exportRatingExcel(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $roleSlug = $user->resolvedRoleSlug();
        $isKpiAdmin = KpiAccessGrant::userHasKpiAdmin($user->id);

        if (! in_array($roleSlug, ['admin', 'superadmin'], true) && ! $isKpiAdmin) {
            abort(403);
        }

        $report = (string) $request->query('report', 'teachers');
        if (! in_array($report, ['teachers', 'deans', 'hods'], true)) {
            $report = 'teachers';
        }

        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');

        [$academicYears, $academicYear] = $this->resolveSummaryAcademicYear($academicYearId);

        $period = null;
        if ($periodId > 0) {
            $period = KpiPeriod::query()->find($periodId);
        } elseif ($academicYear) {
            $period = KpiPeriod::query()
                ->where('academic_year_id', $academicYear->id)
                ->whereIn('status', [KpiPeriod::STATUS_ACTIVE, KpiPeriod::STATUS_CLOSED])
                ->orderByDesc('start_date')
                ->first();
        }

        unset($academicYears);

        $summary = $this->adminSummary($period);

        $reportMeta = [
            'teachers' => [
                'title' => 'Результаты профессионального рейтинга ППС',
                'filename' => 'KPI_PPS_',
                'headers' => ['№', 'ФИО', 'Факультет', 'Кафедра', 'Должность', 'Ставка', 'УМР', 'НИР', 'СВР', 'УПК', 'К5', 'К6', 'Рейтинг'],
            ],
            'deans' => [
                'title' => 'Результаты рейтинга деканов',
                'filename' => 'KPI_DEANS_',
                'headers' => ['№', 'Факультет', 'ФИО декана', 'НПУ', 'Рейтинг', 'УМР', 'НИР', 'СВР', 'УПК'],
            ],
            'hods' => [
                'title' => 'Результаты рейтинга зав. кафедрами',
                'filename' => 'KPI_HODS_',
                'headers' => ['№', 'Факультет', 'Кафедра', 'ФИО зав.каф.', 'НПУ', 'Рейтинг', 'УМР', 'НИР', 'СВР', 'УПК'],
            ],
        ][$report];

        $rows = match ($report) {
            'deans' => $summary['top_deans'] ?? [],
            'hods' => $summary['top_hods'] ?? [],
            default => $summary['top_teachers'] ?? [],
        };

        $filename = $reportMeta['filename'] . now()->format('Ymd_His') . '.xls';

        return response()->streamDownload(function () use ($report, $reportMeta, $rows, $academicYear, $period): void {
            $handle = fopen('php://output', 'wb');
            if (! $handle) {
                return;
            }

            // Excel on Windows reliably reads UTF-16LE with BOM for Cyrillic text.
            fwrite($handle, "\xFF\xFE");

            $writeRow = static function (array $cells) use ($handle): void {
                $cleaned = array_map(static function ($value): string {
                    $s = (string) ($value ?? '');
                    return str_replace(["\t", "\r", "\n"], ' ', $s);
                }, $cells);

                $line = implode("\t", $cleaned) . "\r\n";
                fwrite($handle, mb_convert_encoding($line, 'UTF-16LE', 'UTF-8'));
            };

            $writeRow([$reportMeta['title']]);
            $writeRow(['Учебный год', data_get($academicYear, 'name', 'не указан')]);
            $writeRow(['Период', data_get($period, 'name', 'не указан')]);
            $writeRow(['Сформировано', now()->format('d.m.Y H:i')]);
            $writeRow([]);
            $writeRow($reportMeta['headers']);

            foreach ($rows as $index => $row) {
                if ($report === 'teachers') {
                    $writeRow([
                        $index + 1,
                        data_get($row, 'name', '—'),
                        data_get($row, 'faculty_name', '—'),
                        data_get($row, 'department_name', '—'),
                        data_get($row, 'title', '—'),
                        data_get($row, 'rate', data_get($row, 'workload_rate', data_get($row, 'stavka', '—'))),
                        number_format((float) data_get($row, 'k1', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k2', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k3', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k4', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k5', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k6', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'rank_score', 0), 2, '.', ''),
                    ]);
                    continue;
                }

                if ($report === 'deans') {
                    $writeRow([
                        $index + 1,
                        data_get($row, 'faculty_name', '—'),
                        data_get($row, 'name', '—'),
                        number_format((float) data_get($row, 'npu_threshold', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'rank_score', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k1', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k2', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k3', 0), 2, '.', ''),
                        number_format((float) data_get($row, 'k4', 0), 2, '.', ''),
                    ]);
                    continue;
                }

                $writeRow([
                    $index + 1,
                    data_get($row, 'faculty_name', '—'),
                    data_get($row, 'department_name', '—'),
                    data_get($row, 'name', '—'),
                    number_format((float) data_get($row, 'npu_threshold', 0), 2, '.', ''),
                    number_format((float) data_get($row, 'rank_score', 0), 2, '.', ''),
                    number_format((float) data_get($row, 'k1', 0), 2, '.', ''),
                    number_format((float) data_get($row, 'k2', 0), 2, '.', ''),
                    number_format((float) data_get($row, 'k3', 0), 2, '.', ''),
                    number_format((float) data_get($row, 'k4', 0), 2, '.', ''),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-16LE',
        ]);
    }

    private function exportHodSummary($handle, array $summary): void
    {
        // User info
        $user = $summary['user'] ?? [];
        fputcsv($handle, ['Зав. кафедрой', $user['name'] ?? '']);
        fputcsv($handle, []);

        // Department
        if ($summary['department'] ?? null) {
            $dept = $summary['department'];
            fputcsv($handle, ['Кафедра', $dept['name'] ?? '']);
            fputcsv($handle, []);
        }

        // Own result
        if ($summary['own_result'] ?? null) {
            fputcsv($handle, ['Мой итоговый рейтинг (R)', $summary['own_result']['rank_score'] ?? 0]);
            fputcsv($handle, []);
        }

        // Own entries summary
        $totals = $summary['own_totals'] ?? [];
        fputcsv($handle, ['Мои показатели:']);
        fputcsv($handle, ['Всего записей', $totals['total'] ?? 0]);
        fputcsv($handle, ['Утверждено', $totals['approved'] ?? 0]);
        fputcsv($handle, ['Всего баллов', $totals['total_points'] ?? 0]);
        fputcsv($handle, []);

        // Teachers ranking
        $teachers = $summary['teachers'] ?? [];
        if (!empty($teachers)) {
            fputcsv($handle, ['Рейтинг ППС']);
            fputcsv($handle, ['Место', 'ФИО', 'Баллы', 'Статус']);

            $rank = 1;
            foreach ($teachers as $teacher) {
                fputcsv($handle, [
                    $rank++,
                    $teacher['name'] ?? '',
                    $teacher['total_points'] ?? 0,
                    $this->statusLabel($teacher['status'] ?? ''),
                ]);
            }
            fputcsv($handle, []);
        }
    }

    private function exportDeanSummary($handle, array $summary): void
    {
        // User info
        $user = $summary['user'] ?? [];
        fputcsv($handle, ['Декан', $user['name'] ?? '']);
        fputcsv($handle, []);

        // Faculty
        if ($summary['faculty'] ?? null) {
            $faculty = $summary['faculty'];
            fputcsv($handle, ['Факультет', $faculty['name'] ?? '']);
            fputcsv($handle, []);
        }

        // Own result
        if ($summary['own_result'] ?? null) {
            fputcsv($handle, ['Мой итоговый рейтинг (R)', $summary['own_result']['rank_score'] ?? 0]);
            fputcsv($handle, []);
        }

        // Departments ranking
        $departments = $summary['departments'] ?? [];
        if (!empty($departments)) {
            fputcsv($handle, ['Рейтинг кафедр']);
            fputcsv($handle, ['Место', 'Кафедра', 'Баллы']);

            $rank = 1;
            foreach ($departments as $dept) {
                fputcsv($handle, [
                    $rank++,
                    $dept['name'] ?? '',
                    $dept['total_points'] ?? 0,
                ]);
            }
            fputcsv($handle, []);
        }

        // Teachers ranking
        $teachers = $summary['teachers'] ?? [];
        if (!empty($teachers)) {
            fputcsv($handle, ['Рейтинг ППС']);
            fputcsv($handle, ['Место', 'ФИО', 'Баллы']);

            $rank = 1;
            foreach ($teachers as $teacher) {
                fputcsv($handle, [
                    $rank++,
                    $teacher['name'] ?? '',
                    $teacher['total_points'] ?? 0,
                ]);
            }
        }
    }

    private function exportAdminSummary($handle, array $summary): void
    {
        // Status overview
        $status = $summary['status'] ?? [];
        fputcsv($handle, ['Статистика:']);
        fputcsv($handle, ['Категория', 'Количество']);
        fputcsv($handle, ['Активных периодов', $status['active_periods_count'] ?? 0]);
        fputcsv($handle, ['Всего записей', $status['total_entries'] ?? 0]);
        fputcsv($handle, ['Утверждено', $status['approved_entries'] ?? 0]);
        fputcsv($handle, []);

        // Faculties ranking
        $faculties = $summary['faculties'] ?? [];
        if (!empty($faculties)) {
            fputcsv($handle, ['Рейтинг факультетов']);
            fputcsv($handle, ['Факультет', 'Баллы']);

            foreach ($faculties as $faculty) {
                fputcsv($handle, [
                    $faculty['name'] ?? '',
                    $faculty['total_points'] ?? 0,
                ]);
            }
            fputcsv($handle, []);
        }

        // Top teachers
        $topTeachers = $summary['top_teachers'] ?? [];
        if (!empty($topTeachers)) {
            fputcsv($handle, ['Лучшие ППС']);
            fputcsv($handle, ['Место', 'ФИО', 'Баллы']);

            foreach (array_slice($topTeachers, 0, 10) as $i => $teacher) {
                fputcsv($handle, [
                    $i + 1,
                    $teacher['name'] ?? '',
                    $teacher['total_points'] ?? 0,
                ]);
            }
            fputcsv($handle, []);
        }
    }

    private function exportStructuralSummary($handle, array $summary): void
    {
        // Pending entries
        $pending = $summary['pending'] ?? $summary['pending_teachers'] ?? [];
        if (!empty($pending)) {
            fputcsv($handle, ['Ожидают утверждения']);
            fputcsv($handle, ['ФИО', 'Кафедра', 'Раздел', 'Показатель', 'Баллы', 'Статус']);

            foreach ($pending as $item) {
                fputcsv($handle, [
                    $item['user_name'] ?? $item['name'] ?? '',
                    $item['department_name'] ?? $item['department'] ?? '',
                    $item['section'] ?? '',
                    $item['name'] ?? $item['indicator'] ?? '',
                    $item['points'] ?? 0,
                    $this->statusLabel($item['status'] ?? KpiEntry::STATUS_PENDING_STRUCTURAL),
                ]);
            }
        }
    }

    private function statusLabel(string $status): string
    {
        $labels = [
            'draft' => 'Черновик',
            'submitted' => 'Подано',
            'returned' => 'Возвращено',
            'reviewed' => 'Проверено',
            'pending_dean' => 'У декана',
            'pending_structural' => 'На утверждении',
            'approved' => 'Утверждено',
            'rejected' => 'Отклонено',
            'locked' => 'Заблокировано',
        ];

        return $labels[$status] ?? $status;
    }
}

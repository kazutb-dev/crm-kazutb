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
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

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
     * НПУ threshold for a teacher based on their position title.
     * Order of checks matters — check more specific titles first.
     */
    private function teacherNpuThreshold(?string $title): int
    {
        $teacherSettings = $this->npuSettings()['teacher'] ?? [];

        if (! $title) {
            return (int) ($teacherSettings['default_points'] ?? 0);
        }

        $normalizedTitle = $this->normalizeTitleForMatch($title);

        // For summary tables, some dean/HOD users can appear in teacher-like datasets.
        // In that case apply role-based NPU directly by title to avoid falling back to 0.
        if ($this->isDeanTitle($normalizedTitle)) {
            return $this->deanNpuThreshold();
        }

        if ($this->isHodTitle($normalizedTitle)) {
            return $this->hodNpuThreshold(null);
        }

        $bestPoints = null;
        $bestScore = -1;

        foreach (($teacherSettings['rules'] ?? []) as $rule) {
            foreach (($rule['keywords'] ?? []) as $keyword) {
                $normalizedKeyword = $this->normalizeTitleForMatch((string) $keyword);
                if ($normalizedKeyword === '') {
                    continue;
                }

                $score = -1;
                $keywordLength = mb_strlen($normalizedKeyword);

                // Priority: exact title match > phrase/word-boundary match > generic substring.
                if ($normalizedTitle === $normalizedKeyword) {
                    $score = 3000 + $keywordLength;
                } elseif (preg_match('/(^|\s)' . preg_quote($normalizedKeyword, '/') . '(\s|$)/u', $normalizedTitle) === 1) {
                    $score = 2000 + $keywordLength;
                } elseif (str_contains($normalizedTitle, $normalizedKeyword)) {
                    $score = 1000 + $keywordLength;
                }

                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestPoints = (int) ($rule['points'] ?? 0);
                }
            }
        }

        if ($bestPoints !== null) {
            return $bestPoints;
        }

        return (int) ($teacherSettings['default_points'] ?? 0);
    }

    private function normalizeTitleForMatch(string $value): string
    {
        $value = mb_strtolower(trim($value));

        if ($value === '') {
            return '';
        }

        // Normalize punctuation and separators so variants like "и.о." / "ио"
        // and "профессор-исследователь" / "профессор исследователь" match equally.
        $value = (string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', $value);

        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    private function isDeanTitle(string $normalizedTitle): bool
    {
        return str_contains($normalizedTitle, 'декан');
    }

    private function isHodTitle(string $normalizedTitle): bool
    {
        return str_contains($normalizedTitle, 'зав кафедр')
            || str_contains($normalizedTitle, 'заведующ кафедр')
            || str_contains($normalizedTitle, 'завкафедр')
            || str_contains($normalizedTitle, 'зав кафедрой')
            || str_contains($normalizedTitle, 'заведующий кафедрой');
    }

    private function resolveUserTitle(?string $positionTitle, ?string $adTitle): ?string
    {
        $positionTitle = trim((string) ($positionTitle ?? ''));
        if ($positionTitle !== '') {
            return $positionTitle;
        }

        $adTitle = trim((string) ($adTitle ?? ''));

        return $adTitle !== '' ? $adTitle : null;
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
            ->with([
                'indicator:id,section,code,name,unit,base_points,checker_structural_unit_id',
                'indicator.structuralUnits:id,code,name',
                'indicator.checkerStructuralUnit:id,code,name',
                'structuralConfirmations.structuralUnit:id,code,name',
                'structuralConfirmations.confirmer:id,name,display_name',
            ])
            ->where('user_id', $user->id)
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'calculation_details', 'status', 'comment']);

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
                'title' => $this->resolveUserTitle($user->position_title, $user->ad_title),
                'division' => $user->ad_division,
            ],
            'result' => $result ? (function () use ($result, $user) {
                $r = $this->formatResult($result);
                $title = $this->resolveUserTitle($user->position_title, $user->ad_title);
                $r['npu_threshold'] = $this->teacherNpuThreshold($title);
                $r['rate'] = $r['npu_threshold'];
                $r['rank_score'] = $this->teacherRankScore($r['k1'], $r['k2'], $r['k3'], $r['k4'], $r['k5'], $r['k6'], (float) $r['npu_threshold']);
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
            ->with([
                'indicator:id,section,code,name,unit,base_points,checker_structural_unit_id',
                'indicator.structuralUnits:id,code,name',
                'indicator.checkerStructuralUnit:id,code,name',
                'structuralConfirmations.structuralUnit:id,code,name',
                'structuralConfirmations.confirmer:id,name,display_name',
            ])
            ->where('user_id', $user->id)
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->whereIn('entity_type', [KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD, KpiEntry::ENTITY_TYPE_TEACHER])
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'calculation_details', 'status', 'entity_type', 'comment']);

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
                'title' => $this->resolveUserTitle($user->position_title, $user->ad_title),
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
            ->with([
                'indicator:id,section,code,name,unit,base_points,checker_structural_unit_id',
                'indicator.structuralUnits:id,code,name',
                'indicator.checkerStructuralUnit:id,code,name',
                'structuralConfirmations.structuralUnit:id,code,name',
                'structuralConfirmations.confirmer:id,name,display_name',
            ])
            ->where('user_id', $user->id)
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->whereIn('entity_type', [KpiEntry::ENTITY_TYPE_DEAN, KpiEntry::ENTITY_TYPE_TEACHER])
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'calculation_details', 'status', 'entity_type', 'comment']);

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
                'title' => $this->resolveUserTitle($user->position_title, $user->ad_title),
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
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
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
                ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
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

        // Top teachers ranking
        $topTeachers = $this->allTeachersRanking($period);

        // HOD and Dean rankings
        $topHods = $this->allHodsRanking($period);
        $topDeans = $this->allDeansRanking($period);

        // Department summaries
        $deptSummaries = $this->allDeptRanking($period);

        // Section stats — entries/points per KPI section
        $sectionStats = KpiEntry::query()
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->join('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->selectRaw(
                'kpi_indicators.section, COUNT(*) as total, SUM(CASE WHEN kpi_entries.status = ? THEN 1 ELSE 0 END) as approved, ROUND(SUM(COALESCE(kpi_entries.manual_points, kpi_entries.calculated_points, 0)), 2) as total_points',
                [KpiEntry::STATUS_APPROVED]
            )
            ->groupBy('kpi_indicators.section')
            ->get()
            ->mapWithKeys(fn($r) => [$r->section => [
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
                ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
                ->when(!empty($indicatorIds), fn($q) => $q->whereIn('indicator_id', $indicatorIds))
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
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->when(!empty($indicatorIds), fn($q) => $q->whereIn('indicator_id', $indicatorIds))
            ->where('status', KpiEntry::STATUS_PENDING_STRUCTURAL)
            ->join('users', 'users.id', '=', 'kpi_entries.user_id')
            ->join('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->select([
                'kpi_entries.user_id',
                'users.display_name',
                'users.name',
                'users.position_title',
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
            ->map(fn($e) => [
                'id' => $e->user_id,
                'name' => $e->display_name ?? $e->name ?? '—',
                'title' => $this->resolveUserTitle($e->position_title, $e->ad_title),
                'indicator' => $e->indicator_name ?? '—',
                'fact_value' => $e->fact_value,
                'points' => $e->manual_points ?? $e->calculated_points ?? 0,
            ])
            ->values()
            ->all();

        return [
            'scope' => 'structural',
            'divisions' => $user->kpiStructuralUnits->map(fn(KpiStructuralUnit $d) => ['id' => $d->id, 'name' => $d->name, 'code' => $d->code])->values()->all(),
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
                ->when($excludeUserId, fn($q) => $q->where('user_id', '!=', $excludeUserId))
                ->join('users', 'users.id', '=', 'kpi_results.user_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.user_id',
                    'users.display_name',
                    'users.name',
                    'users.position_title',
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
                return $results->map(fn($r) => [
                    'id' => $r->user_id,
                    'name' => $r->display_name ?? $r->name ?? '—',
                    'title' => $this->resolveUserTitle($r->position_title, $r->ad_title),
                    'faculty_name' => $r->faculty_name,
                    'npu_threshold' => $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title)),
                    'rate' => $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title)),
                    'rank_score' => $this->teacherRankScore(
                        (float) $r->k1_score,
                        (float) $r->k2_score,
                        (float) $r->k3_score,
                        (float) $r->k4_score,
                        (float) $r->k5_score,
                        (float) $r->k6_score,
                        (float) $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title))
                    ),
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
                    'users.position_title',
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
                return $results->map(fn($r) => [
                    'id' => $r->user_id,
                    'name' => $r->display_name ?? $r->name ?? '—',
                    'title' => $this->resolveUserTitle($r->position_title, $r->ad_title),
                    'department_name' => $r->department_name,
                    'faculty_name' => $r->faculty_name,
                    'npu_threshold' => $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title)),
                    'rate' => $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title)),
                    'rank_score' => $this->teacherRankScore(
                        (float) $r->k1_score,
                        (float) $r->k2_score,
                        (float) $r->k3_score,
                        (float) $r->k4_score,
                        (float) $r->k5_score,
                        (float) $r->k6_score,
                        (float) $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title))
                    ),
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
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
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
                    'users.position_title',
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
                $resultRows = $results->map(function ($r) {
                    $npu = $this->hodNpuThreshold($r->department_code);
                    $k1234 = (float) $r->k1_score + (float) $r->k2_score + (float) $r->k3_score + (float) $r->k4_score;

                    return [
                        'id' => $r->user_id,
                        'name' => $r->display_name ?? $r->name ?? '—',
                        'title' => $this->resolveUserTitle($r->position_title, $r->ad_title),
                        'department_name' => $r->department_name,
                        'faculty_name' => $r->faculty_name,
                        'npu_threshold' => $npu,
                        'rate' => $npu,
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
                })->values();

                $resultUserIds = $results
                    ->pluck('user_id')
                    ->filter()
                    ->map(fn($id) => (int) $id)
                    ->values()
                    ->all();

                $missingUserIds = array_values(array_diff($hodUserIds->all(), $resultUserIds));
                if (! empty($missingUserIds)) {
                    $liveRows = $this->liveEntityAggregation(KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD, $period, $missingUserIds);
                    $resultRows = $resultRows->concat($liveRows);
                }

                return $resultRows
                    ->sortByDesc(fn(array $row) => (float) ($row['rank_score'] ?? 0))
                    ->values()
                    ->all();
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
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
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
                    'users.position_title',
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
                $resultRows = $results->map(function ($r) {
                    $k1234 = (float) $r->k1_score + (float) $r->k2_score + (float) $r->k3_score + (float) $r->k4_score;

                    return [
                        'id' => $r->user_id,
                        'name' => $r->display_name ?? $r->name ?? '—',
                        'title' => $this->resolveUserTitle($r->position_title, $r->ad_title),
                        'department_name' => $r->department_name,
                        'faculty_name' => $r->faculty_name,
                        'npu_threshold' => $this->deanNpuThreshold(),
                        'rate' => $this->deanNpuThreshold(),
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
                })->values();

                $resultUserIds = $results
                    ->pluck('user_id')
                    ->filter()
                    ->map(fn($id) => (int) $id)
                    ->values()
                    ->all();

                $missingUserIds = array_values(array_diff($deanUserIds->all(), $resultUserIds));
                if (! empty($missingUserIds)) {
                    $liveRows = $this->liveEntityAggregation(KpiEntry::ENTITY_TYPE_DEAN, $period, $missingUserIds);
                    $resultRows = $resultRows->concat($liveRows);
                }

                return $resultRows
                    ->sortByDesc(fn(array $row) => (float) ($row['rank_score'] ?? 0))
                    ->values()
                    ->all();
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
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
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
            ->get(['id', 'display_name', 'name', 'position_title', 'ad_title'])
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
                'title' => $this->resolveUserTitle($users[$r->user_id]?->position_title, $users[$r->user_id]?->ad_title),
                'department_name' => $r->department_id ? ($deptNames[$r->department_id] ?? null) : null,
                'faculty_name' => $r->faculty_id ? ($facultyNames[$r->faculty_id] ?? null) : null,
                'npu_threshold' => $npu,
                'rate' => $npu,
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
    private function allTeachersRanking(?KpiPeriod $period, int $limit = 10000, ?string $statusFilter = null): array
    {
        $teacherUserIds = KpiEntry::query()
            ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->when($statusFilter, fn($q) => $q->where('status', $statusFilter))
            ->when(! $statusFilter, fn($q) => $q->whereNotIn('status', [KpiEntry::STATUS_DRAFT]))
            ->distinct()
            ->pluck('user_id')
            ->filter()
            ->map(fn($id) => (int) $id)
            ->values();

        if ($teacherUserIds->isEmpty()) {
            return [];
        }

        if ($period && ! $statusFilter) {
            $results = KpiResult::query()
                ->where('kpi_period_id', $period->id)
                ->where('result_type', KpiResult::RESULT_TYPE_USER)
                ->whereIn('kpi_results.user_id', $teacherUserIds)
                ->join('users', 'users.id', '=', 'kpi_results.user_id')
                ->leftJoin('departments', 'departments.id', '=', 'kpi_results.department_id')
                ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
                ->select([
                    'kpi_results.user_id',
                    'kpi_results.department_id',
                    'kpi_results.faculty_id',
                    'users.display_name',
                    'users.name',
                    'users.position_title',
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
                $resultRows = $results->map(fn($r) => [
                    'id' => $r->user_id,
                    'faculty_id' => $r->faculty_id ? (int) $r->faculty_id : null,
                    'department_id' => $r->department_id ? (int) $r->department_id : null,
                    'name' => $r->display_name ?? $r->name ?? '—',
                    'title' => $this->resolveUserTitle($r->position_title, $r->ad_title),
                    'department_name' => $r->department_name,
                    'faculty_name' => $r->faculty_name,
                    'npu_threshold' => $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title)),
                    'rate' => $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title)),
                    'rank_score' => $this->teacherRankScore(
                        (float) $r->k1_score,
                        (float) $r->k2_score,
                        (float) $r->k3_score,
                        (float) $r->k4_score,
                        (float) $r->k5_score,
                        (float) $r->k6_score,
                        (float) $this->teacherNpuThreshold($this->resolveUserTitle($r->position_title, $r->ad_title))
                    ),
                    'k1' => (float) $r->k1_score,
                    'k2' => (float) $r->k2_score,
                    'k3' => (float) $r->k3_score,
                    'k4' => (float) $r->k4_score,
                    'k5' => (float) $r->k5_score,
                    'k6' => (float) $r->k6_score,
                    'approved_entries' => (int) $r->approved_entries_count,
                    'source' => 'result',
                ])->values();

                $resultUserIds = $results
                    ->pluck('user_id')
                    ->filter()
                    ->map(fn($id) => (int) $id)
                    ->values()
                    ->all();

                $missingUserIds = array_values(array_diff($teacherUserIds->all(), $resultUserIds));
                if (! empty($missingUserIds)) {
                    $liveRows = $this->liveTeachersAggregation(
                        deptId: null,
                        facultyId: null,
                        period: $period,
                        statusFilter: $statusFilter,
                        limit: max(count($missingUserIds), $limit),
                        onlyUserIds: $missingUserIds,
                    );

                    $resultRows = $resultRows->concat($liveRows);
                }

                return $resultRows
                    ->sortByDesc(fn(array $row) => (float) ($row['rank_score'] ?? 0))
                    ->take($limit)
                    ->values()
                    ->all();
            }
        }

        return $this->liveTeachersAggregation(
            deptId: null,
            facultyId: null,
            period: $period,
            statusFilter: $statusFilter,
            limit: $limit,
            onlyUserIds: $teacherUserIds->all(),
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
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
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

        return $rows->map(fn($row) => [
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
                return $results->map(fn($r) => [
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
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->whereNotNull('department_id')
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->selectRaw('department_id, COUNT(DISTINCT user_id) as user_count, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved', [KpiEntry::STATUS_APPROVED])
            ->groupBy('department_id')
            ->get();

        $deptIds = $rows->pluck('department_id')->filter()->values();
        $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');

        return $rows->map(fn($r) => [
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
        int $limit = 100,
        ?array $onlyUserIds = null
    ): array {
        $entries = KpiEntry::query()
            ->with('indicator')
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->when($deptId, fn($q) => $q->where('department_id', $deptId))
            ->when($facultyId, fn($q) => $q->where('faculty_id', $facultyId))
            ->when($excludeUserId, fn($q) => $q->where('user_id', '!=', $excludeUserId))
            ->when($statusFilter, fn($q) => $q->where('status', $statusFilter))
            ->when(! $statusFilter, fn($q) => $q->whereNotIn('status', [KpiEntry::STATUS_DRAFT]))
            ->when($onlyUserIds !== null, fn($q) => $q->whereIn('user_id', $onlyUserIds))
            ->where('entity_type', KpiEntry::ENTITY_TYPE_TEACHER)
            ->get();

        if ($entries->isEmpty()) {
            return [];
        }

        $userAggregates = [];

        foreach ($entries as $entry) {
            $userId = (int) $entry->user_id;

            if (! isset($userAggregates[$userId])) {
                $userAggregates[$userId] = [
                    'k1' => 0.0,
                    'k2' => 0.0,
                    'k3' => 0.0,
                    'k4' => 0.0,
                    'k5' => 0.0,
                    'approved_entries' => 0,
                    'department_id' => $entry->department_id,
                    'faculty_id' => $entry->faculty_id,
                ];
            }

            if ($entry->status === KpiEntry::STATUS_APPROVED) {
                $points = (float) ($entry->manual_points ?? $entry->calculated_points ?? 0);

                match ($entry->indicator?->section) {
                    KpiIndicator::SECTION_TEACHING => $userAggregates[$userId]['k1'] += $points,
                    KpiIndicator::SECTION_SCIENCE => $userAggregates[$userId]['k2'] += $points,
                    KpiIndicator::SECTION_SOCIAL => $userAggregates[$userId]['k3'] += $points,
                    KpiIndicator::SECTION_QUALIFICATION => $userAggregates[$userId]['k4'] += $points,
                    KpiIndicator::SECTION_SURVEY => $userAggregates[$userId]['k5'] += $points,
                    default => null,
                };

                $userAggregates[$userId]['approved_entries']++;
            }

            if (! $userAggregates[$userId]['department_id'] && $entry->department_id) {
                $userAggregates[$userId]['department_id'] = $entry->department_id;
            }

            if (! $userAggregates[$userId]['faculty_id'] && $entry->faculty_id) {
                $userAggregates[$userId]['faculty_id'] = $entry->faculty_id;
            }
        }

        $userIds = collect(array_keys($userAggregates));
        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'display_name', 'name', 'position_title', 'ad_title'])
            ->keyBy('id');

        $deptIds = collect($userAggregates)
            ->pluck('department_id')
            ->filter()
            ->unique()
            ->values();
        $deptNames = Department::query()->whereIn('id', $deptIds)->pluck('name', 'id');

        $facultyIds = collect($userAggregates)
            ->pluck('faculty_id')
            ->filter()
            ->unique()
            ->values();
        $facultyNames = Faculty::query()->whereIn('id', $facultyIds)->pluck('name', 'id');

        $result = [];

        foreach ($userAggregates as $userId => $aggregate) {
            $user = $users->get($userId);
            $title = $this->resolveUserTitle($user?->position_title, $user?->ad_title);
            $npu = (float) $this->teacherNpuThreshold($title);

            $k1 = (float) $aggregate['k1'];
            $k2 = (float) $aggregate['k2'];
            $k3 = (float) $aggregate['k3'];
            $k4 = (float) $aggregate['k4'];
            $k5 = (float) $aggregate['k5'];

            $result[] = [
                'id' => $userId,
                'faculty_id' => $aggregate['faculty_id'] ? (int) $aggregate['faculty_id'] : null,
                'department_id' => $aggregate['department_id'] ? (int) $aggregate['department_id'] : null,
                'name' => ($user?->display_name ?? $user?->name) ?? '—',
                'title' => $title,
                'department_name' => $aggregate['department_id'] ? ($deptNames[$aggregate['department_id']] ?? null) : null,
                'faculty_name' => $aggregate['faculty_id'] ? ($facultyNames[$aggregate['faculty_id']] ?? null) : null,
                'npu_threshold' => (int) $npu,
                'rate' => (int) $npu,
                'rank_score' => round($this->teacherRankScore($k1, $k2, $k3, $k4, $k5, 0.0, $npu), 2),
                'k1' => round($k1, 2),
                'k2' => round($k2, 2),
                'k3' => round($k3, 2),
                'k4' => round($k4, 2),
                'k5' => round($k5, 2),
                'k6' => 0.0,
                'approved_entries' => (int) $aggregate['approved_entries'],
                'source' => 'live',
            ];
        }

        usort($result, fn($a, $b) => ($b['approved_entries'] <=> $a['approved_entries']) ?: ($b['rank_score'] <=> $a['rank_score']));

        return array_slice($result, 0, $limit);
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
            $grouped[$section][] = $this->buildSummaryEntryPayload($entry);
        }

        return $grouped;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildSummaryEntryPayload(KpiEntry $entry): array
    {
        $displayValues = $this->resolvePlanFactDisplayValues($entry);
        $displayPoints = $this->resolveEntryDisplayPoints($entry);

        return [
            'id' => $entry->id,
            'code' => $entry->indicator?->code,
            'name' => $entry->indicator?->name,
            'unit' => $entry->indicator?->unit,
            'base_points' => $entry->indicator?->base_points !== null
                ? (float) $entry->indicator->base_points
                : null,
            'plan_value' => $entry->plan_value,
            'fact_value' => $entry->fact_value,
            'plan_display_value' => $displayValues['plan_display_value'],
            'fact_display_value' => $displayValues['fact_display_value'],
            'plan_source' => $displayValues['plan_source'],
            'completion_percent' => $displayValues['completion_percent'],
            'points' => $displayPoints,
            'points_formula' => $this->buildEntryPointsFormula($entry),
            'status' => $entry->status,
            'comment' => $entry->comment,
            'structural_confirmations' => $this->buildStructuralConfirmationsPayload($entry),
        ];
    }

    private function resolveEntryDisplayPoints(KpiEntry $entry): float
    {
        $details = is_array($entry->calculation_details) ? $entry->calculation_details : [];
        $ruleKind = trim((string) ($details['rule_kind'] ?? ''));

        if ($entry->manual_points !== null && $ruleKind !== '') {
            return round((float) $entry->manual_points, 2);
        }

        if ($entry->calculated_points !== null && (float) $entry->calculated_points !== 0.0) {
            return round((float) $entry->calculated_points, 2);
        }

        $value = $entry->fact_value !== null
            ? (float) $entry->fact_value
            : ($entry->plan_value !== null ? (float) $entry->plan_value : null);
        $basePoints = $entry->indicator?->base_points !== null
            ? (float) $entry->indicator->base_points
            : null;

        if ($value !== null && $basePoints !== null && $basePoints > 0) {
            return round($value * $basePoints, 2);
        }

        if ($entry->manual_points !== null) {
            return round((float) $entry->manual_points, 2);
        }

        return round((float) ($entry->calculated_points ?? 0), 2);
    }

    /**
     * @return array{plan_display_value: float|null, fact_display_value: float|null, plan_source: string, completion_percent: float|null}
     */
    private function resolvePlanFactDisplayValues(KpiEntry $entry): array
    {
        $planValue = $entry->plan_value !== null ? (float) $entry->plan_value : null;
        $factValue = $entry->fact_value !== null ? (float) $entry->fact_value : null;

        if ($planValue !== null) {
            $planDisplay = $planValue;
            $planSource = 'plan';
        } elseif ($factValue !== null) {
            // Fallback for rows created only at FACT stage.
            $planDisplay = $factValue;
            $planSource = 'fact_fallback';
        } else {
            $planDisplay = null;
            $planSource = 'missing';
        }

        $completionPercent = null;
        if ($planDisplay !== null && $factValue !== null) {
            if ($planDisplay > 0) {
                $completionPercent = round(($factValue / $planDisplay) * 100, 2);
            } elseif ((float) $factValue === 0.0) {
                $completionPercent = 100.0;
            }
        }

        return [
            'plan_display_value' => $planDisplay,
            'fact_display_value' => $factValue,
            'plan_source' => $planSource,
            'completion_percent' => $completionPercent,
        ];
    }

    private function buildEntryPointsFormula(KpiEntry $entry): string
    {
        $points = $this->resolveEntryDisplayPoints($entry);
        $details = is_array($entry->calculation_details) ? $entry->calculation_details : [];
        $quantity = (float) ($details['quantity'] ?? $entry->fact_value ?? 0);
        $ruleKind = (string) ($details['rule_kind'] ?? '');

        if ($ruleKind === 'coauthors') {
            $perSheet = (float) ($details['per_sheet_points'] ?? $entry->indicator?->base_points ?? 0);
            $sheetCount = (float) ($details['sheet_count'] ?? 0);
            $coauthorsCount = max(1.0, (float) ($details['coauthors_count'] ?? 1));

            return sprintf(
                'Баллы = Кол-во × Балл/п.л × П.л. / Соавторы = %s × %s × %s / %s = %s',
                $this->formatFormulaNumber($quantity),
                $this->formatFormulaNumber($perSheet),
                $this->formatFormulaNumber($sheetCount),
                $this->formatFormulaNumber($coauthorsCount),
                $this->formatFormulaNumber($points)
            );
        }

        if (in_array($ruleKind, ['podium', 'improvement', 'roleSplit', 'quartile', 'optionRate'], true)) {
            $selectionPoints = (float) ($details['selection_points'] ?? 0);

            return sprintf(
                'Баллы = Кол-во × Коэффициент = %s × %s = %s',
                $this->formatFormulaNumber($quantity),
                $this->formatFormulaNumber($selectionPoints),
                $this->formatFormulaNumber($points)
            );
        }

        if ($entry->manual_points !== null) {
            return sprintf('Баллы заданы вручную = %s', $this->formatFormulaNumber($points));
        }

        $factValue = $entry->fact_value !== null ? (float) $entry->fact_value : null;
        $basePoints = $entry->indicator?->base_points !== null ? (float) $entry->indicator->base_points : null;

        if ($factValue !== null && $basePoints !== null && $basePoints > 0) {
            return sprintf(
                'Баллы = Факт × Базовые баллы = %s × %s = %s',
                $this->formatFormulaNumber($factValue),
                $this->formatFormulaNumber($basePoints),
                $this->formatFormulaNumber($points)
            );
        }

        return sprintf('Баллы = %s', $this->formatFormulaNumber($points));
    }

    private function formatFormulaNumber(float $value): string
    {
        return number_format($value, 2, '.', '');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildStructuralConfirmationsPayload(KpiEntry $entry): array
    {
        $expectedUnits = collect($entry->indicator?->structuralUnits ?? [])
            ->map(fn($unit) => [
                'id' => (int) $unit->id,
                'code' => $unit->code,
                'name' => $unit->name,
            ]);

        if ($expectedUnits->isEmpty() && $entry->indicator?->checkerStructuralUnit) {
            $unit = $entry->indicator->checkerStructuralUnit;
            $expectedUnits = collect([[
                'id' => (int) $unit->id,
                'code' => $unit->code,
                'name' => $unit->name,
            ]]);
        }

        $byUnitId = $entry->structuralConfirmations->keyBy('structural_unit_id');

        $rows = $expectedUnits->map(function (array $unit) use ($byUnitId) {
            $confirmation = $byUnitId->get($unit['id']);

            return [
                'structural_unit_id' => $unit['id'],
                'structural_unit_code' => $unit['code'],
                'structural_unit_name' => $unit['name'],
                'status' => $confirmation?->status ?? 'pending',
                'comment' => $confirmation?->comment,
                'confirmed_at' => $confirmation?->confirmed_at?->toIso8601String(),
                'confirmed_by' => $confirmation?->confirmer?->display_name
                    ?? $confirmation?->confirmer?->name,
            ];
        })->values();

        foreach ($entry->structuralConfirmations as $confirmation) {
            if ($rows->contains(fn(array $row) => (int) $row['structural_unit_id'] === (int) $confirmation->structural_unit_id)) {
                continue;
            }

            $rows->push([
                'structural_unit_id' => (int) $confirmation->structural_unit_id,
                'structural_unit_code' => $confirmation->structuralUnit?->code,
                'structural_unit_name' => $confirmation->structuralUnit?->name,
                'status' => $confirmation->status ?? 'pending',
                'comment' => $confirmation->comment,
                'confirmed_at' => $confirmation->confirmed_at?->toIso8601String(),
                'confirmed_by' => $confirmation->confirmer?->display_name
                    ?? $confirmation->confirmer?->name,
            ]);
        }

        return $rows->values()->all();
    }

    /**
     * @param \Illuminate\Database\Eloquent\Collection<int, KpiEntry> $entries
     * @return array{total: int, approved: int, submitted: int, pending: int, rejected: int, total_points: float}
     */
    private function calcTotals($entries): array
    {
        $approved = $submitted = $pending = $rejected = 0;
        $totalPoints = 0.0;

        foreach ($entries as $entry) {
            match ($entry->status) {
                KpiEntry::STATUS_APPROVED => $approved++,
                KpiEntry::STATUS_SUBMITTED => $submitted++,
                KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_PENDING_STRUCTURAL, KpiEntry::STATUS_REVIEWED => $pending++,
                KpiEntry::STATUS_REJECTED => $rejected++,
                default => null,
            };
            $totalPoints += $this->resolveEntryDisplayPoints($entry);
        }

        return [
            'total' => $entries->count(),
            'approved' => $approved,
            'submitted' => $submitted,
            'pending' => $pending,
            'rejected' => $rejected,
            'total_points' => $totalPoints,
        ];
    }

    /** @return array<string, mixed> */
    /** Rппс = (K1+K2+K3+K4+K5) − НПУ (fallback: K6) */
    private function teacherRankScore(float $k1, float $k2, float $k3, float $k4, float $k5, float $k6 = 0.0, ?float $npuThreshold = null): float
    {
        $npu = $npuThreshold ?? $k6;

        return ($k1 + $k2 + $k3 + $k4 + $k5) - $npu;
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

        // Keep self-only behavior for plain teachers, but allow KPI admins
        // who may have teacher base role and elevated access via grants.
        if (
            $viewer->resolvedRoleSlug() === 'teacher'
            && ! KpiAccessGrant::userHasKpiAdmin($viewer->id)
            && (int) $viewer->id !== (int) $userId
        ) {
            abort(403);
        }

        $teacher = User::query()->findOrFail($userId, ['id', 'name', 'display_name', 'email', 'position_title', 'ad_title', 'ad_division', 'department_id', 'faculty_id']);

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
                'indicator:id,section,code,name,unit,base_points,checker_structural_unit_id',
                'indicator.structuralUnits:id,code,name',
                'indicator.checkerStructuralUnit:id,code,name',
                'files:id,kpi_entry_id,file_name,file_path,file_disk,file_size',
                'statusLogs' => function ($q) {
                    $q->orderBy('created_at', 'asc');
                },
                'statusLogs.actor:id,name,display_name',
                'structuralConfirmations.structuralUnit:id,code,name',
                'structuralConfirmations.confirmer:id,name,display_name',
            ])
            ->where('user_id', $userId)
            ->when($period, fn($q) => $q->where('kpi_period_id', $period->id))
            ->whereIn('entity_type', array_values(array_unique($entryEntityTypes)))
            ->whereNotIn('status', [KpiEntry::STATUS_DRAFT])
            ->orderBy('created_at')
            ->get(['id', 'indicator_id', 'plan_value', 'fact_value', 'calculated_points', 'manual_points', 'calculation_details', 'status', 'comment', 'submitted_at', 'reviewed_at', 'approved_at', 'created_at', 'updated_at']);

        // Finalized result
        $result = $period
            ? KpiResult::query()
            ->where('kpi_period_id', $period->id)
            ->where('result_type', KpiResult::RESULT_TYPE_USER)
            ->where('user_id', $userId)
            ->first(['rank_score', 'k1_score', 'k2_score', 'k3_score', 'k4_score', 'k5_score', 'k6_score', 'section_scores', 'approved_entries_count'])
            : null;

        // Формируем result с учетом НПУ, как в teacherSummary
        $teacherTitle = $this->resolveUserTitle($teacher->position_title ?? null, $teacher->ad_title ?? null);
        $formattedResult = null;
        if ($result) {
            $r = $this->formatResult($result);
            $r['npu_threshold'] = $this->teacherNpuThreshold($teacherTitle);
            $r['rate'] = $r['npu_threshold'];
            $r['rank_score'] = $this->teacherRankScore($r['k1'], $r['k2'], $r['k3'], $r['k4'], $r['k5'], $r['k6'], (float) $r['npu_threshold']);
            $formattedResult = $r;
        }

        // Group entries by section, include history
        $grouped = [];
        foreach ($entries as $entry) {
            $section = $entry->indicator?->section ?? 'other';
            $grouped[$section][] = [
                ...$this->buildSummaryEntryPayload($entry),
                'submitted_at' => $entry->submitted_at?->toIso8601String(),
                'approved_at' => $entry->approved_at?->toIso8601String(),
                'files' => $entry->files->map(fn($file) => [
                    'id' => $file->id,
                    'file_name' => $file->file_name,
                    'file_size' => $file->file_size,
                    'file_url' => $file->file_url,
                ])->values()->all(),
                'history' => $entry->statusLogs->map(fn($log) => [
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
        $rejected = $entries->where('status', KpiEntry::STATUS_REJECTED)->count();
        $totalPoints = $entries->sum(fn($e) => $this->resolveEntryDisplayPoints($e));

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
                'title' => $teacherTitle,
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
            'result' => $formattedResult,
            'entries' => $grouped,
            'totals' => [
                'total' => $entries->count(),
                'approved' => $approved,
                'submitted' => $submitted,
                'pending' => $pending,
                'rejected' => $rejected,
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

        $facultyId = $request->integer('faculty_id');
        $departmentId = $request->integer('department_id');

        $reportMeta = [
            'teachers' => [
                'title' => 'Результаты профессионального рейтинга ППС',
                'filename' => 'KPI_PPS_',
                'headers' => ['№', 'ФИО', 'Факультет', 'Кафедра', 'Должность', 'НПУ', 'УМР', 'НИР', 'СВР', 'УПК', 'К5', 'Рейтинг'],
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

        if ($report === 'teachers') {
            if ($facultyId > 0) {
                $rows = array_values(array_filter($rows, fn(array $row): bool => (int) ($row['faculty_id'] ?? 0) === $facultyId));
            }

            if ($departmentId > 0) {
                $rows = array_values(array_filter($rows, fn(array $row): bool => (int) ($row['department_id'] ?? 0) === $departmentId));
            }
        }

        $filename = $reportMeta['filename'] . now()->format('Ymd_His') . '.xlsx';

        return response()->streamDownload(function () use ($report, $reportMeta, $rows, $summary, $academicYear, $period): void {
            if ($report === 'teachers') {
                $spreadsheet = $this->buildTeachersRatingSpreadsheet(
                    $rows,
                    $summary,
                    data_get($reportMeta, 'title', 'Результаты профессионального рейтинга ППС'),
                    data_get($academicYear, 'name'),
                    data_get($period, 'name')
                );
            } else {
                $spreadsheet = $this->buildManagementRatingSpreadsheet(
                    $report,
                    $rows,
                    data_get($reportMeta, 'title', ''),
                    data_get($academicYear, 'name'),
                    data_get($period, 'name')
                );
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
            $spreadsheet->disconnectWorksheets();
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @param array<string, mixed> $summary
     */
    private function buildTeachersRatingSpreadsheet(array $rows, array $summary, string $title, ?string $academicYearName, ?string $periodName): Spreadsheet
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('ППС');

        $this->writeTeachersSheet($sheet, $rows, $title, $academicYearName, $periodName);

        $facultySheet = new Worksheet($spreadsheet, 'Факультеты');
        $spreadsheet->addSheet($facultySheet);
        $this->writeFacultySummarySheet($facultySheet, $rows, $periodName, $academicYearName);

        $deptSheet = new Worksheet($spreadsheet, 'Кафедры');
        $spreadsheet->addSheet($deptSheet);
        $this->writeDepartmentSummarySheet($deptSheet, $rows, $periodName, $academicYearName);

        $spreadsheet->setActiveSheetIndex(0);

        return $spreadsheet;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function writeTeachersSheet(Worksheet $sheet, array $rows, string $title, ?string $academicYearName, ?string $periodName): void
    {
        $rows = $this->sortTeachersForExport($rows);
        $rows = $this->applyDenseRanking($rows, 'rank_score');

        $sheet->setShowGridlines(true);
        $this->attachUniversityLogo($sheet, 'A1');

        $sheet->setCellValue('A2', 'РЕЗУЛЬТАТЫ ПРОФЕССИОНАЛЬНОГО РЕЙТИНГА ППС');
        $sheet->mergeCells('A2:L2');
        $sheet->setCellValue('A3', 'АО «КАЗУТБ ИМЕНИ К. КУЛАЖАНОВА»');
        $sheet->mergeCells('A3:L3');
        $sheet->setCellValue('A4', 'R = (K1 + K2 + K3 + K4 + K5) - НПУ');
        $sheet->mergeCells('A4:L4');

        $sheet->setCellValue('A5', 'Учебный год: ' . ($academicYearName ?: 'не указан'));
        $sheet->mergeCells('A5:F5');
        $sheet->setCellValue('G5', 'Период: ' . ($periodName ?: 'не указан'));
        $sheet->mergeCells('G5:L5');
        $sheet->setCellValue('A6', 'Дата формирования: ' . now()->format('d.m.Y H:i'));
        $sheet->mergeCells('A6:L6');

        $sheet->fromArray([
            'Место',
            'ФИО',
            'Факультет',
            'Кафедра',
            'Должность',
            'K1 (УМР)',
            'K2 (НИР)',
            'K3 (СВР)',
            'K4 (УПК)',
            'K5 (Опрос)',
            'НПУ',
            'Рейтинг (R)',
        ], null, 'A8');

        $this->styleTitleBlock($sheet, 'A2:L6');
        $this->styleHeaderRow($sheet, 'A8:L8');

        $currentRow = 9;
        $teacherRowIndex = 0;

        $grouped = [];
        foreach ($rows as $row) {
            $facultyKey = (string) ($row['faculty_id'] ?? ('f:' . ($row['faculty_name'] ?? 'Без факультета')));
            $facultyName = (string) ($row['faculty_name'] ?? 'Без факультета');

            if (! isset($grouped[$facultyKey])) {
                $grouped[$facultyKey] = [
                    'name' => $facultyName,
                    'rows' => [],
                    'departments' => [],
                ];
            }

            $departmentKey = (string) ($row['department_id'] ?? ('d:' . ($row['department_name'] ?? 'Без кафедры')));
            $departmentName = (string) ($row['department_name'] ?? 'Без кафедры');

            if (! isset($grouped[$facultyKey]['departments'][$departmentKey])) {
                $grouped[$facultyKey]['departments'][$departmentKey] = [
                    'name' => $departmentName,
                    'rows' => [],
                ];
            }

            $grouped[$facultyKey]['rows'][] = $row;
            $grouped[$facultyKey]['departments'][$departmentKey]['rows'][] = $row;
        }

        foreach ($grouped as $faculty) {
            $sheet->setCellValue('A' . $currentRow, 'Факультет: ' . $faculty['name']);
            $sheet->mergeCells("A{$currentRow}:L{$currentRow}");
            $sheet->getStyle("A{$currentRow}:L{$currentRow}")->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1F4E78']],
            ]);
            $currentRow++;

            foreach ($faculty['departments'] as $department) {
                $sheet->setCellValue('A' . $currentRow, 'Кафедра: ' . $department['name']);
                $sheet->mergeCells("A{$currentRow}:L{$currentRow}");
                $sheet->getStyle("A{$currentRow}:L{$currentRow}")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => '132844']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DCE6F1']],
                ]);
                $currentRow++;

                $deptRs = [];

                foreach ($department['rows'] as $teacher) {
                    $sheet->setCellValue("A{$currentRow}", (int) ($teacher['rank_position'] ?? 0));
                    $sheet->setCellValue("B{$currentRow}", (string) ($teacher['name'] ?? '—'));
                    $sheet->setCellValue("C{$currentRow}", (string) ($teacher['faculty_name'] ?? '—'));
                    $sheet->setCellValue("D{$currentRow}", (string) ($teacher['department_name'] ?? '—'));
                    $sheet->setCellValue("E{$currentRow}", (string) ($teacher['title'] ?? '—'));
                    $sheet->setCellValue("F{$currentRow}", (float) ($teacher['k1'] ?? 0));
                    $sheet->setCellValue("G{$currentRow}", (float) ($teacher['k2'] ?? 0));
                    $sheet->setCellValue("H{$currentRow}", (float) ($teacher['k3'] ?? 0));
                    $sheet->setCellValue("I{$currentRow}", (float) ($teacher['k4'] ?? 0));
                    $sheet->setCellValue("J{$currentRow}", (float) ($teacher['k5'] ?? 0));
                    $sheet->setCellValue("K{$currentRow}", (float) data_get($teacher, 'rate', data_get($teacher, 'npu_threshold', 0)));
                    $sheet->setCellValue("L{$currentRow}", (float) ($teacher['rank_score'] ?? 0));

                    if ($teacherRowIndex % 2 === 1) {
                        $sheet->getStyle("A{$currentRow}:L{$currentRow}")
                            ->getFill()
                            ->setFillType(Fill::FILL_SOLID)
                            ->getStartColor()
                            ->setRGB('F8FBFF');
                    }

                    $sheet->getStyle("F{$currentRow}:L{$currentRow}")->getNumberFormat()->setFormatCode('# ##0,00');
                    $deptRs[] = (float) ($teacher['rank_score'] ?? 0);

                    $currentRow++;
                    $teacherRowIndex++;
                }

                $deptCount = count($department['rows']);
                $deptAvg = $deptCount > 0 ? array_sum($deptRs) / $deptCount : 0;
                $deptMax = $deptCount > 0 ? max($deptRs) : 0;
                $deptMin = $deptCount > 0 ? min($deptRs) : 0;

                $sheet->setCellValue("B{$currentRow}", 'ИТОГО ПО КАФЕДРЕ');
                $sheet->setCellValue("G{$currentRow}", $deptCount);
                $sheet->setCellValue("H{$currentRow}", $deptAvg);
                $sheet->setCellValue("I{$currentRow}", $deptMax);
                $sheet->setCellValue("J{$currentRow}", $deptMin);
                $sheet->getStyle("A{$currentRow}:L{$currentRow}")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => '132844']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EAF3FF']],
                ]);
                $sheet->getStyle("H{$currentRow}:J{$currentRow}")->getNumberFormat()->setFormatCode('# ##0,00');
                $currentRow++;
            }

            $facultyRows = $faculty['rows'];
            $facultyRs = array_map(fn(array $item): float => (float) ($item['rank_score'] ?? 0), $facultyRows);
            $facultyCount = count($facultyRows);
            $facultyAvg = $facultyCount > 0 ? array_sum($facultyRs) / $facultyCount : 0;
            $facultyMax = $facultyCount > 0 ? max($facultyRs) : 0;
            $facultyMin = $facultyCount > 0 ? min($facultyRs) : 0;

            $sheet->setCellValue("B{$currentRow}", 'ИТОГО ПО ФАКУЛЬТЕТУ');
            $sheet->setCellValue("G{$currentRow}", $facultyCount);
            $sheet->setCellValue("H{$currentRow}", $facultyAvg);
            $sheet->setCellValue("I{$currentRow}", $facultyMax);
            $sheet->setCellValue("J{$currentRow}", $facultyMin);
            $sheet->getStyle("A{$currentRow}:L{$currentRow}")->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '305496']],
            ]);
            $sheet->getStyle("H{$currentRow}:J{$currentRow}")->getNumberFormat()->setFormatCode('# ##0,00');
            $currentRow++;
        }

        $lastRow = max($currentRow - 1, 8);
        $sheet->getStyle("A8:L{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A8:E{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $sheet->getStyle("F8:L{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->setAutoFilter("A8:L8");
        $sheet->freezePane('A9');

        foreach (range('A', 'L') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function writeFacultySummarySheet(Worksheet $sheet, array $rows, ?string $periodName, ?string $academicYearName): void
    {
        $sheet->setCellValue('A1', 'СВОДКА ПО ФАКУЛЬТЕТАМ');
        $sheet->mergeCells('A1:G1');
        $sheet->setCellValue('A2', 'Учебный год: ' . ($academicYearName ?: 'не указан') . ' | Период: ' . ($periodName ?: 'не указан'));
        $sheet->mergeCells('A2:G2');

        $sheet->fromArray(['Место', 'Факультет', 'Количество ППС', 'Средний R', 'Утверждено', 'На проверке', 'На утверждении'], null, 'A4');
        $this->styleHeaderRow($sheet, 'A4:G4');

        $grouped = [];
        foreach ($rows as $row) {
            $facultyId = (int) ($row['faculty_id'] ?? 0);
            $facultyName = (string) ($row['faculty_name'] ?? 'Без факультета');
            $key = $facultyId > 0 ? (string) $facultyId : ('name:' . $facultyName);

            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'faculty_id' => $facultyId,
                    'faculty_name' => $facultyName,
                    'rows' => [],
                ];
            }

            $grouped[$key]['rows'][] = $row;
        }

        $facultyIds = array_values(array_unique(array_filter(array_map(fn(array $f): int => (int) ($f['faculty_id'] ?? 0), array_values($grouped)))));
        $statusRows = KpiEntry::query()
            ->when($facultyIds !== [], fn($q) => $q->whereIn('faculty_id', $facultyIds))
            ->selectRaw(
                'faculty_id,
                 SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved,
                 SUM(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END) as on_check,
                 SUM(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END) as on_approval',
                [
                    KpiEntry::STATUS_APPROVED,
                    KpiEntry::STATUS_SUBMITTED,
                    KpiEntry::STATUS_REVIEWED,
                    KpiEntry::STATUS_PENDING_DEAN,
                    KpiEntry::STATUS_PENDING_STRUCTURAL,
                ]
            )
            ->groupBy('faculty_id')
            ->get()
            ->keyBy('faculty_id');

        $items = array_map(function (array $faculty) use ($statusRows): array {
            $scores = array_map(fn(array $item): float => (float) ($item['rank_score'] ?? 0), $faculty['rows']);
            $count = count($faculty['rows']);
            $status = $statusRows->get($faculty['faculty_id']);

            return [
                'faculty_name' => $faculty['faculty_name'],
                'count' => $count,
                'avg_r' => $count > 0 ? array_sum($scores) / $count : 0,
                'approved' => (int) ($status->approved ?? 0),
                'on_check' => (int) ($status->on_check ?? 0),
                'on_approval' => (int) ($status->on_approval ?? 0),
            ];
        }, array_values($grouped));

        usort($items, fn(array $a, array $b): int => ($b['avg_r'] <=> $a['avg_r']) ?: strcmp($a['faculty_name'], $b['faculty_name']));

        $items = $this->applyDenseRanking($items, 'avg_r');

        $rowNum = 5;
        foreach ($items as $idx => $item) {
            $sheet->setCellValue("A{$rowNum}", (int) ($item['rank_position'] ?? ($idx + 1)));
            $sheet->setCellValue("B{$rowNum}", $item['faculty_name']);
            $sheet->setCellValue("C{$rowNum}", (int) $item['count']);
            $sheet->setCellValue("D{$rowNum}", (float) $item['avg_r']);
            $sheet->setCellValue("E{$rowNum}", (int) $item['approved']);
            $sheet->setCellValue("F{$rowNum}", (int) $item['on_check']);
            $sheet->setCellValue("G{$rowNum}", (int) $item['on_approval']);

            if ($idx % 2 === 1) {
                $sheet->getStyle("A{$rowNum}:G{$rowNum}")
                    ->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()
                    ->setRGB('F8FBFF');
            }
            $rowNum++;
        }

        $lastRow = max($rowNum - 1, 4);
        $sheet->getStyle("A4:G{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("D5:D{$lastRow}")->getNumberFormat()->setFormatCode('# ##0,00');
        $sheet->setAutoFilter('A4:G4');
        $sheet->freezePane('A5');

        foreach (range('A', 'G') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function writeDepartmentSummarySheet(Worksheet $sheet, array $rows, ?string $periodName, ?string $academicYearName): void
    {
        $sheet->setCellValue('A1', 'СВОДКА ПО КАФЕДРАМ');
        $sheet->mergeCells('A1:K1');
        $sheet->setCellValue('A2', 'Учебный год: ' . ($academicYearName ?: 'не указан') . ' | Период: ' . ($periodName ?: 'не указан'));
        $sheet->mergeCells('A2:K2');

        $sheet->fromArray([
            'Место',
            'Факультет',
            'Кафедра',
            'Количество ППС',
            'Средний R',
            'Средний K1',
            'Средний K2',
            'Средний K3',
            'Средний K4',
            'Средний K5',
            'Средний НПУ',
        ], null, 'A4');
        $this->styleHeaderRow($sheet, 'A4:K4');

        $grouped = [];
        foreach ($rows as $row) {
            $facultyName = (string) ($row['faculty_name'] ?? 'Без факультета');
            $departmentName = (string) ($row['department_name'] ?? 'Без кафедры');
            $departmentId = (int) ($row['department_id'] ?? 0);
            $key = $departmentId > 0 ? (string) $departmentId : ($facultyName . '::' . $departmentName);

            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'faculty_name' => $facultyName,
                    'department_name' => $departmentName,
                    'rows' => [],
                ];
            }

            $grouped[$key]['rows'][] = $row;
        }

        $items = array_map(function (array $group): array {
            $count = count($group['rows']);
            $sum = [
                'r' => 0.0,
                'k1' => 0.0,
                'k2' => 0.0,
                'k3' => 0.0,
                'k4' => 0.0,
                'k5' => 0.0,
                'npu' => 0.0,
            ];

            foreach ($group['rows'] as $row) {
                $sum['r'] += (float) ($row['rank_score'] ?? 0);
                $sum['k1'] += (float) ($row['k1'] ?? 0);
                $sum['k2'] += (float) ($row['k2'] ?? 0);
                $sum['k3'] += (float) ($row['k3'] ?? 0);
                $sum['k4'] += (float) ($row['k4'] ?? 0);
                $sum['k5'] += (float) ($row['k5'] ?? 0);
                $sum['npu'] += (float) data_get($row, 'rate', data_get($row, 'npu_threshold', 0));
            }

            return [
                'faculty_name' => $group['faculty_name'],
                'department_name' => $group['department_name'],
                'count' => $count,
                'avg_r' => $count > 0 ? $sum['r'] / $count : 0,
                'avg_k1' => $count > 0 ? $sum['k1'] / $count : 0,
                'avg_k2' => $count > 0 ? $sum['k2'] / $count : 0,
                'avg_k3' => $count > 0 ? $sum['k3'] / $count : 0,
                'avg_k4' => $count > 0 ? $sum['k4'] / $count : 0,
                'avg_k5' => $count > 0 ? $sum['k5'] / $count : 0,
                'avg_npu' => $count > 0 ? $sum['npu'] / $count : 0,
            ];
        }, array_values($grouped));

        usort($items, fn(array $a, array $b): int => ($b['avg_r'] <=> $a['avg_r']) ?: strcmp($a['department_name'], $b['department_name']));
        $items = $this->applyDenseRanking($items, 'avg_r');

        $rowNum = 5;
        foreach ($items as $idx => $item) {
            $sheet->setCellValue("A{$rowNum}", (int) ($item['rank_position'] ?? ($idx + 1)));
            $sheet->setCellValue("B{$rowNum}", $item['faculty_name']);
            $sheet->setCellValue("C{$rowNum}", $item['department_name']);
            $sheet->setCellValue("D{$rowNum}", (int) $item['count']);
            $sheet->setCellValue("E{$rowNum}", (float) $item['avg_r']);
            $sheet->setCellValue("F{$rowNum}", (float) $item['avg_k1']);
            $sheet->setCellValue("G{$rowNum}", (float) $item['avg_k2']);
            $sheet->setCellValue("H{$rowNum}", (float) $item['avg_k3']);
            $sheet->setCellValue("I{$rowNum}", (float) $item['avg_k4']);
            $sheet->setCellValue("J{$rowNum}", (float) $item['avg_k5']);
            $sheet->setCellValue("K{$rowNum}", (float) $item['avg_npu']);

            if ($idx % 2 === 1) {
                $sheet->getStyle("A{$rowNum}:K{$rowNum}")
                    ->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()
                    ->setRGB('F8FBFF');
            }

            $rowNum++;
        }

        $lastRow = max($rowNum - 1, 4);
        $sheet->getStyle("A4:K{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("E5:K{$lastRow}")->getNumberFormat()->setFormatCode('# ##0,00');
        $sheet->setAutoFilter('A4:K4');
        $sheet->freezePane('A5');

        foreach (range('A', 'K') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function buildManagementRatingSpreadsheet(string $report, array $rows, string $title, ?string $academicYearName, ?string $periodName): Spreadsheet
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($report === 'deans' ? 'Деканы' : 'Завкафедры');

        $sheet->setCellValue('A1', mb_strtoupper($title));
        $lastColumn = $report === 'deans' ? 'I' : 'J';
        $sheet->mergeCells("A1:{$lastColumn}1");
        $sheet->setCellValue('A2', 'Учебный год: ' . ($academicYearName ?: 'не указан') . ' | Период: ' . ($periodName ?: 'не указан'));
        $sheet->mergeCells("A2:{$lastColumn}2");
        $sheet->setCellValue('A3', 'Дата формирования: ' . now()->format('d.m.Y H:i'));
        $sheet->mergeCells("A3:{$lastColumn}3");
        $sheet->setCellValue('A4', 'R = (K1 + K2 + K3 + K4) - НПУ');
        $sheet->mergeCells("A4:{$lastColumn}4");

        $headers = $report === 'deans'
            ? ['№', 'Факультет', 'ФИО декана', 'НПУ', 'Рейтинг', 'УМР', 'НИР', 'СВР', 'УПК']
            : ['№', 'Факультет', 'Кафедра', 'ФИО зав.каф.', 'НПУ', 'Рейтинг', 'УМР', 'НИР', 'СВР', 'УПК'];

        $sheet->fromArray($headers, null, 'A6');
        $this->styleTitleBlock($sheet, "A1:{$lastColumn}4");
        $this->styleHeaderRow($sheet, "A6:{$lastColumn}6");

        $rowNum = 7;
        $rows = $this->applyDenseRanking($this->sortTeachersForExport($rows), 'rank_score');

        foreach ($rows as $index => $row) {
            if ($report === 'deans') {
                $sheet->fromArray([
                    (int) ($row['rank_position'] ?? ($index + 1)),
                    (string) data_get($row, 'faculty_name', '—'),
                    (string) data_get($row, 'name', '—'),
                    (float) data_get($row, 'npu_threshold', 0),
                    (float) data_get($row, 'rank_score', 0),
                    (float) data_get($row, 'k1', 0),
                    (float) data_get($row, 'k2', 0),
                    (float) data_get($row, 'k3', 0),
                    (float) data_get($row, 'k4', 0),
                ], null, "A{$rowNum}");
            } else {
                $sheet->fromArray([
                    (int) ($row['rank_position'] ?? ($index + 1)),
                    (string) data_get($row, 'faculty_name', '—'),
                    (string) data_get($row, 'department_name', '—'),
                    (string) data_get($row, 'name', '—'),
                    (float) data_get($row, 'npu_threshold', 0),
                    (float) data_get($row, 'rank_score', 0),
                    (float) data_get($row, 'k1', 0),
                    (float) data_get($row, 'k2', 0),
                    (float) data_get($row, 'k3', 0),
                    (float) data_get($row, 'k4', 0),
                ], null, "A{$rowNum}");
            }

            if ($index % 2 === 1) {
                $sheet->getStyle("A{$rowNum}:{$lastColumn}{$rowNum}")
                    ->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()
                    ->setRGB('F8FBFF');
            }

            $rowNum++;
        }

        $summaryRow = $rowNum;
        $sheet->setCellValue("A{$summaryRow}", 'ИТОГО');
        $sheet->mergeCells("A{$summaryRow}:B{$summaryRow}");
        $sheet->setCellValue("C{$summaryRow}", 'Количество');
        $sheet->setCellValue("D{$summaryRow}", count($rows));
        $sheet->setCellValue("E{$summaryRow}", 'Средний R');
        $avgR = count($rows) > 0 ? array_sum(array_map(fn(array $item): float => (float) ($item['rank_score'] ?? 0), $rows)) / count($rows) : 0;
        $sheet->setCellValue("F{$summaryRow}", $avgR);
        $sheet->getStyle("A{$summaryRow}:{$lastColumn}{$summaryRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EAF3FF']],
        ]);

        $lastDataRow = max($summaryRow, 6);
        $sheet->getStyle("A6:{$lastColumn}{$lastDataRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $numericStart = $report === 'deans' ? 'D' : 'E';
        $sheet->getStyle("{$numericStart}7:{$lastColumn}{$lastDataRow}")->getNumberFormat()->setFormatCode('# ##0,00');
        $sheet->setAutoFilter("A6:{$lastColumn}6");
        $sheet->freezePane('A7');

        for ($i = 1; $i <= Coordinate::columnIndexFromString($lastColumn); $i++) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($i))->setAutoSize(true);
        }

        return $spreadsheet;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function sortTeachersForExport(array $rows): array
    {
        usort($rows, function (array $a, array $b): int {
            $rankCmp = ((float) ($b['rank_score'] ?? 0)) <=> ((float) ($a['rank_score'] ?? 0));
            if ($rankCmp !== 0) {
                return $rankCmp;
            }

            return strcmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
        });

        return $rows;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function applyDenseRanking(array $rows, string $scoreKey): array
    {
        $lastScore = null;
        $lastRank = 0;

        foreach ($rows as $index => $row) {
            $currentScore = (float) ($row[$scoreKey] ?? 0);

            if ($lastScore === null || abs($currentScore - $lastScore) > 0.000001) {
                $lastRank = $index + 1;
                $lastScore = $currentScore;
            }

            $rows[$index]['rank_position'] = $lastRank;
        }

        return $rows;
    }

    private function styleTitleBlock(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'name' => 'Calibri',
                'bold' => true,
                'color' => ['rgb' => '132844'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
        ]);
    }

    private function styleHeaderRow(Worksheet $sheet, string $range): void
    {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'name' => 'Calibri',
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '132844'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
        ]);
    }

    private function attachUniversityLogo(Worksheet $sheet, string $cell): void
    {
        $logoPath = public_path('assets/images/logo.png');
        if (! is_file($logoPath)) {
            return;
        }

        try {
            $drawing = new Drawing();
            $drawing->setName('KazUTB');
            $drawing->setDescription('KazUTB Logo');
            $drawing->setPath($logoPath);
            $drawing->setCoordinates($cell);
            $drawing->setHeight(52);
            $drawing->setWorksheet($sheet);
        } catch (\Throwable) {
            // Fallback: keep report generation resilient when image processing extensions are unavailable.
        }
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

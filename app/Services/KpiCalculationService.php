<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiResult;
use App\Models\User;
use App\Services\KpiParticipantEligibilityService;
use App\Services\KpiNpuSettingsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class KpiCalculationService
{
    private const ENTITY_TYPE_HOD = 'department_head';
    private const ENTITY_TYPE_DEAN = 'dean';

    /**
     * Mapping section => coefficient for Rpps = (K1 + K2 + K3 + K4 + K5) - K6.
     * K6 is intentionally kept as an override/penalty channel because the
     * current indicator dictionary exposes five positive sections only.
     *
     * @var array<string, string>
     */
    private const SECTION_COEFFICIENT_MAP = [
        KpiIndicator::SECTION_TEACHING => 'k1',
        KpiIndicator::SECTION_SCIENCE => 'k2',
        KpiIndicator::SECTION_SOCIAL => 'k3',
        KpiIndicator::SECTION_QUALIFICATION => 'k4',
        KpiIndicator::SECTION_SURVEY => 'k5',
    ];

    private ?array $cachedNpuSettings = null;

    private ?KpiParticipantEligibilityService $eligibilityService = null;

    /**
     * Recalculate KPI rank score for one user from approved entries only.
     *
     * @param User|int $user
     * @param KpiPeriod|int $period
     * @param array<string, mixed> $options
     */
    public function calculateForUser(User|int $user, KpiPeriod|int $period, array $options = []): KpiResult
    {
        $resolvedUser = $user instanceof User
            ? $user
            : User::query()->findOrFail($user);

        $resolvedPeriod = $this->resolvePeriod($period);
        $entityType = (string) ($options['entity_type'] ?? KpiEntry::ENTITY_TYPE_TEACHER);

        return DB::transaction(function () use ($resolvedUser, $resolvedPeriod, $entityType, $options): KpiResult {
            $eligibility = $this->eligibility()->evaluateUser($resolvedUser);
            if (! $eligibility['eligible']) {
                return $this->storeResult([
                    'kpi_period_id' => $resolvedPeriod->id,
                    'academic_year_id' => $resolvedPeriod->academic_year_id,
                    'result_type' => KpiResult::RESULT_TYPE_USER,
                    'entity_type' => $entityType,
                    'user_id' => $resolvedUser->id,
                    'faculty_id' => $options['faculty_id'] ?? null,
                    'department_id' => $options['department_id'] ?? null,
                    'approved_entries_count' => 0,
                    'section_scores' => [],
                    'k1_score' => 0,
                    'k2_score' => 0,
                    'k3_score' => 0,
                    'k4_score' => 0,
                    'k5_score' => 0,
                    'k6_score' => 0,
                    'formula_name' => KpiResult::FORMULA_RPPS_V1,
                    'rank_score' => 0,
                    'metadata' => [
                        'hard_check' => $eligibility,
                        'calculation_context' => $options['metadata'] ?? null,
                    ],
                ]);
            }

            $query = $this->approvedEntriesQuery($resolvedPeriod, $entityType)
                ->where('kpi_entries.user_id', $resolvedUser->id);

            $sectionScores = $this->aggregateApprovedScoresBySection($query);
            $approvedEntriesCount = $this->countApprovedEntries($query);
            $departmentCode = null;

            if ($resolvedUser->department_id) {
                $departmentCode = Department::query()
                    ->where('id', $resolvedUser->department_id)
                    ->value('code');
            }

            $title = trim((string) ($resolvedUser->position_title ?: $resolvedUser->ad_title));
            $npuThreshold = (float) ($options['npu_threshold'] ?? $this->resolveEntityNpuThreshold($entityType, $title, $departmentCode));

            $coefficientScores = $this->buildCoefficientScores($sectionScores, [
                ...$options,
                'entity_type' => $entityType,
                'k6_score' => $npuThreshold,
            ]);

            $rankScore = $this->computeRankScoreForEntity(
                $entityType,
                $coefficientScores['k1'],
                $coefficientScores['k2'],
                $coefficientScores['k3'],
                $coefficientScores['k4'],
                $coefficientScores['k5'],
                $coefficientScores['k6'],
                $npuThreshold,
            );

            return $this->storeResult([
                'kpi_period_id' => $resolvedPeriod->id,
                'academic_year_id' => $resolvedPeriod->academic_year_id,
                'result_type' => KpiResult::RESULT_TYPE_USER,
                'entity_type' => $entityType,
                'user_id' => $resolvedUser->id,
                'faculty_id' => $options['faculty_id'] ?? null,
                'department_id' => $options['department_id'] ?? null,
                'approved_entries_count' => $approvedEntriesCount,
                'section_scores' => $sectionScores,
                'k1_score' => $coefficientScores['k1'],
                'k2_score' => $coefficientScores['k2'],
                'k3_score' => $coefficientScores['k3'],
                'k4_score' => $coefficientScores['k4'],
                'k5_score' => $coefficientScores['k5'],
                'k6_score' => $coefficientScores['k6'],
                'formula_name' => KpiResult::FORMULA_RPPS_V1,
                'rank_score' => $rankScore,
                'metadata' => $this->buildMetadata($sectionScores, $coefficientScores, [
                    ...$options,
                    'entity_type' => $entityType,
                    'npu_threshold' => $npuThreshold,
                    'hard_check' => $eligibility,
                ]),
            ]);
        }, 3);
    }

    /**
     * Recalculate department KPI score from approved entries only.
     *
     * @param Department|int $department
     * @param KpiPeriod|int $period
     * @param array<string, mixed> $options
     */
    public function calculateForDepartment(Department|int $department, KpiPeriod|int $period, array $options = []): KpiResult
    {
        $resolvedDepartment = $department instanceof Department
            ? $department
            : Department::query()->findOrFail($department);

        $resolvedPeriod = $this->resolvePeriod($period);
        $entityType = (string) ($options['entity_type'] ?? KpiEntry::ENTITY_TYPE_TEACHER);

        return DB::transaction(function () use ($resolvedDepartment, $resolvedPeriod, $entityType, $options): KpiResult {
            $query = $this->approvedEntriesQuery($resolvedPeriod, $entityType)
                ->where('kpi_entries.department_id', $resolvedDepartment->id);

            $sectionScores = $this->aggregateApprovedScoresBySection($query);
            $approvedEntriesCount = $this->countApprovedEntries($query);
            $coefficientScores = $this->buildCoefficientScores($sectionScores, $options);
            $rankScore = $this->calculateRankScore($coefficientScores);

            return $this->storeResult([
                'kpi_period_id' => $resolvedPeriod->id,
                'academic_year_id' => $resolvedPeriod->academic_year_id,
                'result_type' => KpiResult::RESULT_TYPE_DEPARTMENT,
                'entity_type' => $entityType,
                'user_id' => null,
                'faculty_id' => $options['faculty_id'] ?? null,
                'department_id' => $resolvedDepartment->id,
                'approved_entries_count' => $approvedEntriesCount,
                'section_scores' => $sectionScores,
                'k1_score' => $coefficientScores['k1'],
                'k2_score' => $coefficientScores['k2'],
                'k3_score' => $coefficientScores['k3'],
                'k4_score' => $coefficientScores['k4'],
                'k5_score' => $coefficientScores['k5'],
                'k6_score' => $coefficientScores['k6'],
                'formula_name' => KpiResult::FORMULA_RPPS_V1,
                'rank_score' => $rankScore,
                'metadata' => $this->buildMetadata($sectionScores, $coefficientScores, $options),
            ]);
        }, 3);
    }

    /**
     * Recalculate faculty KPI score from approved entries only.
     *
     * @param Faculty|int $faculty
     * @param KpiPeriod|int $period
     * @param array<string, mixed> $options
     */
    public function calculateForFaculty(Faculty|int $faculty, KpiPeriod|int $period, array $options = []): KpiResult
    {
        $resolvedFaculty = $faculty instanceof Faculty
            ? $faculty
            : Faculty::query()->findOrFail($faculty);

        $resolvedPeriod = $this->resolvePeriod($period);
        $entityType = (string) ($options['entity_type'] ?? KpiEntry::ENTITY_TYPE_TEACHER);

        return DB::transaction(function () use ($resolvedFaculty, $resolvedPeriod, $entityType, $options): KpiResult {
            $query = $this->approvedEntriesQuery($resolvedPeriod, $entityType)
                ->where('kpi_entries.faculty_id', $resolvedFaculty->id);

            $sectionScores = $this->aggregateApprovedScoresBySection($query);
            $approvedEntriesCount = $this->countApprovedEntries($query);
            $coefficientScores = $this->buildCoefficientScores($sectionScores, $options);
            $rankScore = $this->calculateRankScore($coefficientScores);

            return $this->storeResult([
                'kpi_period_id' => $resolvedPeriod->id,
                'academic_year_id' => $resolvedPeriod->academic_year_id,
                'result_type' => KpiResult::RESULT_TYPE_FACULTY,
                'entity_type' => $entityType,
                'user_id' => null,
                'faculty_id' => $resolvedFaculty->id,
                'department_id' => null,
                'approved_entries_count' => $approvedEntriesCount,
                'section_scores' => $sectionScores,
                'k1_score' => $coefficientScores['k1'],
                'k2_score' => $coefficientScores['k2'],
                'k3_score' => $coefficientScores['k3'],
                'k4_score' => $coefficientScores['k4'],
                'k5_score' => $coefficientScores['k5'],
                'k6_score' => $coefficientScores['k6'],
                'formula_name' => KpiResult::FORMULA_RPPS_V1,
                'rank_score' => $rankScore,
                'metadata' => $this->buildMetadata($sectionScores, $coefficientScores, $options),
            ]);
        }, 3);
    }

    /**
     * Example of production-ready aggregation by section.
     *
     * select
     *   kpi_indicators.section,
     *   sum(coalesce(kpi_entries.manual_points, kpi_entries.calculated_points, 0)) as section_score
     * from kpi_entries
     * inner join kpi_indicators on kpi_indicators.id = kpi_entries.indicator_id
     * where kpi_entries.status = 'approved'
     * group by kpi_indicators.section;
     *
     * @return array<string, float>
     */
    public function aggregateApprovedScoresBySection(Builder $query): array
    {
        $scores = (clone $query)
            ->selectRaw('kpi_indicators.section as section')
            ->selectRaw('ROUND(SUM(COALESCE(kpi_entries.manual_points, kpi_entries.calculated_points, 0)), 2) as section_score')
            ->groupBy('kpi_indicators.section')
            ->pluck('section_score', 'section')
            ->all();

        $normalized = [];

        foreach ($scores as $section => $score) {
            $normalized[(string) $section] = $this->roundScore((float) $score);
        }

        return $normalized;
    }

    /**
     * Example of final rank score persistence via updateOrCreate.
     */
    public function storeResult(array $attributes): KpiResult
    {
        $now = Carbon::now();

        return KpiResult::query()->updateOrCreate(
            [
                'kpi_period_id' => (int) $attributes['kpi_period_id'],
                'result_type' => (string) $attributes['result_type'],
                'entity_type' => (string) $attributes['entity_type'],
                'user_id' => $attributes['user_id'] ?? null,
                'faculty_id' => $attributes['faculty_id'] ?? null,
                'department_id' => $attributes['department_id'] ?? null,
            ],
            [
                'academic_year_id' => (int) $attributes['academic_year_id'],
                'approved_entries_count' => (int) ($attributes['approved_entries_count'] ?? 0),
                'section_scores' => $attributes['section_scores'] ?? [],
                'k1_score' => $this->roundScore((float) ($attributes['k1_score'] ?? 0)),
                'k2_score' => $this->roundScore((float) ($attributes['k2_score'] ?? 0)),
                'k3_score' => $this->roundScore((float) ($attributes['k3_score'] ?? 0)),
                'k4_score' => $this->roundScore((float) ($attributes['k4_score'] ?? 0)),
                'k5_score' => $this->roundScore((float) ($attributes['k5_score'] ?? 0)),
                'k6_score' => $this->roundScore((float) ($attributes['k6_score'] ?? 0)),
                'formula_name' => (string) ($attributes['formula_name'] ?? KpiResult::FORMULA_RPPS_V1),
                'rank_score' => $this->roundScore((float) ($attributes['rank_score'] ?? 0)),
                'metadata' => $attributes['metadata'] ?? null,
                'calculated_at' => $now,
            ],
        );
    }

    private function approvedEntriesQuery(KpiPeriod $period, string $entityType): Builder
    {
        $query = KpiEntry::query()
            ->join('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->where('kpi_entries.kpi_period_id', $period->id)
            ->where('kpi_entries.academic_year_id', $period->academic_year_id)
            ->where('kpi_entries.entity_type', $entityType)
            ->where('kpi_entries.status', KpiEntry::STATUS_APPROVED);

        return $this->eligibility()->applyEligibilityJoinForEntries($query, 'kpi_entries.user_id');
    }

    /**
     * @param array<string, float> $sectionScores
     * @param array<string, mixed> $options
     * @return array{k1: float, k2: float, k3: float, k4: float, k5: float, k6: float}
     */
    private function buildCoefficientScores(array $sectionScores, array $options): array
    {
        $scores = [
            'k1' => 0.0,
            'k2' => 0.0,
            'k3' => 0.0,
            'k4' => 0.0,
            'k5' => 0.0,
            'k6' => 0.0,
        ];

        foreach (self::SECTION_COEFFICIENT_MAP as $section => $coefficient) {
            $scores[$coefficient] = $this->roundScore((float) ($sectionScores[$section] ?? 0));
        }

        $entityType = (string) ($options['entity_type'] ?? KpiEntry::ENTITY_TYPE_TEACHER);

        if (in_array($entityType, [self::ENTITY_TYPE_HOD, self::ENTITY_TYPE_DEAN], true)) {
            // For HOD/Dean formula K5 is not part of the ranking calculation by ToR.
            $scores['k5'] = 0.0;
        }

        $scores['k6'] = $this->roundScore((float) ($options['k6_score'] ?? $sectionScores['penalty'] ?? $sectionScores['deduction'] ?? 0));

        return $scores;
    }

    /**
     * @param array{k1: float, k2: float, k3: float, k4: float, k5: float, k6: float} $scores
     */
    private function calculateRankScore(array $scores): float
    {
        return $this->roundScore(
            $scores['k1']
                + $scores['k2']
                + $scores['k3']
                + $scores['k4']
                + $scores['k5']
                - $scores['k6']
        );
    }

    public function computeRankScoreForEntity(
        string $entityType,
        float $k1,
        float $k2,
        float $k3,
        float $k4,
        float $k5,
        float $k6 = 0.0,
        ?float $npuThreshold = null,
    ): float {
        $npu = $npuThreshold ?? $k6;
        $base = $k1 + $k2 + $k3 + $k4;

        if (! in_array($entityType, [self::ENTITY_TYPE_HOD, self::ENTITY_TYPE_DEAN], true)) {
            $base += $k5;
        }

        return $this->roundScore($base - $npu);
    }

    public function resolveTeacherNpuThreshold(?string $title): int
    {
        $teacherSettings = $this->npuSettings()['teacher'] ?? [];

        if (! $title) {
            return (int) ($teacherSettings['default_points'] ?? 0);
        }

        $normalizedTitle = $this->normalizeTitleForMatch($title);

        if ($this->isDeanTitle($normalizedTitle)) {
            return $this->resolveDeanNpuThreshold();
        }

        if ($this->isHodTitle($normalizedTitle)) {
            return $this->resolveHodNpuThreshold(null);
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

                if ($normalizedTitle === $normalizedKeyword) {
                    $score = 3000 + $keywordLength;
                } elseif (preg_match('/(^|\\s)' . preg_quote($normalizedKeyword, '/') . '(\\s|$)/u', $normalizedTitle) === 1) {
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

    public function resolveHodNpuThreshold(?string $deptCode): int
    {
        $hodSettings = $this->npuSettings()['hod'] ?? [];
        $specialDepartmentCodes = $hodSettings['special_department_codes'] ?? [];

        if ($deptCode && in_array($deptCode, $specialDepartmentCodes, true)) {
            return (int) ($hodSettings['special_points'] ?? 0);
        }

        return (int) ($hodSettings['default_points'] ?? 0);
    }

    public function resolveDeanNpuThreshold(): int
    {
        return (int) ($this->npuSettings()['dean']['points'] ?? 0);
    }

    public function resolveEntityNpuThreshold(string $entityType, ?string $title = null, ?string $deptCode = null): int
    {
        return match ($entityType) {
            self::ENTITY_TYPE_HOD => $this->resolveHodNpuThreshold($deptCode),
            self::ENTITY_TYPE_DEAN => $this->resolveDeanNpuThreshold(),
            default => $this->resolveTeacherNpuThreshold($title),
        };
    }

    private function npuSettings(): array
    {
        if ($this->cachedNpuSettings === null) {
            $this->cachedNpuSettings = app(KpiNpuSettingsService::class)->get();
        }

        return $this->cachedNpuSettings;
    }

    private function normalizeTitleForMatch(string $value): string
    {
        $value = mb_strtolower(trim($value));

        if ($value === '') {
            return '';
        }

        $value = (string) preg_replace('/[^\\p{L}\\p{N}]+/u', ' ', $value);

        return trim((string) preg_replace('/\\s+/u', ' ', $value));
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

    private function countApprovedEntries(Builder $query): int
    {
        return (int) (clone $query)->count('kpi_entries.id');
    }

    /**
     * @param array<string, float> $sectionScores
     * @param array{k1: float, k2: float, k3: float, k4: float, k5: float, k6: float} $coefficientScores
     * @param array<string, mixed> $options
     * @return array<string, mixed>
     */
    private function buildMetadata(array $sectionScores, array $coefficientScores, array $options): array
    {
        return [
            'section_to_coefficient_map' => self::SECTION_COEFFICIENT_MAP,
            'section_scores' => $sectionScores,
            'coefficient_scores' => $coefficientScores,
            'k6_source' => array_key_exists('k6_score', $options) ? 'override' : 'default',
            'hard_check' => $options['hard_check'] ?? null,
            'calculation_context' => $options['metadata'] ?? null,
        ];
    }

    private function eligibility(): KpiParticipantEligibilityService
    {
        if ($this->eligibilityService === null) {
            $this->eligibilityService = app(KpiParticipantEligibilityService::class);
        }

        return $this->eligibilityService;
    }

    private function resolvePeriod(KpiPeriod|int $period): KpiPeriod
    {
        return $period instanceof KpiPeriod
            ? $period
            : KpiPeriod::query()->findOrFail($period);
    }

    private function roundScore(float $value): float
    {
        return round($value, 2);
    }
}

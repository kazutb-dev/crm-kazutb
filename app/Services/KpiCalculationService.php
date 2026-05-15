<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiResult;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class KpiCalculationService
{
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
            $query = $this->approvedEntriesQuery($resolvedPeriod, $entityType)
                ->where('kpi_entries.user_id', $resolvedUser->id);

            $sectionScores = $this->aggregateApprovedScoresBySection($query);
            $approvedEntriesCount = $this->countApprovedEntries($query);
            $coefficientScores = $this->buildCoefficientScores($sectionScores, $options);
            $rankScore = $this->calculateRankScore($coefficientScores);

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
                'metadata' => $this->buildMetadata($sectionScores, $coefficientScores, $options),
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
        return KpiEntry::query()
            ->join('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->where('kpi_entries.kpi_period_id', $period->id)
            ->where('kpi_entries.academic_year_id', $period->academic_year_id)
            ->where('kpi_entries.entity_type', $entityType)
            ->where('kpi_entries.status', KpiEntry::STATUS_APPROVED);
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
            'calculation_context' => $options['metadata'] ?? null,
        ];
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
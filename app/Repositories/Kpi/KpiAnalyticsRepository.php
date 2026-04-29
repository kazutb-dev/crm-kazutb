<?php

namespace App\Repositories\Kpi;

use App\Models\KpiResult;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

class KpiAnalyticsRepository
{
    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     */
    public function totalEntriesCount(array $filters): int
    {
        return (int) $this->baseEntriesQuery($filters)->count('kpi_entries.id');
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     * @return array{draft: int, submitted: int, approved: int}
     */
    public function entryStatusCounters(array $filters): array
    {
        $items = $this->baseEntriesQuery($filters)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'draft' => (int) ($items['draft'] ?? 0),
            'submitted' => (int) ($items['submitted'] ?? 0),
            'approved' => (int) ($items['approved'] ?? 0),
        ];
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     * @return array<int, array<string, mixed>>
     */
    public function topUsers(array $filters, int $limit = 10): array
    {
        return $this->baseResultsQuery($filters)
            ->where('kpi_results.result_type', KpiResult::RESULT_TYPE_USER)
            ->leftJoin('users', 'users.id', '=', 'kpi_results.user_id')
            ->select([
                'kpi_results.id',
                'kpi_results.user_id',
                'users.name as entity_name',
                'kpi_results.approved_entries_count',
                'kpi_results.rank_score as total_score',
                'kpi_results.k1_score',
                'kpi_results.k2_score',
                'kpi_results.k3_score',
                'kpi_results.k4_score',
                'kpi_results.k5_score',
                'kpi_results.k6_score',
            ])
            ->orderByDesc('kpi_results.rank_score')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'user_id' => $row->user_id !== null ? (int) $row->user_id : null,
                'entity_name' => (string) ($row->entity_name ?? 'Неизвестный сотрудник'),
                'approved_entries_count' => (int) $row->approved_entries_count,
                'total_score' => (float) $row->total_score,
                'k1_score' => (float) $row->k1_score,
                'k2_score' => (float) $row->k2_score,
                'k3_score' => (float) $row->k3_score,
                'k4_score' => (float) $row->k4_score,
                'k5_score' => (float) $row->k5_score,
                'k6_score' => (float) $row->k6_score,
            ])
            ->values()
            ->all();
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     * @return array<int, array<string, mixed>>
     */
    public function topDepartments(array $filters, int $limit = 10): array
    {
        return $this->baseResultsQuery($filters)
            ->where('kpi_results.result_type', KpiResult::RESULT_TYPE_DEPARTMENT)
            ->leftJoin('departments', 'departments.id', '=', 'kpi_results.department_id')
            ->select([
                'kpi_results.id',
                'kpi_results.department_id',
                'departments.name as entity_name',
                'kpi_results.approved_entries_count',
                'kpi_results.rank_score as total_score',
            ])
            ->orderByDesc('kpi_results.rank_score')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'department_id' => $row->department_id !== null ? (int) $row->department_id : null,
                'entity_name' => (string) ($row->entity_name ?? 'Неизвестная кафедра'),
                'approved_entries_count' => (int) $row->approved_entries_count,
                'total_score' => (float) $row->total_score,
            ])
            ->values()
            ->all();
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     * @return array<int, array<string, mixed>>
     */
    public function topFaculties(array $filters, int $limit = 10): array
    {
        return $this->baseResultsQuery($filters)
            ->where('kpi_results.result_type', KpiResult::RESULT_TYPE_FACULTY)
            ->leftJoin('faculties', 'faculties.id', '=', 'kpi_results.faculty_id')
            ->select([
                'kpi_results.id',
                'kpi_results.faculty_id',
                'faculties.name as entity_name',
                'kpi_results.approved_entries_count',
                'kpi_results.rank_score as total_score',
            ])
            ->orderByDesc('kpi_results.rank_score')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'faculty_id' => $row->faculty_id !== null ? (int) $row->faculty_id : null,
                'entity_name' => (string) ($row->entity_name ?? 'Неизвестный факультет'),
                'approved_entries_count' => (int) $row->approved_entries_count,
                'total_score' => (float) $row->total_score,
            ])
            ->values()
            ->all();
    }

    /**
     * Eloquent aggregation example: SUM by indicator section from approved entries.
     *
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     * @return array<int, array{section: string, section_score: float}>
     */
    public function sectionAggregationExample(array $filters): array
    {
        return $this->baseEntriesQuery($filters)
            ->where('kpi_entries.status', 'approved')
            ->join('kpi_indicators', 'kpi_indicators.id', '=', 'kpi_entries.indicator_id')
            ->selectRaw('kpi_indicators.section as section')
            ->selectRaw('ROUND(SUM(COALESCE(kpi_entries.manual_points, kpi_entries.calculated_points, 0)), 2) as section_score')
            ->groupBy('kpi_indicators.section')
            ->orderBy('kpi_indicators.section')
            ->get()
            ->map(fn ($row) => [
                'section' => (string) $row->section,
                'section_score' => (float) $row->section_score,
            ])
            ->values()
            ->all();
    }

    public function sectionAggregationSqlExample(): string
    {
        return <<<SQL
SELECT ki.section,
       ROUND(SUM(COALESCE(ke.manual_points, ke.calculated_points, 0)), 2) AS section_score
FROM kpi_entries ke
INNER JOIN kpi_indicators ki ON ki.id = ke.indicator_id
WHERE ke.status = 'approved'
  AND (:academic_year_id IS NULL OR ke.academic_year_id = :academic_year_id)
  AND (:period_id IS NULL OR ke.kpi_period_id = :period_id)
  AND (:entity_type IS NULL OR ke.entity_type = :entity_type)
GROUP BY ki.section
ORDER BY ki.section;
SQL;
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     */
    private function baseResultsQuery(array $filters): Builder
    {
        $query = KpiResult::query();

        if (($filters['academic_year_id'] ?? null) !== null) {
            $query->where('kpi_results.academic_year_id', (int) $filters['academic_year_id']);
        }

        if (($filters['period_id'] ?? null) !== null) {
            $query->where('kpi_results.kpi_period_id', (int) $filters['period_id']);
        }

        if (($filters['entity_type'] ?? null) !== null) {
            $query->where('kpi_results.entity_type', (string) $filters['entity_type']);
        }

        return $query;
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     */
    private function baseEntriesQuery(array $filters): QueryBuilder
    {
        $query = DB::table('kpi_entries');

        if (($filters['academic_year_id'] ?? null) !== null) {
            $query->where('kpi_entries.academic_year_id', (int) $filters['academic_year_id']);
        }

        if (($filters['period_id'] ?? null) !== null) {
            $query->where('kpi_entries.kpi_period_id', (int) $filters['period_id']);
        }

        if (($filters['entity_type'] ?? null) !== null) {
            $query->where('kpi_entries.entity_type', (string) $filters['entity_type']);
        }

        return $query;
    }
}
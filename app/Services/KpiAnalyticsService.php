<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\KpiEntry;
use App\Models\KpiPeriod;
use App\Repositories\Kpi\KpiAnalyticsRepository;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class KpiAnalyticsService
{
    public function __construct(private readonly KpiAnalyticsRepository $repository)
    {
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     * @return array<string, mixed>
     */
    public function buildDashboardPayload(array $filters): array
    {
        $cacheKey = $this->dashboardCacheKey($filters);

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($filters): array {
            $totalEntries = $this->repository->totalEntriesCount($filters);
            $statusCounters = $this->repository->entryStatusCounters($filters);

            return [
                'widgets' => [
                    'total_entries' => $totalEntries,
                    'draft' => $statusCounters['draft'],
                    'submitted' => $statusCounters['submitted'],
                    'approved' => $statusCounters['approved'],
                ],
                'rankings' => [
                    'teachers' => $this->repository->topUsers($filters, 10),
                    'departments' => $this->repository->topDepartments($filters, 10),
                    'faculties' => $this->repository->topFaculties($filters, 10),
                ],
                'filterOptions' => [
                    'academicYears' => AcademicYear::query()
                        ->orderByDesc('start_year')
                        ->get(['id', 'name', 'start_year', 'end_year'])
                        ->unique('id')
                        ->values(),
                    'periods' => KpiPeriod::query()
                        ->orderByDesc('start_date')
                        ->get(['id', 'name', 'stage', 'status', 'academic_year_id']),
                    'entityTypes' => [
                        KpiEntry::ENTITY_TYPE_TEACHER,
                        KpiEntry::ENTITY_TYPE_DEPARTMENT_HEAD,
                        KpiEntry::ENTITY_TYPE_DEAN,
                    ],
                ],
                'filters' => [
                    'academic_year_id' => $filters['academic_year_id'] ?? null,
                    'period_id' => $filters['period_id'] ?? null,
                    'entity_type' => $filters['entity_type'] ?? null,
                ],
                'aggregationExamples' => [
                    'eloquent' => $this->repository->sectionAggregationExample($filters),
                    'sql' => $this->repository->sectionAggregationSqlExample(),
                ],
            ];
        });
    }

    /**
     * Placeholder payload for background export job dispatching.
     *
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     * @return array<string, mixed>
     */
    public function buildExportPayload(string $format, array $filters): array
    {
        return [
            'format' => $format,
            'filters' => $filters,
            'requested_at' => Carbon::now()->toIso8601String(),
            'transport' => 'queue_job',
            'recommended_job' => 'GenerateKpiAnalyticsExportJob',
            'storage_disk' => 'private',
            'storage_path_pattern' => 'exports/kpi-analytics/{format}/{timestamp}.{ext}',
            'notification_channel' => 'database/mail',
        ];
    }

    /**
     * @param array{academic_year_id?: int|null, period_id?: int|null, entity_type?: string|null} $filters
     */
    private function dashboardCacheKey(array $filters): string
    {
        return 'kpi:analytics:' . md5(json_encode([
            'academic_year_id' => $filters['academic_year_id'] ?? null,
            'period_id' => $filters['period_id'] ?? null,
            'entity_type' => $filters['entity_type'] ?? null,
        ]));
    }
}
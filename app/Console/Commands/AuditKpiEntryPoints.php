<?php

namespace App\Console\Commands;

use App\Models\KpiEntry;
use App\Services\KpiEntryPointAuditService;
use Illuminate\Console\Command;

class AuditKpiEntryPoints extends Command
{
    protected $signature = 'kpi:audit-entry-points';

    protected $description = 'Audit KPI entry points and show mismatched indicators';

    public function __construct(private readonly KpiEntryPointAuditService $auditService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $mismatchesByIndicator = [];
        $scanned = 0;
        $mismatches = 0;

        KpiEntry::query()
            ->with(['indicator:id,code,name,base_points'])
            ->orderBy('id')
            ->chunkById(300, function ($entries) use (&$scanned, &$mismatches, &$mismatchesByIndicator): void {
                foreach ($entries as $entry) {
                    $scanned++;

                    if (! $this->auditService->needsUpdate($entry)) {
                        continue;
                    }

                    $mismatches++;

                    $indicator = $entry->indicator;
                    $indicatorKey = (string) ($indicator?->id ?? $entry->indicator_id);

                    if (! isset($mismatchesByIndicator[$indicatorKey])) {
                        $mismatchesByIndicator[$indicatorKey] = [
                            'indicator_id' => $indicator?->id ?? $entry->indicator_id,
                            'code' => $indicator?->code ?? '—',
                            'name' => $indicator?->name ?? '—',
                            'count' => 0,
                            'sample_entries' => [],
                        ];
                    }

                    $mismatchesByIndicator[$indicatorKey]['count']++;

                    if (count($mismatchesByIndicator[$indicatorKey]['sample_entries']) < 5) {
                        $mismatchesByIndicator[$indicatorKey]['sample_entries'][] = [
                            'id' => $entry->id,
                            'stored' => number_format($this->auditService->storedPointsValue($entry), 2, '.', ''),
                            'expected' => number_format((float) $this->auditService->calculateExpectedPoints($entry), 2, '.', ''),
                        ];
                    }
                }
            });

        $this->info(sprintf('Scanned entries: %d', $scanned));
        $this->info(sprintf('Conflicting entries: %d', $mismatches));

        if ($mismatches === 0) {
            $this->info('No KPI point conflicts found.');

            return self::SUCCESS;
        }

        $rows = array_values(array_map(static fn (array $item): array => [
            $item['indicator_id'],
            $item['code'],
            $item['name'],
            $item['count'],
            implode(', ', array_map(static fn (array $sample): string => sprintf('#%d %s=>%s', $sample['id'], $sample['stored'], $sample['expected']), $item['sample_entries'])),
        ], $mismatchesByIndicator));

        $this->table([
            'Indicator ID',
            'Code',
            'Name',
            'Conflicts',
            'Sample entries',
        ], $rows);

        return self::SUCCESS;
    }
}
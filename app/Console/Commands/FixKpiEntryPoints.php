<?php

namespace App\Console\Commands;

use App\Models\KpiEntry;
use App\Services\KpiEntryPointAuditService;
use Illuminate\Console\Command;

class FixKpiEntryPoints extends Command
{
    protected $signature = 'kpi:fix-entry-points';

    protected $description = 'Fix KPI entry points by recalculating stored values from current entry data';

    public function __construct(private readonly KpiEntryPointAuditService $auditService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $scanned = 0;
        $updated = 0;
        $skipped = 0;

        KpiEntry::query()
            ->with(['indicator:id,code,name,base_points'])
            ->orderBy('id')
            ->chunkById(300, function ($entries) use (&$scanned, &$updated, &$skipped): void {
                foreach ($entries as $entry) {
                    $scanned++;

                    if (! $this->auditService->needsUpdate($entry)) {
                        continue;
                    }

                    if ($this->auditService->applyUpdate($entry)) {
                        $updated++;
                        continue;
                    }

                    $skipped++;
                }
            });

        $this->info(sprintf('Scanned entries: %d', $scanned));
        $this->info(sprintf('Updated entries: %d', $updated));

        if ($skipped > 0) {
            $this->warn(sprintf('Skipped entries: %d', $skipped));
        }

        return self::SUCCESS;
    }
}
<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\KpiEntryStructureHydrationService;
use Illuminate\Console\Command;

class BackfillKpiEntryStructure extends Command
{
    protected $signature = 'kpi:backfill-entry-structure
        {--user-id= : Backfill only a specific user ID}
        {--rebind-all : Force all user KPI entries to current faculty/department}
        {--dry-run : Show how many rows would be updated without applying changes}';

    protected $description = 'Fill or rebind KPI entry faculty/department from current user bindings';

    public function handle(): int
    {
        $userId = (int) ($this->option('user-id') ?? 0);
        $dryRun = (bool) $this->option('dry-run');
        $rebindAll = (bool) $this->option('rebind-all');
        $hydrationService = app(KpiEntryStructureHydrationService::class);

        $users = User::query()
            ->when($userId > 0, fn ($q) => $q->whereKey($userId))
            ->where(function ($q): void {
                $q->whereNotNull('faculty_id')
                    ->orWhereNotNull('department_id');
            })
            ->orderBy('id')
            ->get(['id', 'faculty_id', 'department_id']);

        if ($users->isEmpty()) {
            $this->info('No users found for backfill.');
            return self::SUCCESS;
        }

        $updated = 0;
        $skippedConflicts = 0;

        foreach ($users as $user) {
            $result = $hydrationService->hydrateForUser($user, $dryRun, $rebindAll);
            $updated += $result['updated'];
            $skippedConflicts += $result['skipped_conflicts'];
        }

        if ($dryRun) {
            $mode = $rebindAll ? 'rebind-all' : 'fill-missing';
            $this->info("Dry run ({$mode}): {$updated} KPI entries would be updated, conflicts to skip: {$skippedConflicts}.");
            return self::SUCCESS;
        }

        $mode = $rebindAll ? 'rebind-all' : 'fill-missing';
        $this->info("Backfill completed ({$mode}). Updated rows: {$updated}, skipped conflicts: {$skippedConflicts}");

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Models\KpiEntry;
use Illuminate\Console\Command;

class NormalizeKpiEntryValues extends Command
{
    protected $signature = 'kpi:normalize-values
        {--mode=round : Normalization mode: round|floor|ceil}
        {--apply : Apply changes (default is dry-run)}';

    protected $description = 'Normalize KPI plan/fact values to non-negative integers and recalculate auto points';

    public function handle(): int
    {
        $mode = strtolower((string) $this->option('mode'));
        $apply = (bool) $this->option('apply');

        if (! in_array($mode, ['round', 'floor', 'ceil'], true)) {
            $this->error('Invalid --mode. Allowed: round, floor, ceil.');

            return self::FAILURE;
        }

        $rowsScanned = 0;
        $rowsToUpdate = 0;
        $rowsUpdated = 0;

        KpiEntry::query()
            ->with(['indicator:id,base_points'])
            ->where(function ($q): void {
                $q->whereNotNull('plan_value')
                    ->orWhereNotNull('fact_value');
            })
            ->orderBy('id')
            ->chunkById(300, function ($entries) use ($mode, $apply, &$rowsScanned, &$rowsToUpdate, &$rowsUpdated): void {
                foreach ($entries as $entry) {
                    $rowsScanned++;

                    $originalPlan = $entry->plan_value !== null ? (float) $entry->plan_value : null;
                    $originalFact = $entry->fact_value !== null ? (float) $entry->fact_value : null;

                    $normalizedPlan = $this->normalizeValue($originalPlan, $mode);
                    $normalizedFact = $this->normalizeValue($originalFact, $mode);

                    $changed = false;

                    if ($originalPlan !== $normalizedPlan) {
                        $entry->plan_value = $normalizedPlan;
                        $changed = true;
                    }

                    if ($originalFact !== $normalizedFact) {
                        $entry->fact_value = $normalizedFact;
                        $changed = true;
                    }

                    if ($changed && $entry->manual_points === null) {
                        $valueForAuto = $entry->fact_value !== null
                            ? (float) $entry->fact_value
                            : ($entry->plan_value !== null ? (float) $entry->plan_value : null);
                        $basePoints = (float) ($entry->indicator?->base_points ?? 0);
                        $autoPoints = ($valueForAuto !== null && $valueForAuto > 0)
                            ? ($valueForAuto * $basePoints)
                            : 0.0;

                        $entry->calculated_points = number_format($autoPoints, 2, '.', '');
                    }

                    if ($changed) {
                        $rowsToUpdate++;

                        if ($apply) {
                            $entry->save();
                            $rowsUpdated++;
                        }
                    }
                }
            });

        $this->info(sprintf('Scanned rows: %d', $rowsScanned));
        $this->info(sprintf('Rows needing normalization: %d', $rowsToUpdate));

        if (! $apply) {
            $this->warn('Dry-run mode: no changes were written. Re-run with --apply to persist.');

            return self::SUCCESS;
        }

        $this->info(sprintf('Rows updated: %d', $rowsUpdated));

        return self::SUCCESS;
    }

    private function normalizeValue(?float $value, string $mode): ?float
    {
        if ($value === null) {
            return null;
        }

        $normalized = match ($mode) {
            'floor' => (float) floor($value),
            'ceil' => (float) ceil($value),
            default => (float) round($value),
        };

        if ($normalized < 0) {
            $normalized = 0.0;
        }

        return $normalized;
    }
}

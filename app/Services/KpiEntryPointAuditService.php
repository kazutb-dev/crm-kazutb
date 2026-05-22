<?php

namespace App\Services;

use App\Models\KpiEntry;

class KpiEntryPointAuditService
{
    public function calculateExpectedPoints(KpiEntry $entry): ?float
    {
        $quantity = $entry->fact_value !== null
            ? (float) $entry->fact_value
            : ($entry->plan_value !== null ? (float) $entry->plan_value : null);

        if ($quantity === null) {
            return null;
        }

        if ($quantity <= 0) {
            return 0.0;
        }

        $details = is_array($entry->calculation_details) ? $entry->calculation_details : [];
        $ruleKind = (string) ($details['rule_kind'] ?? '');

        if ($ruleKind === 'coauthors') {
            $perSheet = (float) ($details['per_sheet_points'] ?? $entry->indicator?->base_points ?? 0);
            $sheetCount = (float) ($details['sheet_count'] ?? 0);
            $coauthorsCount = max(1.0, (float) ($details['coauthors_count'] ?? 1));

            return round($quantity * $perSheet * $sheetCount / $coauthorsCount, 2);
        }

        if (in_array($ruleKind, ['podium', 'improvement', 'roleSplit', 'quartile', 'optionRate'], true)) {
            $selectionPoints = $details['selection_points'] ?? null;

            if ($selectionPoints === null || $selectionPoints === '') {
                $selectionPoints = $entry->indicator?->base_points ?? 0;
            }

            return round($quantity * (float) $selectionPoints, 2);
        }

        $basePoints = (float) ($entry->indicator?->base_points ?? 0);

        return round($quantity * $basePoints, 2);
    }

    public function storedPointsField(KpiEntry $entry): string
    {
        return $entry->manual_points !== null ? 'manual_points' : 'calculated_points';
    }

    public function storedPointsValue(KpiEntry $entry): float
    {
        if ($entry->manual_points !== null) {
            return round((float) $entry->manual_points, 2);
        }

        if ($entry->calculated_points !== null) {
            return round((float) $entry->calculated_points, 2);
        }

        return 0.0;
    }

    public function needsUpdate(KpiEntry $entry): bool
    {
        $expected = $this->calculateExpectedPoints($entry);

        if ($expected === null) {
            return false;
        }

        return abs($this->storedPointsValue($entry) - $expected) >= 0.01;
    }

    public function applyUpdate(KpiEntry $entry): bool
    {
        $expected = $this->calculateExpectedPoints($entry);

        if ($expected === null) {
            return false;
        }

        if (! $this->needsUpdate($entry)) {
            return false;
        }

        $formatted = number_format($expected, 2, '.', '');

        if ($entry->manual_points !== null) {
            $entry->manual_points = $formatted;
            $entry->calculated_points = '0.00';
        } else {
            $entry->calculated_points = $formatted;
        }

        $entry->save();

        return true;
    }
}
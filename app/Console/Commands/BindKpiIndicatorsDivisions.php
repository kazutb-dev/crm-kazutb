<?php

namespace App\Console\Commands;

use App\Models\KpiIndicator;
use App\Models\KpiStructuralUnit;
use Illuminate\Console\Command;

class BindKpiIndicatorsDivisions extends Command
{
    protected $signature = 'kpi:bind-divisions';

    protected $description = 'Bind KPI indicators to their respective KPI structural units based on section logic';

    public function handle(): int
    {
        $divisions = [
            'УОП' => KpiStructuralUnit::where('code', 'УОП')->value('id'),
            'ЦК' => KpiStructuralUnit::where('code', 'ЦК')->value('id'),
            'УНиВС' => KpiStructuralUnit::where('code', 'УНиВС')->value('id'),
            'ОМОиАМ' => KpiStructuralUnit::where('code', 'ОМОиАМ')->value('id'),
            'УМиФК' => KpiStructuralUnit::where('code', 'УМиФК')->value('id'),
            'ОРиА' => KpiStructuralUnit::where('code', 'ОРиА')->value('id'),
            'ЭФ' => KpiStructuralUnit::where('code', 'ЭФ')->value('id'),
        ];

        $mappings = [
            ['range' => [1, 18], 'division' => $divisions['УОП']],
            ['range' => [19, 20], 'division' => $divisions['ЦК']],
            ['range' => [21, 24], 'division' => $divisions['ОМОиАМ']],
            ['range' => [25, 60], 'division' => $divisions['УНиВС']],
            ['range' => [61, 66], 'division' => $divisions['УМиФК']],
            ['range' => [67, 67], 'division' => $divisions['ЭФ']],
            ['range' => [68, 68], 'division' => $divisions['ОРиА']],
            ['range' => [69, 151], 'division' => $divisions['ЦК']],
        ];

        $updated = 0;
        foreach ($mappings as $map) {
            if (!$map['division']) continue;
            $count = KpiIndicator::whereBetween('id', $map['range'])
                ->update(['checker_structural_unit_id' => $map['division']]);
            $updated += $count;
        }

        $this->info("✓ Updated $updated indicators");
        foreach ($divisions as $name => $id) {
            if (!$id) continue;
            $div = KpiStructuralUnit::find($id);
            $count = KpiIndicator::where('checker_structural_unit_id', $id)->count();
            $this->line("  {$div->name}: $count indicators");
        }

        return Command::SUCCESS;
    }
}

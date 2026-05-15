<?php

namespace App\Console\Commands;

use App\Models\KpiIndicator;
use App\Models\KpiStructuralUnit;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class ImportKpiIndicatorStructuralBindings extends Command
{
    protected $signature = 'kpi:import-structure-bindings
        {file : Absolute or relative path to CSV file}
        {--delimiter=; : CSV delimiter}
        {--code-col=0 : Indicator code column index (0-based)}
        {--submitter-col=3 : Submitter role column index (0-based)}
        {--unit-col=5 : Structural unit column index (0-based)}
        {--reset : Clear all existing checker_structural_unit_id before import}
        {--dry-run : Parse and validate without saving changes}';

    protected $description = 'Import precise KPI indicator bindings to structural units from CSV';

    public function handle(): int
    {
        $filePath = (string) $this->argument('file');
        $delimiter = (string) $this->option('delimiter');
        $codeCol = max(0, (int) $this->option('code-col'));
        $submitterCol = max(0, (int) $this->option('submitter-col'));
        $unitCol = max(0, (int) $this->option('unit-col'));
        $reset = (bool) $this->option('reset');
        $dryRun = (bool) $this->option('dry-run');

        if (!is_file($filePath)) {
            $this->error("File not found: {$filePath}");
            return self::FAILURE;
        }

        $raw = file_get_contents($filePath);
        if ($raw === false) {
            $this->error("Cannot read file: {$filePath}");
            return self::FAILURE;
        }

        $encoding = mb_detect_encoding($raw, ['UTF-8', 'Windows-1251', 'CP1251', 'KOI8-R'], true) ?: 'UTF-8';
        $content = $encoding === 'UTF-8' ? $raw : mb_convert_encoding($raw, 'UTF-8', $encoding);

        if ($dryRun) {
            $this->warn('Dry-run mode enabled: no DB updates will be applied.');
        }

        if ($reset && !$dryRun) {
            $cleared = KpiIndicator::query()->whereNotNull('checker_structural_unit_id')->update(['checker_structural_unit_id' => null]);
            $this->line("Cleared existing bindings: {$cleared}");
        }

        $unitByCode = KpiStructuralUnit::query()
            ->get(['id', 'code', 'name'])
            ->keyBy(fn (KpiStructuralUnit $unit): string => Str::lower(trim((string) $unit->code)));

        $aliases = [
            'омоиам' => 'ОМОиАМ',
            'умоиам' => 'ОМОиАМ',
            'отдел международного образования и академической мобильности' => 'ОМОиАМ',
            'ориа' => 'ОРиА',
            'отдел рейтингов и аккредитации' => 'ОРиА',
            'умифк' => 'УМиФК',
            'управление маркетинга и формирование контингента' => 'УМиФК',
            'уоп' => 'УОП',
            'управление образовательных программ' => 'УОП',
            'унивс' => 'УНиВС',
            'управление науки и внешних связей' => 'УНиВС',
            'цк' => 'ЦК',
            'центр компетенции' => 'ЦК',
            'центр компет.' => 'ЦК',
            'центр карьеры' => 'ЦКАР',
            'оуп' => 'ОУП',
            'отдел управления персоналом' => 'ОУП',
            'ор' => 'ОР',
            'офис регистратора' => 'ОР',
            'уокиа' => 'УОКиА',
            'управление обеспечения качества и аккредитации' => 'УОКиА',
            'виср' => 'ВиСР',
            'воспитательная и социальная работа' => 'ВиСР',
            'проректор по виср' => 'ВиСР',
            'проректор по вр' => 'ВиСР',
            'эндаумент' => 'ЭФ',
            'эндаумент фонд' => 'ЭФ',
            'директор эндаумент фонда' => 'ЭФ',
            'директор эндаумент фонд' => 'ЭФ',
            'омко' => 'ОМОиАМ',

            // Mojibake variants from cp1251/utf8-mixed exports
            '“ЋЏ' => 'УОП',
            'ЋЏ' => 'УОП',
            '“ЌЁ‚‘' => 'УНиВС',
            'ЌЁ‚‘' => 'УНиВС',
            'ЋЊЋЁЂЊ' => 'ОМОиАМ',
            '“ЋЉЁЂ' => 'УОКиА',
            'ЋђЁЂ' => 'ОРиА',
            '“ЊЁ' => 'УМиФК',
            'Ћ“Џ' => 'ОУП',
            '‚Ё‘ђ' => 'ВиСР',
            '–Ґва Є®¬ЇҐв' => 'ЦК',
            '–Љ' => 'ЦК',
            'Є®¬ЇҐв' => 'ЦК',
            'Є амҐал' => 'ЦКАР',
            'ђҐЈЁбва в®а' => 'ОР',
            'ЋЊЉЋ' => 'ОМОиАМ',
            '„ЁаҐЄв®а ќ¤ г¬Ґт д®¤ ' => 'ЭФ',
            '„ЁаҐЄв®а ќ¤ г¬Ґт' => 'ЭФ',
            'ќ¤ г¬Ґт д®¤а' => 'ЭФ',
            'ќ¤аг¬Ґв' => 'ЭФ',
        ];

        $updated = 0;
        $matchedRows = 0;
        $skippedRows = 0;
        $unresolvedUnits = [];
        $unresolvedIndicators = [];

        // Use temp file with fgetcsv for proper CSV parsing with quoted fields
        $tempFile = tempnam(sys_get_temp_dir(), 'kpi_import_');
        if (!file_put_contents($tempFile, $content)) {
            $this->error("Cannot write temp file: {$tempFile}");
            return self::FAILURE;
        }

        $handle = fopen($tempFile, 'r');
        if (!$handle) {
            $this->error("Cannot open temp file: {$tempFile}");
            unlink($tempFile);
            return self::FAILURE;
        }

        $lineNumber = 0;
        while (($cols = fgetcsv($handle, 0, $delimiter)) !== false) {
            $lineNumber++;
            if (!is_array($cols) || empty($cols)) {
                continue;
            }

            $indicatorCode = trim((string) ($cols[$codeCol] ?? ''));
            if (!preg_match('/^\d+(?:\.\d+)+$/', $indicatorCode)) {
                $skippedRows++;
                continue;
            }

            $submitterRaw = trim((string) ($cols[$submitterCol] ?? ''));
            $entityType = $this->resolveEntityType($submitterRaw);

            $unitRaw = trim((string) ($cols[$unitCol] ?? ''));
            $unitIds = $this->resolveUnitIds($unitRaw, $unitByCode->all(), $aliases);

            if (empty($unitIds)) {
                $unresolvedUnits[] = "L{$lineNumber}: {$unitRaw}";
                continue;
            }

            $indicatorQuery = KpiIndicator::query()->where('code', $indicatorCode);
            if ($entityType !== null) {
                $indicatorQuery->where('entity_type', $entityType);
            }
            $indicatorCount = (int) $indicatorQuery->count();

            if ($indicatorCount === 0) {
                $scope = $entityType ?? 'any';
                $unresolvedIndicators[] = "L{$lineNumber}: {$indicatorCode} ({$scope})";
                continue;
            }

            $matchedRows++;

            if (!$dryRun) {
                // Update only indicators in the matched role scope to avoid cross-role overwrites.
                $indicators = $indicatorQuery->get();
                
                foreach ($indicators as $indicator) {
                    // Sync the unit IDs to create/update pivot table entries
                    // This will remove old entries and create new ones
                    $indicator->structuralUnits()->sync($unitIds);
                    $updated += count($unitIds);
                }
            } else {
                $updated += count($unitIds) * $indicatorCount;
            }
        }

        fclose($handle);
        unlink($tempFile);

        $this->info("Processed rows: " . ($matchedRows + $skippedRows));
        $this->info("Matched rows: {$matchedRows}");
        $this->info("Skipped rows: {$skippedRows}");
        $this->info("Updated indicators: {$updated}");

        if (!empty($unresolvedUnits)) {
            $this->warn('Unresolved structural units: ' . count($unresolvedUnits));
            foreach (array_slice($unresolvedUnits, 0, 25) as $item) {
                $this->line(" - {$item}");
            }
        }

        if (!empty($unresolvedIndicators)) {
            $this->warn('Unresolved indicator codes: ' . count($unresolvedIndicators));
            foreach (array_slice($unresolvedIndicators, 0, 25) as $item) {
                $this->line(" - {$item}");
            }
        }

        return self::SUCCESS;
    }

    private function resolveEntityType(string $submitterRaw): ?string
    {
        $value = Str::lower(trim($submitterRaw));
        if ($value === '') {
            return null;
        }

        if (Str::contains($value, 'ппс')) {
            return 'teacher';
        }

        if (Str::contains($value, 'декан')) {
            return 'dean';
        }

        if (Str::contains($value, 'зк') || Str::contains($value, 'зав')) {
            return 'department_head';
        }

        return null;
    }

    /**
     * @param array<string, KpiStructuralUnit> $unitByCode
     * @param array<string, string> $aliases
     * @return array<int>
     */
    private function resolveUnitIds(string $unitRaw, array $unitByCode, array $aliases): array
    {
        $value = Str::lower(trim($unitRaw));
        if ($value === '') {
            return [];
        }

        $unitIds = [];

        // Split by /, comma or semicolon to support multiple structures in one cell.
        $parts = array_filter(
            array_map('trim', preg_split('/\\s*[\\/,;]\\s*/', $value)),
            fn ($p) => $p !== ''
        );

        foreach ($parts as $part) {
            $unitId = $this->resolveSingleUnitId($part, $unitByCode, $aliases);
            if ($unitId !== null) {
                $unitIds[] = $unitId;
            }
        }

        return array_values(array_unique($unitIds));
    }

    /**
     * @param array<string, KpiStructuralUnit> $unitByCode
     * @param array<string, string> $aliases
     */
    private function resolveSingleUnitId(string $unitRaw, array $unitByCode, array $aliases): ?int
    {
        $value = Str::lower(trim($unitRaw));
        if ($value === '') {
            return null;
        }

        // Direct match
        if (isset($unitByCode[$value])) {
            return (int) $unitByCode[$value]->id;
        }

        // Try aliases
        foreach ($aliases as $needle => $unitCode) {
            if ($value === Str::lower($needle)) {
                $normalizedCode = Str::lower($unitCode);
                return isset($unitByCode[$normalizedCode]) ? (int) $unitByCode[$normalizedCode]->id : null;
            }
        }

        // Fallback: substring match in aliases
        foreach ($aliases as $needle => $unitCode) {
            if (Str::contains($value, Str::lower($needle))) {
                $normalizedCode = Str::lower($unitCode);
                return isset($unitByCode[$normalizedCode]) ? (int) $unitByCode[$normalizedCode]->id : null;
            }
        }

        return null;
    }

    /**
     * @param array<string, KpiStructuralUnit> $unitByCode
     * @param array<string, string> $aliases
     */
    private function resolveUnitId(string $unitRaw, array $unitByCode, array $aliases): ?int
    {
        $ids = $this->resolveUnitIds($unitRaw, $unitByCode, $aliases);
        return !empty($ids) ? $ids[0] : null;
    }
}
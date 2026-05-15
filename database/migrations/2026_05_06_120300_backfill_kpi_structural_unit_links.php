<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $units = DB::table('kpi_structural_units')->get(['id', 'code', 'name']);

        $aliases = [
            'ОМОиАМ' => ['омоиам', 'отдел международного образования и академической мобильности'],
            'ОРиА' => ['ориа', 'отдел рейтингов и аккредитации'],
            'УМиФК' => ['умифк', 'управление маркетинга и формирование контингента', 'управление культурой и физической культурой'],
            'УОП' => ['уоп', 'учебно-операционное подразделение', 'управление образовательных программ'],
            'УНиВС' => ['унивс', 'учебно-научное и воспитательное подразделение', 'управление науки и внешних связей'],
            'ЦК' => ['цк', 'ck', 'cc', 'центр компетенции', 'центр компетенций', 'центр компетентности'],
            'ЦКАР' => ['центр карьеры'],
            'ОУП' => ['оуп', 'отдел управления персоналом'],
            'ОР' => ['офис регистратора'],
            'УОКиА' => ['уокиа', 'управление обеспечения качества и аккредитации'],
            'ВиСР' => ['виср', 'воспитательная и социальная работа'],
            'ЭФ' => ['эф', 'эндаумент фонд'],
        ];

        $resolveUnitId = static function (?string $code, ?string $name) use ($units, $aliases): ?int {
            $values = array_filter([
                mb_strtolower(trim((string) $code)),
                mb_strtolower(trim((string) $name)),
            ]);

            foreach ($units as $unit) {
                $unitCode = mb_strtolower(trim((string) $unit->code));
                $unitName = mb_strtolower(trim((string) $unit->name));

                if (in_array($unitCode, $values, true) || in_array($unitName, $values, true)) {
                    return (int) $unit->id;
                }
            }

            foreach ($aliases as $unitCode => $needles) {
                foreach ($values as $value) {
                    foreach ($needles as $needle) {
                        if ($value !== '' && str_contains($value, $needle)) {
                            return (int) ($units->firstWhere('code', $unitCode)->id ?? 0) ?: null;
                        }
                    }
                }
            }

            return null;
        };

        DB::table('kpi_indicators')
            ->join('divisions', 'divisions.id', '=', 'kpi_indicators.checker_division_id')
            ->select('kpi_indicators.id', 'divisions.code as division_code', 'divisions.name as division_name')
            ->orderBy('kpi_indicators.id')
            ->get()
            ->each(function ($row) use ($resolveUnitId): void {
                $unitId = $resolveUnitId($row->division_code ?? null, $row->division_name ?? null);

                if ($unitId !== null) {
                    DB::table('kpi_indicators')
                        ->where('id', $row->id)
                        ->update(['checker_structural_unit_id' => $unitId]);
                }
            });

        DB::table('user_division')
            ->join('divisions', 'divisions.id', '=', 'user_division.division_id')
            ->select('user_division.user_id', 'divisions.code as division_code', 'divisions.name as division_name')
            ->get()
            ->each(function ($row) use ($resolveUnitId): void {
                $unitId = $resolveUnitId($row->division_code ?? null, $row->division_name ?? null);

                if ($unitId !== null) {
                    DB::table('kpi_structural_unit_user')->updateOrInsert(
                        [
                            'user_id' => $row->user_id,
                            'kpi_structural_unit_id' => $unitId,
                        ],
                        [
                            'assigned_at' => now(),
                        ],
                    );
                }
            });
    }

    public function down(): void
    {
        DB::table('kpi_structural_unit_user')->delete();
        DB::table('kpi_indicators')->update(['checker_structural_unit_id' => null]);
    }
};
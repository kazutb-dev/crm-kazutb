<?php

namespace App\Services\Hr;

use App\Models\HrEmploymentContract;
use App\Models\HrHiring;

/**
 * Contract and order numbers are typed by HR; the module suggests the next one from a yearly counter
 * (contract «№{n}», order «{n}-К», counting restarts on 1 January) and warns about a duplicate in the year.
 * Only numbers issued through this module are known: orders of other kinds are numbered outside it.
 */
class HrNumberSuggester
{
    public const CONTRACT = 'contract';

    public const ORDER = 'order';

    public const ORDER_SUFFIX = '-К';

    /** The hiring being edited does not count, so its own number is not «taken». */
    public function next(string $kind, int $year, ?int $exceptHiringId = null): string
    {
        $max = $this->numbersOfYear($kind, $year, $exceptHiringId)
            ->map(fn (?string $number): int => preg_match('/^\s*(\d+)/u', (string) $number, $match) ? (int) $match[1] : 0)
            ->max() ?? 0;

        return $this->format($kind, $max + 1);
    }

    public function format(string $kind, int $number): string
    {
        return $kind === self::ORDER ? $number.self::ORDER_SUFFIX : (string) $number;
    }

    /**
     * Id of another hiring that already uses this number in the same year, if any.
     */
    public function duplicateOf(string $kind, string $value, int $year, ?int $exceptHiringId = null): ?int
    {
        $value = mb_strtoupper(trim($value));
        if ($value === '') {
            return null;
        }

        if ($kind === self::ORDER) {
            return HrHiring::query()
                ->whereYear('order_date', $year)
                ->whereRaw('UPPER(TRIM(order_number)) = ?', [$value])
                ->when($exceptHiringId, fn ($query) => $query->whereKeyNot($exceptHiringId))
                ->value('id');
        }

        return HrEmploymentContract::query()
            ->whereYear('date', $year)
            ->whereRaw('UPPER(TRIM(number)) = ?', [$value])
            ->when($exceptHiringId, fn ($query) => $query->where('hiring_id', '!=', $exceptHiringId))
            ->whereHas('hiring')
            ->value('hiring_id');
    }

    private function numbersOfYear(string $kind, int $year, ?int $exceptHiringId)
    {
        return $kind === self::ORDER
            ? HrHiring::query()->whereYear('order_date', $year)->when($exceptHiringId, fn ($q) => $q->whereKeyNot($exceptHiringId))->pluck('order_number')
            : HrEmploymentContract::query()->whereYear('date', $year)->whereHas('hiring')->when($exceptHiringId, fn ($q) => $q->where('hiring_id', '!=', $exceptHiringId))->pluck('number');
    }
}

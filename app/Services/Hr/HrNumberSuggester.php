<?php

namespace App\Services\Hr;

use App\Models\AppSetting;
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

    /** app_settings key: the last «-К» order number issued outside the module, for one year. */
    public const EXTERNAL_KEY = 'hr_numbering';

    /** The hiring being edited does not count, so its own number is not «taken». */
    public function next(string $kind, int $year, ?int $exceptHiringId = null): string
    {
        $max = $this->numbersOfYear($kind, $year, $exceptHiringId)
            ->map(fn (?string $number): int => preg_match('/^\s*(\d+)/u', (string) $number, $match) ? (int) $match[1] : 0)
            ->max() ?? 0;

        if ($kind === self::ORDER) {
            $max = max($max, $this->externalOrderNumber($year) ?? 0);
        }

        return $this->format($kind, $max + 1);
    }

    /**
     * Personnel orders «-К» of other kinds are numbered outside the module; HR enters the last such number
     * so the hint continues from it. It applies to its year only (the counter restarts on 1 January).
     */
    public function externalOrderNumber(int $year): ?int
    {
        $setting = $this->externalSetting();

        return $setting['year'] === $year ? $setting['last_order_number'] : null;
    }

    /**
     * @return array{year: ?int, last_order_number: ?int}
     */
    public function externalSetting(): array
    {
        $value = AppSetting::query()->where('key', self::EXTERNAL_KEY)->value('value');
        $value = is_array($value) ? $value : [];

        return [
            'year' => isset($value['year']) ? (int) $value['year'] : null,
            'last_order_number' => isset($value['last_order_number']) ? (int) $value['last_order_number'] : null,
        ];
    }

    public function setExternalOrderNumber(int $year, ?int $number): void
    {
        AppSetting::query()->updateOrCreate(['key' => self::EXTERNAL_KEY], ['value' => ['year' => $year, 'last_order_number' => $number]]);
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

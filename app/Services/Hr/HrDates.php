<?php

namespace App\Services\Hr;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Date formats used in the hiring documents (RU / KZ) and the "start + N − 1 day" period rule.
 */
final class HrDates
{
    private const RU_MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    private const KZ_MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];

    /** Ablative (шығыс септік) for «… бастап» in orders. */
    private const KZ_MONTHS_ABLATIVE = ['қаңтардан', 'ақпаннан', 'наурыздан', 'сәуірден', 'мамырдан', 'маусымнан', 'шілдеден', 'тамыздан', 'қыркүйектен', 'қазаннан', 'қарашадан', 'желтоқсаннан'];

    /** «12.05.1994» */
    public static function short(?DateTimeInterface $date): string
    {
        return $date ? $date->format('d.m.Y') : '';
    }

    /** «02 ноября 2026» */
    public static function ru(?DateTimeInterface $date): string
    {
        return $date ? $date->format('d').' '.self::RU_MONTHS_GENITIVE[$date->format('n') - 1].' '.$date->format('Y') : '';
    }

    /** «"30" октября 2026 г.» — document header */
    public static function ruQuoted(?DateTimeInterface $date): string
    {
        return $date ? '«'.$date->format('d').'» '.self::RU_MONTHS_GENITIVE[$date->format('n') - 1].' '.$date->format('Y').' г.' : '';
    }

    /** «2026 жылғы 02 қараша» */
    public static function kz(?DateTimeInterface $date): string
    {
        return $date ? $date->format('Y').' жылғы '.$date->format('d').' '.self::KZ_MONTHS[$date->format('n') - 1] : '';
    }

    /** «2026 жылғы 02 қарашадан» — followed by «бастап» in orders */
    public static function kzFrom(?DateTimeInterface $date): string
    {
        return $date ? $date->format('Y').' жылғы '.$date->format('d').' '.self::KZ_MONTHS_ABLATIVE[$date->format('n') - 1] : '';
    }

    /** «"30" қазан 2026 ж.» — document header */
    public static function kzQuoted(?DateTimeInterface $date): string
    {
        return $date ? '«'.$date->format('d').'» '.self::KZ_MONTHS[$date->format('n') - 1].' '.$date->format('Y').' ж.' : '';
    }

    /**
     * Last day of a period that starts on $start and lasts $months months: start + N months − 1 day
     * (02.11.2026 + 3 months → 01.02.2027). When the target month is too short for that day, the period
     * ends on the month's last day: 31.01 + 1 month → 28.02 (29.02 in a leap year), 31.03 + 1 month → 30.04.
     */
    public static function periodEnd(DateTimeInterface $start, int $months): CarbonImmutable
    {
        $start = CarbonImmutable::instance($start)->startOfDay();
        $target = $start->startOfMonth()->addMonths($months);

        if ($start->day === 1) {
            return $target->subDay();
        }

        return $target->setDay(min($start->day - 1, $target->daysInMonth));
    }
}

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

    /** Ablative and dative endings after the last word of a spoken number. */
    private const KZ_NUMBER_WORD_SUFFIXES = [
        'нөл' => ['ден', 'ге'], 'бір' => ['ден', 'ге'], 'екі' => ['ден', 'ге'], 'үш' => ['тен', 'ке'], 'төрт' => ['тен', 'ке'],
        'бес' => ['тен', 'ке'], 'алты' => ['дан', 'ға'], 'жеті' => ['ден', 'ге'], 'сегіз' => ['ден', 'ге'], 'тоғыз' => ['дан', 'ға'],
        'он' => ['нан', 'ға'], 'жиырма' => ['дан', 'ға'], 'отыз' => ['дан', 'ға'], 'қырық' => ['тан', 'қа'], 'елу' => ['ден', 'ге'],
    ];

    private const KZ_UNIT_WORDS = ['нөл', 'бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз'];

    private const KZ_TEN_WORDS = [1 => 'он', 2 => 'жиырма', 3 => 'отыз', 4 => 'қырық', 5 => 'елу'];

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

    /** «12:30», «9.00» → «12.30», «09.00»; null when the value is not a time of day. */
    public static function normalizeTime(?string $value): ?string
    {
        if (! preg_match('/^\s*(\d{1,2})[.:](\d{2})\s*$/', (string) $value, $match) || (int) $match[1] > 23 || (int) $match[2] > 59) {
            return null;
        }

        return sprintf('%02d.%s', (int) $match[1], $match[2]);
    }

    /** Contract 3.1.3, as in the sample: «с 12.30 до 13.30». */
    public static function breakRu(string $start, string $end): string
    {
        return 'с '.$start.' до '.$end;
    }

    /**
     * Contract 3.1.3, as in the sample: «12.30-дан 13.30-ға дейін». The case endings follow the last spoken
     * word of the time (12.30 → «отыз» → -дан / -ға, 13.15 → «бес» → -тен / -ке).
     */
    public static function breakKz(string $start, string $end): string
    {
        return $start.'-'.self::kzTimeSuffixes($start)[0].' '.$end.'-'.self::kzTimeSuffixes($end)[1].' дейін';
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

    /**
     * @return array{string, string} ablative and dative ending for «HH.MM»
     */
    private static function kzTimeSuffixes(string $time): array
    {
        [$hours, $minutes] = array_map('intval', explode('.', $time) + [1 => '0']);
        $number = $minutes > 0 ? $minutes : $hours;
        $word = $number % 10 !== 0 || $number === 0
            ? self::KZ_UNIT_WORDS[$number % 10]
            : self::KZ_TEN_WORDS[intdiv($number, 10)];

        return self::KZ_NUMBER_WORD_SUFFIXES[$word];
    }
}

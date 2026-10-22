<?php

namespace App\Services\Hr;

/**
 * Whole numbers in words for contracts and orders: 385000 → «триста восемьдесят пять тысяч» / «үш жүз сексен бес мың».
 */
final class NumberToWords
{
    private const RU_UNITS = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];

    private const RU_UNITS_FEMININE = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];

    private const RU_TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];

    private const RU_TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];

    private const RU_HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    /** [scale, feminine, one, few, many] from the largest group down. */
    private const RU_SCALES = [
        [1_000_000_000, false, 'миллиард', 'миллиарда', 'миллиардов'],
        [1_000_000, false, 'миллион', 'миллиона', 'миллионов'],
        [1_000, true, 'тысяча', 'тысячи', 'тысяч'],
    ];

    private const KZ_UNITS = ['', 'бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз'];

    private const KZ_TENS = ['', 'он', 'жиырма', 'отыз', 'қырық', 'елу', 'алпыс', 'жетпіс', 'сексен', 'тоқсан'];

    private const KZ_SCALES = [
        [1_000_000_000, 'миллиард'],
        [1_000_000, 'миллион'],
        [1_000, 'мың'],
    ];

    public static function ru(int $number): string
    {
        if ($number === 0) {
            return 'ноль';
        }

        $parts = [];
        foreach (self::RU_SCALES as [$scale, $feminine, $one, $few, $many]) {
            $group = intdiv($number, $scale) % 1000;
            if ($group > 0) {
                $parts[] = self::ruTriplet($group, $feminine).' '.self::ruPlural($group, $one, $few, $many);
            }
        }
        if ($number % 1000 > 0) {
            $parts[] = self::ruTriplet($number % 1000, false);
        }

        return implode(' ', $parts);
    }

    public static function kz(int $number): string
    {
        if ($number === 0) {
            return 'нөл';
        }

        $parts = [];
        foreach (self::KZ_SCALES as [$scale, $word]) {
            $group = intdiv($number, $scale) % 1000;
            if ($group > 0) {
                $parts[] = self::kzTriplet($group).' '.$word;
            }
        }
        if ($number % 1000 > 0) {
            $parts[] = self::kzTriplet($number % 1000);
        }

        return implode(' ', $parts);
    }

    /**
     * 385000 → «385 000» (thin groups as in the sample contract).
     */
    public static function grouped(int $number): string
    {
        return number_format($number, 0, '', ' ');
    }

    private static function ruTriplet(int $value, bool $feminine): string
    {
        $words = [self::RU_HUNDREDS[intdiv($value, 100)]];
        $rest = $value % 100;
        if ($rest >= 10 && $rest < 20) {
            $words[] = self::RU_TEENS[$rest - 10];
        } else {
            $words[] = self::RU_TENS[intdiv($rest, 10)];
            $words[] = ($feminine ? self::RU_UNITS_FEMININE : self::RU_UNITS)[$rest % 10];
        }

        return implode(' ', array_filter($words));
    }

    private static function ruPlural(int $value, string $one, string $few, string $many): string
    {
        $lastTwo = $value % 100;
        if ($lastTwo >= 11 && $lastTwo <= 14) {
            return $many;
        }

        return match ($value % 10) {
            1 => $one,
            2, 3, 4 => $few,
            default => $many,
        };
    }

    private static function kzTriplet(int $value): string
    {
        $hundreds = intdiv($value, 100);
        $words = [];
        if ($hundreds > 0) {
            $words[] = $hundreds === 1 ? 'жүз' : self::KZ_UNITS[$hundreds].' жүз';
        }
        $words[] = self::KZ_TENS[intdiv($value % 100, 10)];
        $words[] = self::KZ_UNITS[$value % 10];

        return implode(' ', array_filter($words));
    }
}

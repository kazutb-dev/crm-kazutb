<?php

namespace App\Services\Hr;

use Carbon\CarbonImmutable;

/**
 * Kazakhstan individual identification number (ИИН): YYMMDD + century/gender digit + serial + check digit.
 */
final class Iin
{
    public const GENDER_MALE = 'm';

    public const GENDER_FEMALE = 'f';

    private const WEIGHTS_FIRST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    private const WEIGHTS_SECOND = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

    private function __construct(
        public readonly bool $valid,
        public readonly ?string $error,
        public readonly ?CarbonImmutable $birthDate = null,
        public readonly ?string $gender = null,
    ) {}

    public static function parse(?string $value): self
    {
        $value = trim((string) $value);

        if (! preg_match('/^\d{12}$/', $value)) {
            $digits = strlen(preg_replace('/\D/', '', $value));

            return new self(false, $value === '' ? 'ИИН не указан' : "Введено {$digits} из 12 цифр");
        }

        $check = self::checkDigit(substr($value, 0, 11));
        if ($check === null || $check !== (int) $value[11]) {
            return new self(false, 'Контрольная цифра не сходится — проверьте ИИН');
        }

        $centuryGender = (int) $value[6];
        if ($centuryGender < 1 || $centuryGender > 6) {
            return new self(false, '7-я цифра ИИН должна быть от 1 до 6');
        }

        $century = [1 => 1800, 2 => 1800, 3 => 1900, 4 => 1900, 5 => 2000, 6 => 2000][$centuryGender];
        $year = $century + (int) substr($value, 0, 2);
        $month = (int) substr($value, 2, 2);
        $day = (int) substr($value, 4, 2);

        if (! checkdate($month, $day, $year)) {
            return new self(false, 'В ИИН некорректная дата рождения');
        }

        return new self(
            true,
            null,
            CarbonImmutable::create($year, $month, $day),
            $centuryGender % 2 === 1 ? self::GENDER_MALE : self::GENDER_FEMALE,
        );
    }

    /**
     * Check digit for the first 11 digits; null when both weight rounds give 10 (such an IIN is never issued).
     */
    public static function checkDigit(string $first11): ?int
    {
        $digits = array_map('intval', str_split($first11));

        $sum = static fn (array $weights): int => array_sum(array_map(static fn (int $w, int $d): int => $w * $d, $weights, $digits));

        $check = $sum(self::WEIGHTS_FIRST) % 11;
        if ($check === 10) {
            $check = $sum(self::WEIGHTS_SECOND) % 11;
            if ($check === 10) {
                return null;
            }
        }

        return $check;
    }

    /**
     * "940512400015" → "9405******15" for lists.
     */
    public static function mask(?string $value): string
    {
        $value = (string) $value;

        return strlen($value) === 12 ? substr($value, 0, 4).str_repeat('*', 6).substr($value, -2) : '';
    }
}

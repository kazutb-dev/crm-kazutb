<?php

namespace Tests\Unit\Hr;

use App\Services\Hr\NumberToWords;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class NumberToWordsTest extends TestCase
{
    /**
     * @return array<string, array{int, string, string}>
     */
    public static function numbers(): array
    {
        return [
            'salary 385 000' => [385000, 'триста восемьдесят пять тысяч', 'үш жүз сексен бес мың'],
            'salary 100 000' => [100000, 'сто тысяч', 'жүз мың'],
            'one thousand' => [1000, 'одна тысяча', 'бір мың'],
            'vacation 56' => [56, 'пятьдесят шесть', 'елу алты'],
            'vacation 24' => [24, 'двадцать четыре', 'жиырма төрт'],
            'zero' => [0, 'ноль', 'нөл'],
            'eleven' => [11, 'одиннадцать', 'он бір'],
            'twenty one' => [21, 'двадцать один', 'жиырма бір'],
            'million and thousand' => [1001000, 'один миллион одна тысяча', 'бір миллион бір мың'],
            'mixed' => [2345678, 'два миллиона триста сорок пять тысяч шестьсот семьдесят восемь', 'екі миллион үш жүз қырық бес мың алты жүз жетпіс сегіз'],
            'teens of thousands' => [12000, 'двенадцать тысяч', 'он екі мың'],
            'two thousand' => [2000, 'две тысячи', 'екі мың'],
        ];
    }

    #[DataProvider('numbers')]
    public function test_numbers_in_words(int $number, string $ru, string $kz): void
    {
        $this->assertSame($ru, NumberToWords::ru($number));
        $this->assertSame($kz, NumberToWords::kz($number));
    }

    public function test_grouped_digits(): void
    {
        $this->assertSame('385 000', NumberToWords::grouped(385000));
        $this->assertSame('1 001 000', NumberToWords::grouped(1001000));
        $this->assertSame('56', NumberToWords::grouped(56));
    }
}

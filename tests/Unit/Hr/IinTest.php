<?php

namespace Tests\Unit\Hr;

use App\Services\Hr\Iin;
use PHPUnit\Framework\TestCase;

class IinTest extends TestCase
{
    public function test_valid_iin_gives_birth_date_and_gender(): void
    {
        $iin = Iin::parse('940512400015');

        $this->assertTrue($iin->valid);
        $this->assertSame('1994-05-12', $iin->birthDate->toDateString());
        $this->assertSame(Iin::GENDER_FEMALE, $iin->gender);
    }

    public function test_odd_seventh_digit_means_male_and_selects_the_century(): void
    {
        $iin = Iin::parse($this->iinFor('0503105'));

        $this->assertTrue($iin->valid);
        $this->assertSame('2005-03-10', $iin->birthDate->toDateString());
        $this->assertSame(Iin::GENDER_MALE, $iin->gender);
    }

    public function test_changed_last_digit_is_rejected(): void
    {
        $iin = Iin::parse('940512400016');

        $this->assertFalse($iin->valid);
        $this->assertSame('Контрольная цифра не сходится — проверьте ИИН', $iin->error);
    }

    public function test_second_weight_round_is_used_when_the_first_gives_ten(): void
    {
        // Weights 1..11 give 10 for these digits, weights 3..11,1,2 give the real check digit.
        $first11 = '00000000010';
        $this->assertSame(10, array_sum(array_map(fn ($w, $d) => $w * $d, range(1, 11), str_split($first11))) % 11);

        $this->assertSame(1, Iin::checkDigit($first11));
    }

    public function test_impossible_date_is_rejected(): void
    {
        $iin = Iin::parse($this->iinFor('9402304'));

        $this->assertFalse($iin->valid);
        $this->assertSame('В ИИН некорректная дата рождения', $iin->error);
    }

    public function test_seventh_digit_outside_one_to_six_is_rejected(): void
    {
        foreach (['0', '7', '9'] as $digit) {
            $iin = Iin::parse($this->iinFor('940512'.$digit));

            $this->assertFalse($iin->valid, "7th digit {$digit}");
            $this->assertSame('7-я цифра ИИН должна быть от 1 до 6', $iin->error);
        }
    }

    public function test_wrong_length_reports_the_digit_count(): void
    {
        $this->assertSame('Введено 5 из 12 цифр', Iin::parse('94051')->error);
        $this->assertSame('ИИН не указан', Iin::parse('')->error);
    }

    public function test_mask_keeps_the_first_four_and_last_two_digits(): void
    {
        $this->assertSame('9405******15', Iin::mask('940512400015'));
        $this->assertSame('', Iin::mask(null));
    }

    /** A well-formed IIN for the given date + century digit: the first serial number that has a check digit. */
    private function iinFor(string $prefix7): string
    {
        for ($serial = 1; $serial < 10000; $serial++) {
            $first11 = $prefix7.str_pad((string) $serial, 4, '0', STR_PAD_LEFT);
            $check = Iin::checkDigit($first11);
            if ($check !== null) {
                return $first11.$check;
            }
        }

        $this->fail("no IIN for {$prefix7}");
    }
}

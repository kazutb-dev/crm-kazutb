<?php

namespace Tests\Unit\Hr;

use App\Services\Hr\HrDates;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

class HrDatesTest extends TestCase
{
    public function test_contract_of_one_year_ends_the_day_before_the_anniversary(): void
    {
        $this->assertSame('2027-11-01', HrDates::periodEnd(CarbonImmutable::parse('2026-11-02'), 12)->toDateString());
    }

    public function test_three_month_probation(): void
    {
        $this->assertSame('2027-02-01', HrDates::periodEnd(CarbonImmutable::parse('2026-11-02'), 3)->toDateString());
    }

    public function test_period_crossing_a_short_month_ends_on_its_last_day(): void
    {
        $this->assertSame('2027-02-28', HrDates::periodEnd(CarbonImmutable::parse('2027-01-31'), 1)->toDateString());
        $this->assertSame('2028-02-29', HrDates::periodEnd(CarbonImmutable::parse('2028-01-31'), 1)->toDateString());
        $this->assertSame('2027-04-30', HrDates::periodEnd(CarbonImmutable::parse('2027-03-31'), 1)->toDateString());
    }

    public function test_period_starting_on_the_first_covers_whole_months(): void
    {
        $this->assertSame('2027-03-31', HrDates::periodEnd(CarbonImmutable::parse('2027-03-01'), 1)->toDateString());
        $this->assertSame('2027-12-31', HrDates::periodEnd(CarbonImmutable::parse('2027-01-01'), 12)->toDateString());
    }

    public function test_document_date_formats(): void
    {
        $date = CarbonImmutable::parse('2026-11-02');
        $header = CarbonImmutable::parse('2026-10-30');

        $this->assertSame('02.11.2026', HrDates::short($date));
        $this->assertSame('02 ноября 2026', HrDates::ru($date));
        $this->assertSame('«30» октября 2026 г.', HrDates::ruQuoted($header));
        $this->assertSame('2026 жылғы 02 қараша', HrDates::kz($date));
        $this->assertSame('«30» қазан 2026 ж.', HrDates::kzQuoted($header));
        $this->assertSame('2026 жылғы 02 қарашадан', HrDates::kzFrom($date));
        $this->assertSame('', HrDates::ru(null));
    }

    public function test_break_time_as_in_the_sample_and_kazakh_endings_by_the_last_word(): void
    {
        $this->assertSame('с 12.30 до 13.30', HrDates::breakRu('12.30', '13.30'));
        $this->assertSame('12.30-дан 13.30-ға дейін', HrDates::breakKz('12.30', '13.30'));
        $this->assertSame('13.00-тен 14.00-ке дейін', HrDates::breakKz('13.00', '14.00'));
        $this->assertSame('11.40-тан 12.20-ға дейін', HrDates::breakKz('11.40', '12.20'));
        $this->assertSame('12.10-нан 12.50-ге дейін', HrDates::breakKz('12.10', '12.50'));
        $this->assertSame('12.45-тен 13.15-ке дейін', HrDates::breakKz('12.45', '13.15'));
    }

    public function test_time_is_normalized(): void
    {
        $this->assertSame('09.05', HrDates::normalizeTime('9:05'));
        $this->assertSame('12.30', HrDates::normalizeTime(' 12.30 '));
        $this->assertNull(HrDates::normalizeTime('24.00'));
        $this->assertNull(HrDates::normalizeTime('12-30'));
        $this->assertNull(HrDates::normalizeTime(null));
    }

    public function test_kazakh_ablative_months(): void
    {
        $expected = ['қаңтардан', 'ақпаннан', 'наурыздан', 'сәуірден', 'мамырдан', 'маусымнан', 'шілдеден', 'тамыздан', 'қыркүйектен', 'қазаннан', 'қарашадан', 'желтоқсаннан'];

        foreach ($expected as $i => $month) {
            $this->assertSame('2026 жылғы 05 '.$month, HrDates::kzFrom(CarbonImmutable::create(2026, $i + 1, 5)));
        }
    }
}

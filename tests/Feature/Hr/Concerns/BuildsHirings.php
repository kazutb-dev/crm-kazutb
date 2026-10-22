<?php

namespace Tests\Feature\Hr\Concerns;

use App\Models\HrEmployee;
use App\Models\HrEmploymentContract;
use App\Models\HrHiring;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Models\User;
use App\Services\Hr\Docx\HrTemplateProcessor;
use ZipArchive;

trait BuildsHirings
{
    protected function hrUser(): User
    {
        return User::factory()->create(['name' => 'Тасполтаева Мария Руслановна', 'role' => 'hr']);
    }

    /**
     * The reference hiring of the HR spec: senior lecturer of the IT chair, 1 year, 3 months probation, PPS, main job.
     *
     * @param  array<string, mixed>  $employee
     * @param  array<string, mixed>  $hiring
     * @param  array<string, mixed>  $contract
     */
    protected function makeHiring(array $employee = [], array $hiring = [], array $contract = []): HrHiring
    {
        $faculty = OrgUnit::query()->firstOrCreate(['code' => 'T_FAC_IT'], [
            'name' => 'Факультет инжиниринга и информационных технологий',
            'unit_type' => OrgUnit::TYPE_FACULTY,
            'name_ru_gen' => 'факультета инжиниринга и информационных технологий',
            'name_kz_gen' => 'Инжиниринг және ақпараттық технологиялар факультетінің',
            'case_forms_verified_at' => now(),
        ]);
        $chair = OrgUnit::query()->firstOrCreate(['code' => 'T_CHAIR_IT'], [
            'name' => 'Кафедра «Информационные технологии»',
            'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR,
            'parent_id' => $faculty->id,
            'name_ru_gen' => 'кафедры «Информационные технологии»',
            'name_kz_gen' => '«Ақпараттық технологиялар» кафедрасының',
            'case_forms_verified_at' => now(),
        ]);
        $position = Position::query()->firstOrCreate(['name' => 'Старший преподаватель'], [
            'staff_category' => Position::CATEGORY_PPS,
            'name_ru_gen' => 'старшего преподавателя',
            'name_kz_poss' => 'аға оқытушысы',
            'case_forms_verified_at' => now(),
        ]);

        $person = HrEmployee::query()->create(array_merge([
            'last_name' => 'Айтмаганбетов',
            'first_name' => 'Асет',
            'middle_name' => 'Лайыкович',
            'iin' => '940512300019',
            'birth_date' => '1994-05-12',
            'gender' => 'm',
            'id_card_number' => '052345678',
            'id_card_issued_at' => '2020-03-15',
            'id_card_issuer' => HrEmployee::ISSUER_MVD,
            'city' => 'Астана',
            'street' => 'Кенесары',
            'house' => '40',
            'apartment' => '15',
            'phone' => '+7 701 123 45 67',
            'marital_status' => 'married',
            'military_status' => 'liable',
        ], $employee));

        $record = HrHiring::query()->create(array_merge([
            'employee_id' => $person->id,
            'staff_category' => Position::CATEGORY_PPS,
            'top_unit_id' => $faculty->id,
            'sub_unit_id' => $chair->id,
            'position_id' => $position->id,
            'start_date' => '2026-11-02',
            'probation_months' => 3,
            'order_number' => '412-К',
            'order_date' => '2026-10-30',
        ], $hiring));

        HrEmploymentContract::query()->create(array_merge([
            'hiring_id' => $record->id,
            'number' => '412',
            'date' => '2026-10-30',
            'term' => '1y',
            'salary' => 385000,
            'schedule' => HrEmploymentContract::SCHEDULE_PPS,
            'employment' => HrEmploymentContract::EMPLOYMENT_MAIN,
            'vacation_days' => 56,
        ], $contract));

        return $record->fresh();
    }

    /**
     * Text of every paragraph, prefixed with its place: KZ/RU column of the main table, "  " for nested tables.
     */
    protected function docxText(string $path): string
    {
        $zip = new ZipArchive;
        $zip->open($path);
        [, $xpath] = HrTemplateProcessor::load($zip->getFromName('word/document.xml'));
        $zip->close();

        $lines = [];
        foreach ($xpath->query('//w:body//w:p') as $paragraph) {
            $cells = $xpath->query('ancestor::w:tc', $paragraph);
            $place = '--';
            if ($cells->length > 0) {
                $place = $xpath->query('preceding-sibling::w:tc', $cells->item(0))->length ? 'RU' : 'KZ';
                $place .= str_repeat(' ', 2 * ($cells->length - 1));
            }
            $text = '';
            foreach ($xpath->query('.//w:t|.//w:r/w:tab|.//w:r/w:br', $paragraph) as $node) {
                $text .= match ($node->localName) {
                    'tab' => "\t",
                    'br' => ' / ',
                    default => $node->textContent,
                };
            }
            $lines[] = rtrim($place.' | '.$text);
        }

        return implode("\n", $lines)."\n";
    }
}

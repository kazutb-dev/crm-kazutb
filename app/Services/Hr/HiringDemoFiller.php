<?php

namespace App\Services\Hr;

use App\Models\HrEmployee;
use App\Models\HrEmploymentContract;
use App\Models\HrHiring;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * «Демо-данные» for administrators: fills a draft with a made-up employee and conditions, so the three
 * documents can be checked in a minute. Units and the position come from the real catalog (entries with case
 * forms); the contract and order numbers are «ДЕМО» / «ДЕМО-К», so a demo document cannot pass for a real one
 * and the yearly numbering is not used up. Everything goes through HiringService::update like the form does.
 */
class HiringDemoFiller
{
    public const CONTRACT_NUMBER = 'ДЕМО';

    public const ORDER_NUMBER = 'ДЕМО-К';

    public function __construct(
        private readonly HiringService $hirings,
        private readonly HrAuditLogger $audit,
    ) {}

    public function fill(HrHiring $hiring, User $user): HrHiring
    {
        [$top, $sub] = $this->units();
        $position = $this->position();
        $category = $position['category'];
        $defaults = HrHiring::CATEGORY_DEFAULTS[$category];
        $iin = $this->freeIin();
        $today = now()->startOfDay();

        $this->hirings->update($hiring, [
            'employee' => [
                'last_name' => 'Тестова',
                'first_name' => 'Айгерим',
                'middle_name' => 'Сериковна',
                'iin' => $iin,
                'birth_date' => Iin::parse($iin)->birthDate?->toDateString(),
                'gender' => Iin::GENDER_FEMALE,
                'citizenship' => HrEmployee::CITIZENSHIP_KZ,
                'id_card_number' => '0'.random_int(10000000, 99999999),
                'id_card_issued_at' => $today->copy()->subYears(3)->toDateString(),
                'id_card_issuer' => HrEmployee::ISSUER_MVD,
                'city' => 'Астана',
                'street' => 'пр. Кабанбай батыра',
                'house' => '12',
                'apartment' => '45',
                'phone' => '+7 701 000 00 00',
                'marital_status' => 'married',
                'military_status' => 'not_liable',
                'is_pensioner' => false,
                'disability' => 'none',
                'is_student' => false,
                'is_large_family' => false,
                'children' => [['id' => null, 'full_name' => 'Тестов Арман Нурланович', 'birth_date' => '2018-04-12']],
                'educations' => [[
                    'id' => null,
                    'level' => 'master',
                    'institution' => 'Казахский университет технологии и бизнеса',
                    'graduation_year' => '2015',
                    'specialty' => 'Информационные системы',
                    'diploma_number' => 'ЖБ-М 0001234',
                ]],
            ],
            'hiring' => [
                'staff_category' => $category,
                'top_unit' => $top,
                'sub_unit' => $sub,
                'position' => $position['input'],
                'start_date' => $today->copy()->addWeek()->toDateString(),
                'probation_months' => 3,
                'replaces' => ['user_id' => null, 'employee_id' => null, 'full_name' => null],
                'order_number' => self::ORDER_NUMBER,
                'order_date' => $today->toDateString(),
                'fio_accusative_manual' => false,
            ],
            'contract' => [
                'number' => self::CONTRACT_NUMBER,
                'date' => $today->toDateString(),
                'term' => '1y',
                'salary' => 385000,
                'vacation_days' => $defaults['vacation_days'],
                'schedule' => $defaults['schedule'],
                'employment' => HrEmploymentContract::EMPLOYMENT_MAIN,
            ],
        ], $user);

        $this->photo($hiring);
        $this->audit->hiring(HrAuditLogger::HIRING_UPDATED, $hiring, 'Приём #'.$hiring->id.' заполнен демо-данными', ['demo' => true], $user);

        return $hiring->refresh();
    }

    /**
     * A chair and its faculty from the catalog, both with RU and KZ case forms; without such a pair a typed-in
     * one (not added to the catalog), so both unit lines of the documents are always shown.
     *
     * @return array{array<string, mixed>, array<string, mixed>}
     */
    private function units(): array
    {
        $withForms = fn ($query) => $query->whereNotNull('name_ru_gen')->whereNotNull('name_kz_gen');
        $sub = OrgUnit::query()->tap($withForms)->where('unit_type', OrgUnit::TYPE_ACADEMIC_CHAIR)
            ->whereHas('parent', $withForms)->orderBy('id')->first();

        if ($sub === null) {
            return [
                ['id' => null, 'name_ru' => 'Факультет информационных технологий', 'name_ru_gen' => 'факультета информационных технологий', 'name_kz_gen' => 'Ақпараттық технологиялар факультетінің', 'add_to_catalog' => false],
                ['id' => null, 'name_ru' => 'Кафедра «Информационные системы»', 'name_ru_gen' => 'кафедры «Информационные системы»', 'name_kz_gen' => '«Ақпараттық жүйелер» кафедрасының', 'add_to_catalog' => false],
            ];
        }

        $input = fn (OrgUnit $unit) => ['id' => $unit->id, 'name_ru' => $unit->name, 'name_ru_gen' => $unit->name_ru_gen, 'name_kz_gen' => $unit->name_kz_gen, 'add_to_catalog' => false];

        return [$input($sub->parent), $input($sub)];
    }

    /**
     * A teaching (ППС) position with case forms from the catalog, or a typed-in senior lecturer.
     *
     * @return array{category: string, input: array<string, mixed>}
     */
    private function position(): array
    {
        $position = Position::query()->where('staff_category', Position::CATEGORY_PPS)
            ->whereNotNull('name_ru_gen')->whereNotNull('name_kz_poss')->orderBy('id')->first();

        if ($position === null) {
            return ['category' => Position::CATEGORY_PPS, 'input' => ['id' => null, 'name_ru' => 'Старший преподаватель', 'name_ru_gen' => 'старшего преподавателя', 'name_kz_poss' => 'аға оқытушысы', 'add_to_catalog' => false]];
        }

        return ['category' => Position::CATEGORY_PPS, 'input' => [
            'id' => $position->id,
            'name_ru' => $position->name,
            'name_ru_gen' => $position->name_ru_gen,
            'name_kz_poss' => $position->name_kz_poss,
            'add_to_catalog' => false,
        ]];
    }

    /** A valid IIN (woman born 1985–1999) that no employee has yet. */
    private function freeIin(): string
    {
        do {
            $birth = now()->setDate(random_int(1985, 1999), random_int(1, 12), random_int(1, 28));
            $first11 = $birth->format('ymd').'4'.str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
            $check = Iin::checkDigit($first11);
            $iin = $check === null ? null : $first11.$check;
        } while ($iin === null || HrEmployee::query()->where('iin_hash', HrEmployee::hashIin($iin))->exists());

        return $iin;
    }

    /** A grey 3×4 placeholder with a silhouette, so the personal card has a photo. */
    private function photo(HrHiring $hiring): void
    {
        if (! function_exists('imagecreatetruecolor')) {
            return;
        }

        $image = imagecreatetruecolor(300, 400);
        imagefill($image, 0, 0, imagecolorallocate($image, 226, 232, 240));
        $figure = imagecolorallocate($image, 148, 163, 184);
        imagefilledellipse($image, 150, 150, 130, 150, $figure);
        imagefilledellipse($image, 150, 400, 260, 220, $figure);
        ob_start();
        imagepng($image);
        $png = (string) ob_get_clean();
        imagedestroy($image);

        $employee = $hiring->employee;
        $disk = Storage::disk(config('hr.disk'));
        $old = $employee->photo_path;
        $path = "hr/employees/{$employee->id}/photo-demo-".Str::random(12).'.png';
        $disk->put($path, $png);
        $employee->forceFill(['photo_path' => $path])->save();
        if ($old && $old !== $path) {
            $disk->delete($old);
        }
    }
}

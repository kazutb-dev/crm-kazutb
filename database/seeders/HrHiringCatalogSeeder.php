<?php

namespace Database\Seeders;

use App\Models\AppSetting;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Services\Hr\EmployerSettings;
use App\Services\Hr\RussianInflector;
use Illuminate\Database\Seeder;

/**
 * Starting data for the hiring module. Idempotent: only empty forms are filled and missing rows added.
 * Everything here is "not verified" — the HR department confirms the case forms in the admin screens.
 */
class HrHiringCatalogSeeder extends Seeder
{
    /** Units that are not hiring destinations (the university itself, governing bodies, vice-rector branches). */
    private const SKIPPED_UNIT_TYPES = [OrgUnit::TYPE_UNIVERSITY, OrgUnit::TYPE_GOVERNANCE, OrgUnit::TYPE_RECTORATE];

    /** Genitive of the existing teaching positions (written out: abbreviations and compounds beat the rules). */
    private const PPS_GENITIVE = [
        'Декан' => 'декана',
        'Зав. кафедрой' => 'заведующего кафедрой',
        'Ассоциированный профессор' => 'ассоциированного профессора',
        'И.о. ассоциированного профессора' => 'и.о. ассоциированного профессора',
        'Профессор' => 'профессора',
        'Профессор-исследователь' => 'профессора-исследователя',
        'И.о. профессора' => 'и.о. профессора',
        'Сеньор-лектор' => 'сеньор-лектора',
        'Ассистент профессора' => 'ассистента профессора',
        'Лектор' => 'лектора',
        'Ассистент' => 'ассистента',
    ];

    /** Administrative and support positions from the prototype: [name, category, RU genitive, KZ possessive]. */
    private const AUP_UVP_POSITIONS = [
        ['Директор', 'aup', 'директора', 'директоры'],
        ['Руководитель', 'aup', 'руководителя', 'басшысы'],
        ['Начальник', 'aup', 'начальника', 'бастығы'],
        ['Главный специалист', 'aup', 'главного специалиста', 'бас маманы'],
        ['Ведущий специалист', 'aup', 'ведущего специалиста', 'жетекші маманы'],
        ['Инженер-программист', 'aup', 'инженера-программиста', 'инженер-бағдарламашысы'],
        ['Менеджер', 'aup', 'менеджера', 'менеджері'],
        ['Лаборант', 'uvp', 'лаборанта', 'зертханашысы'],
        ['Методист', 'uvp', 'методиста', 'әдіскері'],
        ['Эдвайзер', 'uvp', 'эдвайзера', 'эдвайзері'],
    ];

    /** Employer requisites as printed in the sample contract (section 11 and the preamble). */
    private const EMPLOYER = [
        'name_ru' => 'АО «Казахский университет технологии и бизнеса имени К. Кулажанова»',
        'name_kz' => '«Қ. Құлажанов атындағы Қазақ технология және бизнес университеті» АҚ',
        'bin' => '030240001575',
        'basis_ru' => 'Устава и Приказа № 188-25-К от 08.07.2025 г.',
        'basis_kz' => 'Жарғы және 08.07.2025 жылғы №188-25-К Бұйрық',
        'signatory_title_ru' => 'Президент',
        'signatory_title_kz' => 'Президент',
        'signatory_ru_gen' => 'Президента Е. Т. Кулажанова',
        'signatory_kz' => 'Президент Е.Т. Кулажанов',
        'signatory_short' => 'Е. Кулажанов',
        'bank' => '«ФРИДОМ БАНК КАЗАХСТАН» АҚ',
        'iik' => 'KZ68551Z227008936KZT',
        'bik' => 'KSNVKZKA',
        'legal_address_kz' => "Астана қ.\nҚайым Мұхамедханов к. 37А,",
        'legal_address_ru' => '',
        'phone' => '8(7172) 72-58-12',
        'visa_title_ru' => "Руководитель отдела\nпротиводействия коррупции и правового обеспечения",
        'visa_title_kz' => "Сыбайлас жемқорлыққа\nқарсы іс-қимыл және құқықтық қамтамасыз ету бөлімінің басшысы",
        'visa_name' => 'А. Қуат',
        'break_start' => '12.30',
        'break_end' => '13.30',
    ];

    /** Unit names the rules decline wrongly, written out by hand. */
    private const UNIT_GENITIVE = [
        'Эндаумент фонд' => 'Эндаумент фонда',
    ];

    public function run(): void
    {
        OrgUnit::query()
            ->whereNotIn('unit_type', self::SKIPPED_UNIT_TYPES)
            ->whereNull('name_ru_gen')
            ->get()
            ->each(function (OrgUnit $unit): void {
                $unit->forceFill(['name_ru_gen' => self::UNIT_GENITIVE[$unit->name] ?? RussianInflector::genitive($unit->name)])->save();
            });

        foreach (self::PPS_GENITIVE as $name => $genitive) {
            Position::query()->where('name', $name)->whereNull('staff_category')->update(['staff_category' => 'pps']);
            Position::query()->where('name', $name)->whereNull('name_ru_gen')->update(['name_ru_gen' => $genitive]);
        }

        foreach (self::AUP_UVP_POSITIONS as [$name, $category, $genitive, $possessive]) {
            $position = Position::query()->firstOrCreate(['name' => $name]);
            foreach (['staff_category' => $category, 'name_ru_gen' => $genitive, 'name_kz_poss' => $possessive] as $field => $value) {
                if ($position->{$field} === null) {
                    $position->{$field} = $value;
                }
            }
            $position->save();
        }

        if (! AppSetting::query()->where('key', EmployerSettings::KEY)->exists()) {
            AppSetting::query()->create(['key' => EmployerSettings::KEY, 'value' => self::EMPLOYER]);
        }
    }
}

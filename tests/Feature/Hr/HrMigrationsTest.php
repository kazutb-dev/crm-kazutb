<?php

namespace Tests\Feature\Hr;

use App\Models\AppSetting;
use App\Models\HrDocumentTemplate;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Services\Hr\EmployerSettings;
use Database\Seeders\HrHiringCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HrMigrationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_built_in_templates_are_active_version_one(): void
    {
        foreach (array_keys(HrDocumentTemplate::TYPE_LABELS) as $type) {
            $template = HrDocumentTemplate::active($type);

            $this->assertSame(1, $template->version);
            $this->assertNull($template->file_path);
            $this->assertFileExists($template->absolutePath());
        }
    }

    public function test_catalog_seeder_fills_only_empty_forms_and_marks_nothing_verified(): void
    {
        $chair = OrgUnit::query()->create(['code' => 'T_CHAIR', 'name' => 'Кафедра Информационные технологии', 'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR]);
        $office = OrgUnit::query()->create(['code' => 'T_OUP', 'name' => 'Отдел управления персоналом', 'unit_type' => OrgUnit::TYPE_OFFICE, 'name_ru_gen' => 'Отдела управления персоналом (проверено)']);
        $endowment = OrgUnit::query()->create(['code' => 'T_EF', 'name' => 'Эндаумент фонд', 'unit_type' => OrgUnit::TYPE_CENTER]);
        $board = OrgUnit::query()->create(['code' => 'T_BOARD', 'name' => 'Совет директоров', 'unit_type' => OrgUnit::TYPE_GOVERNANCE]);
        $lecturer = Position::query()->create(['name' => 'Сеньор-лектор']);

        (new HrHiringCatalogSeeder)->run();
        (new HrHiringCatalogSeeder)->run();

        $this->assertSame('кафедры «Информационные технологии»', $chair->fresh()->name_ru_gen);
        $this->assertSame('Отдела управления персоналом (проверено)', $office->fresh()->name_ru_gen);
        $this->assertNull($board->fresh()->name_ru_gen);
        $this->assertSame('Эндаумент фонда', $endowment->fresh()->name_ru_gen);
        $this->assertSame('сеньор-лектора', $lecturer->fresh()->name_ru_gen);
        $this->assertSame(Position::CATEGORY_PPS, $lecturer->fresh()->staff_category);

        $this->assertSame(1, Position::query()->where('name', 'Главный специалист')->count());
        $this->assertSame('бас маманы', Position::query()->where('name', 'Главный специалист')->value('name_kz_poss'));
        $this->assertSame(0, Position::query()->whereNotNull('case_forms_verified_at')->count());
        $this->assertSame(0, OrgUnit::query()->whereNotNull('case_forms_verified_at')->count());
    }

    public function test_employer_settings_come_from_the_sample_contract(): void
    {
        $settings = app(EmployerSettings::class)->all();

        $this->assertSame('030240001575', $settings['bin']);
        $this->assertSame('А. Қуат', $settings['visa_name']);
        $this->assertSame(['12.30', '13.30'], [$settings['break_start'], $settings['break_end']]);
        $this->assertSame(1, AppSetting::query()->where('key', EmployerSettings::KEY)->count());
    }
}

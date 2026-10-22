<?php

namespace Tests\Feature\Hr;

use App\Models\AuditLog;
use App\Models\HrDocumentTemplate;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Models\User;
use App\Services\Hr\EmployerSettings;
use App\Services\Hr\HiringDocumentGenerator;
use App\Services\Hr\HrAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;
use ZipArchive;

class HiringSettingsTest extends TestCase
{
    use BuildsHirings;
    use RefreshDatabase;

    private User $hr;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        Storage::fake('local');
        $this->hr = $this->hrUser();
    }

    public function test_employer_settings_are_saved_and_used_by_the_documents(): void
    {
        $this->actingAs($this->hr)->put(route('hr.hiring.settings.employer'), array_merge(app(EmployerSettings::class)->all(), [
            'visa_name' => 'Б. Сериков',
            'break_start' => '13:00',
        ]))->assertSessionHas('success');

        $this->assertSame('Б. Сериков', app(EmployerSettings::class)->all()['visa_name']);
        $this->assertSame('13.00', app(EmployerSettings::class)->all()['break_start']);

        $this->actingAs($this->hr)->put(route('hr.hiring.settings.employer'), ['break_end' => '25.00'])->assertSessionHasErrors('break_end');
        $this->assertSame(1, AuditLog::query()->where('event_type', 'hr.settings.updated')->count());
    }

    public function test_uploaded_template_is_checked_versioned_and_activated(): void
    {
        $valid = $this->templateFile(HrDocumentTemplate::builtInPath('order'));

        $this->actingAs($this->hr)->post(route('hr.hiring.settings.templates.store'), ['type' => 'order', 'file' => $valid, 'comment' => 'Новый бланк'])
            ->assertSessionHas('success');
        $uploaded = HrDocumentTemplate::query()->where('type', 'order')->where('version', 2)->sole();
        $this->assertFalse($uploaded->is_active);
        Storage::disk('local')->assertExists($uploaded->file_path);

        $this->actingAs($this->hr)->post(route('hr.hiring.settings.templates.activate', $uploaded))->assertSessionHas('success');
        $this->assertSame(2, HrDocumentTemplate::active('order')->version);

        $document = app(HiringDocumentGenerator::class)->generate($this->makeHiring(), 'order', $this->hr);
        $this->assertSame($uploaded->id, $document->template_id);

        $this->actingAs($this->hr)->get(route('hr.hiring.settings.templates.download', $uploaded))->assertOk();
        $this->actingAs($this->hr)->get(route('hr.hiring.settings.templates.download', HrDocumentTemplate::query()->where('type', 'order')->where('version', 1)->sole()))->assertOk();
    }

    public function test_template_with_errors_is_rejected_with_the_list_of_problems(): void
    {
        $broken = $this->templateFile(HrDocumentTemplate::builtInPath('order'), fn (string $xml) => str_replace('${fio_acc}', '${fio_akk}', $xml));

        $this->actingAs($this->hr)->post(route('hr.hiring.settings.templates.store'), ['type' => 'order', 'file' => $broken])
            ->assertSessionHasErrors('file');

        $problems = session('errors')->first('file');
        $this->assertStringContainsString('Неизвестный тег «${fio_akk}»', $problems);
        $this->assertStringContainsString('В шаблоне нет обязательного тега «${fio_acc}»', $problems);

        $this->assertSame(1, HrDocumentTemplate::query()->where('type', 'order')->count());
    }

    public function test_case_forms_are_confirmed_with_the_catalog_right(): void
    {
        $unit = OrgUnit::query()->create(['code' => 'T', 'name' => 'Кафедра Менеджмент', 'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR]);
        $payload = ['name_ru_gen' => 'кафедры «Менеджмент»', 'name_kz_gen' => '«Менеджмент» кафедрасының', 'verified' => true];

        $this->actingAs($this->hr)->put(route('hr.hiring.settings.units.update', $unit), $payload)->assertForbidden();

        app(HrAccess::class)->grant($this->hr, HrAccess::CATALOG, User::factory()->create(['role' => 'admin']));
        $this->actingAs($this->hr)->put(route('hr.hiring.settings.units.update', $unit), $payload)->assertSessionHas('success');

        $unit->refresh();
        $this->assertSame('«Менеджмент» кафедрасының', $unit->name_kz_gen);
        $this->assertNotNull($unit->case_forms_verified_at);
        $this->assertSame($this->hr->id, $unit->case_forms_verified_by);

        $this->actingAs($this->hr)->put(route('hr.hiring.settings.units.update', $unit), ['name_kz_gen' => 'x', 'verified' => false]);
        $this->assertNull($unit->fresh()->case_forms_verified_at);
    }

    public function test_new_position_is_added_by_a_catalog_user(): void
    {
        app(HrAccess::class)->grant($this->hr, HrAccess::CATALOG, User::factory()->create(['role' => 'admin']));

        $this->actingAs($this->hr)->post(route('hr.hiring.settings.positions.store'), [
            'name' => 'Специалист по кадрам', 'staff_category' => 'aup', 'name_ru_gen' => 'специалиста по кадрам', 'name_kz_poss' => 'кадрлар жөніндегі маманы',
        ])->assertSessionHas('success');
        $this->actingAs($this->hr)->post(route('hr.hiring.settings.positions.store'), ['name' => 'Специалист по кадрам', 'staff_category' => 'aup'])
            ->assertSessionHasErrors(['name' => 'Такая должность уже есть в справочнике.']);

        $position = Position::query()->where('name', 'Специалист по кадрам')->sole();
        $this->assertNotNull($position->case_forms_verified_at);
    }

    private function templateFile(string $source, ?callable $change = null): UploadedFile
    {
        $copy = tempnam(sys_get_temp_dir(), 'hr-up-').'.docx';
        copy($source, $copy);
        if ($change) {
            $zip = new ZipArchive;
            $zip->open($copy);
            $zip->addFromString('word/document.xml', $change($zip->getFromName('word/document.xml')));
            $zip->close();
        }

        return new UploadedFile($copy, 'order.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null, true);
    }
}

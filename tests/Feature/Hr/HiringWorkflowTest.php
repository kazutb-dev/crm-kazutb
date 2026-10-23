<?php

namespace Tests\Feature\Hr;

use App\Models\AuditLog;
use App\Models\HrDocument;
use App\Models\HrEmployee;
use App\Models\HrHiring;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Models\User;
use App\Services\Hr\HiringDocumentGenerator;
use App\Services\Hr\HrAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;

class HiringWorkflowTest extends TestCase
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

    public function test_new_hiring_starts_as_a_draft_with_the_default_break(): void
    {
        $response = $this->actingAs($this->hr)->post(route('hr.hiring.store'));

        $hiring = HrHiring::query()->sole();
        $response->assertRedirect(route('hr.hiring.edit', $hiring));
        $this->assertSame(HrHiring::STATUS_DRAFT, $hiring->status);
        $this->assertSame(['12.30', '13.30'], [$hiring->contract->break_start, $hiring->contract->break_end]);

        $this->actingAs($this->hr)->get(route('hr.hiring.edit', $hiring))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Hr/Hiring/Wizard')
                ->where('hiring.id', $hiring->id)
                ->where('previewAvailable', false)
                ->has('options.categories', 3)
                ->where('abilities.sensitive', false));
    }

    public function test_wizard_save_stores_employee_appointment_and_contract(): void
    {
        $hiring = $this->draft();
        $unit = OrgUnit::query()->create(['code' => 'T1', 'name' => 'Отдел управления персоналом', 'unit_type' => OrgUnit::TYPE_OFFICE, 'name_ru_gen' => 'Отдела управления персоналом']);
        $position = Position::query()->where('name', 'Главный специалист')->firstOrFail();

        $response = $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $hiring), [
            'employee' => [
                'last_name' => 'Иванова', 'first_name' => 'Мария', 'middle_name' => 'Петровна',
                'iin' => '940512400015', 'birth_date' => '1994-05-12', 'gender' => 'f',
                'children' => [['full_name' => 'Иванов Пётр', 'birth_date' => '2020-01-02'], ['full_name' => '']],
                'educations' => [['level' => 'master', 'institution' => 'КазУТБ', 'graduation_year' => 2018]],
                'disability' => '2',
            ],
            'hiring' => [
                'staff_category' => 'aup',
                'top_unit' => ['id' => $unit->id, 'name_ru' => $unit->name, 'name_kz_gen' => 'Персоналды басқару бөлімінің'],
                'position' => ['id' => $position->id, 'name_ru' => 'Главный специалист'],
                'start_date' => '2026-11-02', 'probation_months' => 3,
            ],
            'contract' => ['number' => '412', 'date' => '2026-10-30', 'term' => '1y', 'salary' => 385000, 'schedule' => 'aup', 'vacation_days' => 24, 'break_start' => '13:00', 'break_end' => '14.00'],
        ])->assertOk();

        $hiring->refresh();
        $employee = $hiring->employee;
        $this->assertSame('Иванову Марию Петровну', $hiring->fio_accusative);
        $this->assertSame('Отдела управления персоналом', $hiring->top_unit_name_ru_gen);
        $this->assertSame('Персоналды басқару бөлімінің', $hiring->top_unit_name_kz_gen);
        $this->assertSame('главного специалиста', $hiring->position_name_ru_gen);
        $this->assertSame(['13.00', '14.00'], [$hiring->contract->break_start, $hiring->contract->break_end]);
        $this->assertSame(['Иванов Пётр'], $employee->children->pluck('full_name')->all());
        $this->assertSame(1, $employee->educations()->count());
        $this->assertSame('none', $employee->disability, 'social status needs the hr.sensitive right');
        $this->assertNull($response->json('hiring.employee.disability'));
        $this->assertSame([], $response->json('hiring.checks.order.missing') === null ? [] : array_values(array_filter(
            $response->json('hiring.checks.contract.missing'), fn ($item) => $item['field'] === 'contract.break',
        )));

        $log = AuditLog::query()->where('event_type', 'hr.hiring.updated')->sole();
        $this->assertContains('employee.iin', $log->metadata['fields']);
        $this->assertStringNotContainsString('940512400015', json_encode($log->toArray(), JSON_UNESCAPED_UNICODE));
        $this->assertStringNotContainsString('Иванова', json_encode($log->toArray(), JSON_UNESCAPED_UNICODE));
    }

    public function test_social_status_is_saved_with_the_sensitive_right(): void
    {
        app(HrAccess::class)->grant($this->hr, HrAccess::SENSITIVE, User::factory()->create(['role' => 'admin']));
        $hiring = $this->draft();

        $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $hiring), ['employee' => ['disability' => '2', 'is_large_family' => true]])
            ->assertOk()->assertJsonPath('hiring.employee.disability', '2');

        $this->assertTrue($hiring->employee->fresh()->is_large_family);
    }

    public function test_invalid_or_duplicate_iin_is_rejected(): void
    {
        $existing = $this->makeHiring();
        $hiring = $this->draft();

        $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $hiring), ['employee' => ['iin' => '940512400016']])
            ->assertStatus(422)->assertJsonValidationErrors(['employee.iin' => 'Контрольная цифра не сходится']);

        $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $hiring), ['employee' => ['iin' => '940512300019']])
            ->assertStatus(422)->assertJsonValidationErrors(['employee.iin' => "приём #{$existing->id}"]);
    }

    public function test_manual_fio_accusative_is_kept(): void
    {
        $hiring = $this->draft();

        $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $hiring), [
            'employee' => ['last_name' => 'Сейткали', 'first_name' => 'Айгерим', 'middle_name' => 'Нурлановна', 'gender' => 'f'],
            'hiring' => ['fio_accusative' => 'Сейткали Айгерим Нурлановну (вручную)', 'fio_accusative_manual' => true],
        ])->assertOk();
        $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $hiring), ['employee' => ['middle_name' => 'Нуржановна']])->assertOk();

        $this->assertSame('Сейткали Айгерим Нурлановну (вручную)', $hiring->fresh()->fio_accusative);
    }

    public function test_manual_unit_and_position_are_added_to_the_catalog_only_with_the_right(): void
    {
        $hiring = $this->draft();
        $payload = ['hiring' => [
            'staff_category' => 'aup',
            'top_unit' => ['name_ru' => 'Центр цифровых компетенций', 'name_ru_gen' => 'Центра цифровых компетенций', 'name_kz_gen' => 'Цифрлық құзыреттер орталығының', 'add_to_catalog' => true],
            'position' => ['name_ru' => 'Аналитик данных', 'name_ru_gen' => 'аналитика данных', 'name_kz_poss' => 'деректер талдаушысы', 'add_to_catalog' => true],
        ]];

        $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $hiring), $payload)->assertOk();
        $this->assertNull(OrgUnit::query()->where('name', 'Центр цифровых компетенций')->first());
        $this->assertSame('Центра цифровых компетенций', $hiring->fresh()->top_unit_name_ru_gen, 'the typed names stay in the hiring');

        app(HrAccess::class)->grant($this->hr, HrAccess::CATALOG, User::factory()->create(['role' => 'admin']));
        $this->actingAs($this->hr->fresh())->putJson(route('hr.hiring.update', $hiring), $payload)->assertOk();

        $unit = OrgUnit::query()->where('name', 'Центр цифровых компетенций')->sole();
        $position = Position::query()->where('name', 'Аналитик данных')->sole();
        $this->assertSame('Цифрлық құзыреттер орталығының', $unit->name_kz_gen);
        $this->assertNotNull($unit->case_forms_verified_at);
        $this->assertSame('aup', $position->staff_category);
        $this->assertSame([$unit->id, $position->id], [$hiring->fresh()->top_unit_id, $hiring->fresh()->position_id]);
    }

    public function test_list_filters_searches_by_name_and_full_iin_and_masks_ids(): void
    {
        $first = $this->makeHiring();
        $second = $this->makeHiring(['iin' => '940512300029', 'last_name' => 'Жумабаева', 'first_name' => 'Динара'], ['start_date' => '2027-01-10']);

        $this->actingAs($this->hr)->get(route('hr.hiring.index', ['q' => 'жумаб']))
            ->assertInertia(fn (AssertableInertia $page) => $page->has('hirings.data', 1)->where('hirings.data.0.id', $second->id));

        $this->actingAs($this->hr)->get(route('hr.hiring.index', ['q' => '940512300019']))
            ->assertInertia(fn (AssertableInertia $page) => $page->has('hirings.data', 1)
                ->where('hirings.data.0.id', $first->id)
                ->where('hirings.data.0.iin_masked', '9405******19')
                ->where('hirings.data.0.id_card_masked', '******678')
                ->missing('hirings.data.0.iin'));

        $this->actingAs($this->hr)->get(route('hr.hiring.index', ['date_from' => '2027-01-01']))
            ->assertInertia(fn (AssertableInertia $page) => $page->has('hirings.data', 1)->where('hirings.data.0.id', $second->id));

        $this->actingAs($this->hr)->get(route('hr.hiring.index', ['unit' => $first->top_unit_id, 'status' => 'draft']))
            ->assertInertia(fn (AssertableInertia $page) => $page->has('hirings.data', 2));

        $this->actingAs($this->hr)->get(route('hr.hiring.index'))->assertDontSee('940512300019');
    }

    public function test_list_counts_hirings_per_status_and_shows_the_state_of_each_document(): void
    {
        $signed = $this->makeHiring();
        $this->makeHiring(['iin' => '940512300029', 'last_name' => 'Жумабаева', 'first_name' => 'Динара']);
        $generator = app(HiringDocumentGenerator::class);
        $contract = $generator->generate($signed, 'contract', $this->hr);
        $generator->generate($signed, 'order', $this->hr);
        $generator->markSigned($contract, $this->hr, 'hr/scans/contract.pdf');
        $signed->forceFill(['status' => HrHiring::STATUS_SIGNED])->save();

        $this->actingAs($this->hr)->get(route('hr.hiring.index', ['status' => 'draft']))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('counts', ['all' => 2, 'draft' => 1, 'signed' => 1, 'cancelled' => 0])
                ->has('hirings.data', 1));

        $this->actingAs($this->hr)->get(route('hr.hiring.index', ['q' => 'жумаб']))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('counts.all', 1)->where('counts.signed', 0));

        $this->actingAs($this->hr)->get(route('hr.hiring.index', ['status' => 'signed']))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('hirings.data.0.documents', ['contract' => 'signed', 'order' => 'draft', 'card' => 'none']));
    }

    public function test_next_numbers_follow_the_yearly_counter_and_warn_about_duplicates(): void
    {
        $hiring = $this->makeHiring();
        $other = $this->draft();

        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'contract', 'date' => '2026-12-01']))
            ->assertJson(['next' => '413', 'year' => 2026]);
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'order', 'date' => '2026-12-01']))
            ->assertJson(['next' => '413-К']);
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'contract', 'date' => '2027-01-05']))
            ->assertJson(['next' => '1', 'year' => 2027]);

        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'order', 'date' => '2026-11-01', 'value' => '412-к', 'hiring' => $other->id]))
            ->assertJson(['duplicate_hiring_id' => $hiring->id]);
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'order', 'date' => '2027-11-01', 'value' => '412-К', 'hiring' => $other->id]))
            ->assertJson(['duplicate_hiring_id' => null]);
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'contract', 'date' => '2026-11-01', 'value' => '412', 'hiring' => $hiring->id]))
            ->assertJson(['duplicate_hiring_id' => null, 'next' => '1'], 'the hiring\'s own number is neither a duplicate nor taken');
    }

    public function test_lookups_find_units_positions_and_people(): void
    {
        $faculty = OrgUnit::query()->create(['code' => 'F', 'name' => 'Факультет Экономика и бизнес', 'unit_type' => OrgUnit::TYPE_FACULTY]);
        OrgUnit::query()->create(['code' => 'C', 'name' => 'Кафедра Менеджмент', 'unit_type' => OrgUnit::TYPE_ACADEMIC_CHAIR, 'parent_id' => $faculty->id]);
        OrgUnit::query()->create(['code' => 'B', 'name' => 'Совет директоров', 'unit_type' => OrgUnit::TYPE_GOVERNANCE]);
        $this->makeHiring();

        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.units', ['parent' => $faculty->id]))
            ->assertJsonPath('items.0.name_ru', 'Кафедра Менеджмент')->assertJsonCount(1, 'items');
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.units', ['q' => 'Совет']))->assertJsonCount(0, 'items');
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.units', ['parent' => 0, 'q' => 'Кафедра']))
            ->assertJsonCount(0, 'items', 'a typed-in top unit has no catalog units under it');
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.positions', ['category' => 'pps', 'q' => 'преподав']))
            ->assertJsonPath('items.0.name_kz_poss', 'аға оқытушысы');
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.staff', ['q' => 'Айтмаган']))
            ->assertJsonPath('items.0.kind', 'employee')->assertJsonPath('items.0.full_name', 'Айтмаганбетов Асет Лайыкович');
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.staff', ['q' => 'Тасполт']))
            ->assertJsonPath('items.0.kind', 'user');
        $this->actingAs($this->hr)->postJson(route('hr.hiring.lookup.inflect'), ['kind' => 'unit', 'name' => 'Кафедра Туризм и сервис'])
            ->assertJson(['name_ru_gen' => 'кафедры «Туризм и сервис»']);
    }

    public function test_generate_download_and_sign_with_scan(): void
    {
        $hiring = $this->makeHiring();

        $generated = $this->actingAs($this->hr)->postJson(route('hr.hiring.documents.generate', [$hiring, 'contract']))->assertCreated();
        $document = HrDocument::query()->findOrFail($generated->json('document.id'));
        $this->actingAs($this->hr)->postJson(route('hr.hiring.documents.generate', [$hiring, 'order']))->assertCreated();

        $download = $this->actingAs($this->hr)->get($generated->json('document.download_url'));
        $download->assertOk()->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $this->assertStringContainsString('no-store', $download->headers->get('cache-control'));

        $this->actingAs($this->hr)->post(route('hr.hiring.documents.sign', [$hiring, $document]), [])->assertSessionHasErrors('scan');
        $this->actingAs($this->hr)->post(route('hr.hiring.documents.sign', [$hiring, $document]), ['scan' => UploadedFile::fake()->create('signed.pdf', 50, 'application/pdf')])
            ->assertSessionHas('success');
        $this->assertTrue($document->fresh()->isSigned());
        $this->assertSame(HrHiring::STATUS_DRAFT, $hiring->fresh()->status, 'the order is not signed yet');

        $order = $hiring->documents()->where('type', 'order')->sole();
        $this->actingAs($this->hr)->post(route('hr.hiring.documents.sign', [$hiring, $order]), ['scan' => UploadedFile::fake()->create('order.pdf', 50, 'application/pdf')]);
        $this->assertSame(HrHiring::STATUS_SIGNED, $hiring->fresh()->status);

        $events = AuditLog::query()->where('metadata->hiring_id', $hiring->id)->pluck('event_type')->all();
        $this->assertContains('hr.document.generated', $events);
        $this->assertContains('hr.document.downloaded', $events);
        $this->assertContains('hr.document.signed', $events);

        $this->actingAs($this->hr)->delete(route('hr.hiring.destroy', $hiring))->assertSessionHas('error');
        $this->assertNotSoftDeleted($hiring);
    }

    public function test_photo_and_pdf_attachments(): void
    {
        $hiring = $this->makeHiring();
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($this->hr)->postJson(route('hr.hiring.photo.store', $hiring), ['photo' => UploadedFile::fake()->image('me.jpg', 300, 400)])->assertOk();
        $photo = $hiring->employee->fresh()->photo_path;
        Storage::disk('local')->assertExists($photo);
        $this->actingAs($this->hr)->get(route('hr.hiring.photo.show', $hiring))->assertOk();

        $this->actingAs($this->hr)->postJson(route('hr.hiring.attachments.store', $hiring), ['doc_type' => 'diploma', 'file' => UploadedFile::fake()->create('scan.docx', 10)])
            ->assertStatus(422)->assertJsonValidationErrors('file');
        $stored = $this->actingAs($this->hr)->postJson(route('hr.hiring.attachments.store', $hiring), ['doc_type' => 'diploma', 'file' => UploadedFile::fake()->create('Диплом.pdf', 30, 'application/pdf')])
            ->assertCreated()->assertJsonPath('attachment.url', null);

        $attachmentId = $stored->json('attachment.id');
        $this->actingAs($admin)->get(route('hr.hiring.attachments.show', [$hiring, $attachmentId]))->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs($admin)->delete(route('hr.hiring.attachments.destroy', [$hiring, $attachmentId]))->assertOk();
        $this->assertSame(0, $hiring->employee->attachments()->count());

        $events = AuditLog::query()->where('metadata->hiring_id', $hiring->id)->pluck('event_type')->all();
        $this->assertContains('hr.attachment.opened', $events);
        $this->assertContains('hr.photo.uploaded', $events);
    }

    public function test_card_shows_documents_and_history_and_logs_the_view(): void
    {
        $hiring = $this->makeHiring();
        $this->actingAs($this->hr)->postJson(route('hr.hiring.documents.generate', [$hiring, 'contract']));

        $this->actingAs($this->hr)->get(route('hr.hiring.show', $hiring))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Hr/Hiring/Show')
                ->has('hiring.documents.contract', 1)
                ->where('hiring.documents.contract.0.version', 1)
                ->where('hiring.employee.iin', '940512300019')
                ->has('history'));

        $this->assertSame(1, AuditLog::query()->where('event_type', 'hr.hiring.viewed')->count());
    }

    public function test_rehire_creates_a_new_hiring_for_the_same_employee(): void
    {
        $hiring = $this->makeHiring();

        $this->actingAs($this->hr)->post(route('hr.hiring.rehire', $hiring))->assertRedirect();

        $this->assertSame(2, HrHiring::query()->where('employee_id', $hiring->employee_id)->count());
        $this->assertSame(1, HrEmployee::query()->count());
    }

    public function test_preview_without_libreoffice_reports_unavailable(): void
    {
        config(['hr.libreoffice.binary' => null]);
        $hiring = $this->makeHiring();

        $this->actingAs($this->hr)->postJson(route('hr.hiring.previews.store', [$hiring, 'contract']))
            ->assertCreated()->assertJsonPath('preview.status', 'unavailable')->assertJsonPath('preview.pdf_url', null);
    }

    private function draft(): HrHiring
    {
        $this->actingAs($this->hr)->post(route('hr.hiring.store'));

        return HrHiring::query()->latest('id')->firstOrFail();
    }
}

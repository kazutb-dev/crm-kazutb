<?php

namespace Tests\Feature\Hr;

use App\Models\AuditLog;
use App\Models\HrDocument;
use App\Models\HrDocumentTemplate;
use App\Models\HrEmploymentContract;
use App\Services\Hr\HiringDocumentGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;

/**
 * Reference ("golden") tests: the generated documents are compared paragraph by paragraph with the texts in
 * tests/Fixtures/Hr. Run with UPDATE_HR_FIXTURES=1 to rewrite them after an intended template change, then
 * review the diff.
 */
class HiringDocumentGenerationTest extends TestCase
{
    use BuildsHirings;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    /**
     * @return array<string, array{string, array<string, mixed>, array<string, mixed>}>
     */
    public static function contractCombinations(): array
    {
        return [
            '1 year, 3 months probation, PPS schedule, main job' => ['contract-1y-prob3-pps-main', [], []],
            'open-ended, no probation, AUP schedule, part-time' => ['contract-indefinite-noprob-aup-secondary',
                ['probation_months' => 0, 'staff_category' => 'aup'],
                ['term' => HrEmploymentContract::TERM_INDEFINITE, 'schedule' => HrEmploymentContract::SCHEDULE_AUP, 'employment' => HrEmploymentContract::EMPLOYMENT_SECONDARY, 'vacation_days' => 24, 'salary' => 100000]],
            'replacement, shift schedule' => ['contract-replacement-shift',
                ['probation_months' => 1, 'replaces_full_name' => 'Иманова Сауле Ериковна'],
                ['term' => HrEmploymentContract::TERM_REPLACEMENT, 'schedule' => HrEmploymentContract::SCHEDULE_SHIFT]],
        ];
    }

    #[DataProvider('contractCombinations')]
    public function test_contract_matches_the_reference_text(string $fixture, array $hiring, array $contract): void
    {
        $document = app(HiringDocumentGenerator::class)->generate($this->makeHiring([], $hiring, $contract), HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());

        $this->assertMatchesReference($fixture, $document);
        $this->assertSame([], $document->missing_fields);
    }

    public function test_order_matches_the_reference_text(): void
    {
        $document = app(HiringDocumentGenerator::class)->generate($this->makeHiring(), HrDocumentTemplate::TYPE_ORDER, $this->hrUser());

        $this->assertMatchesReference('order-1y-prob3-main', $document);
        $this->assertSame([], $document->missing_fields);
    }

    public function test_personal_card_matches_the_reference_text(): void
    {
        $hiring = $this->makeHiring(['is_large_family' => true]);
        $hiring->employee->educations()->create(['level' => 'master', 'institution' => 'КазУТБ', 'graduation_year' => 2018, 'specialty' => 'Информационные системы', 'diploma_number' => 'ЖБ-М 0012345']);
        $hiring->employee->children()->create(['full_name' => 'Айтмаганбетова Алия Асетовна', 'birth_date' => '2019-04-01']);
        $hiring->employee->attachments()->create(['doc_type' => 'id_card', 'original_name' => 'udostoverenie.pdf', 'file_path' => 'hr/employees/1/x.pdf']);

        $document = app(HiringDocumentGenerator::class)->generate($hiring, HrDocumentTemplate::TYPE_CARD, $this->hrUser(), ['sensitive' => true]);

        $this->assertMatchesReference('card-full', $document, ['/Дата заполнения: \d\d\.\d\d\.\d{4}/u' => 'Дата заполнения: ДД.ММ.ГГГГ']);
        $this->assertSame([['field' => 'employee.photo', 'label' => 'Фото', 'step' => 1]], $document->missing_fields);
    }

    public function test_personal_card_places_the_photo(): void
    {
        $image = imagecreatetruecolor(30, 40);
        ob_start();
        imagepng($image);
        Storage::disk('local')->put('hr/employees/photo.png', ob_get_clean());

        $document = app(HiringDocumentGenerator::class)->generate($this->makeHiring(['photo_path' => 'hr/employees/photo.png']), HrDocumentTemplate::TYPE_CARD, $this->hrUser());

        $zip = new \ZipArchive;
        $zip->open(Storage::disk('local')->path($document->file_path));
        $media = array_filter(array_map(fn ($i) => $zip->getNameIndex($i), range(0, $zip->numFiles - 1)), fn ($name) => str_starts_with($name, 'word/media/'));
        $zip->close();

        $this->assertCount(1, $media);
        $this->assertNotContains('employee.photo', array_column($document->missing_fields, 'field'));
        $this->assertStringNotContainsString('Фото 3×4', $this->docxText(Storage::disk('local')->path($document->file_path)));
    }

    public function test_personal_card_hides_the_social_status_without_the_right(): void
    {
        $document = app(HiringDocumentGenerator::class)->generate($this->makeHiring(['disability' => '2']), HrDocumentTemplate::TYPE_CARD, $this->hrUser());
        $text = $this->docxText(Storage::disk('local')->path($document->file_path));

        $this->assertStringContainsString('RU | нет доступа', str_replace('KZ |', 'RU |', $text));
        $this->assertStringNotContainsString('II группа', $text);
    }

    public function test_incomplete_contract_is_generated_with_blanks_and_lists_what_is_missing(): void
    {
        $hiring = $this->makeHiring(['iin' => null, 'phone' => null], ['start_date' => null], ['salary' => null]);

        $document = app(HiringDocumentGenerator::class)->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());
        $text = $this->docxText(Storage::disk('local')->path($document->file_path));

        $this->assertStringContainsString('ИИН __________', $text);
        $this->assertStringContainsString('Дата начала работы __________ года.', $text);
        $this->assertStringContainsString('в размере __________ (__________) тенге', $text);
        $this->assertStringNotContainsString('${', $text);
        $this->assertSame(
            ['employee.iin', 'employee.phone', 'hiring.start_date', 'contract.salary'],
            array_column($document->missing_fields, 'field'),
        );
    }

    public function test_manual_unit_and_position_forms_are_used_and_unverified_catalog_forms_warned(): void
    {
        $hiring = $this->makeHiring([], [
            'top_unit_id' => null, 'sub_unit_id' => null,
            'top_unit_name_ru' => 'Центр цифровых компетенций',
            'top_unit_name_ru_gen' => 'Центра цифровых компетенций',
            'top_unit_name_kz_gen' => 'Цифрлық құзыреттер орталығының',
        ]);
        $hiring->position->forceFill(['case_forms_verified_at' => null])->save();

        $document = app(HiringDocumentGenerator::class)->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());
        $text = $this->docxText(Storage::disk('local')->path($document->file_path));

        $this->assertStringContainsString('на должность старшего преподавателя Центра цифровых компетенций.', $text);
        $this->assertStringContainsString('Жұмыскерді Цифрлық құзыреттер орталығының аға оқытушысы лауазымына', $text);
        $this->assertSame(['Падежные формы должности «Старший преподаватель» не проверены ОУП.'], $document->warnings);
    }

    public function test_break_time_comes_from_the_contract(): void
    {
        $hiring = $this->makeHiring([], [], ['break_start' => '13.00', 'break_end' => '14.00']);

        $document = app(HiringDocumentGenerator::class)->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());
        $text = $this->docxText(Storage::disk('local')->path($document->file_path));

        $this->assertStringContainsString('KZ | 3.1.3. Демалу мен тамақ ішуге үзіліс – 13.00-тен 14.00-ке дейін.', $text);
        $this->assertStringContainsString('RU | 3.1.3. Перерыв для отдыха и питания - с 13.00 до 14.00.', $text);
    }

    public function test_missing_kazakh_form_is_reported_and_left_blank(): void
    {
        $hiring = $this->makeHiring();
        $hiring->position->forceFill(['name_kz_poss' => null])->save();
        $hiring->forceFill(['position_name_kz_poss' => null])->save();

        $document = app(HiringDocumentGenerator::class)->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());

        $this->assertContains('hiring.position_name_kz_poss', array_column($document->missing_fields, 'field'));
        $this->assertStringContainsString('кафедрасының __________ лауазымына', $this->docxText(Storage::disk('local')->path($document->file_path)));
    }

    public function test_regeneration_creates_a_new_version_and_keeps_signed_files(): void
    {
        $generator = app(HiringDocumentGenerator::class);
        $hiring = $this->makeHiring();
        $user = $this->hrUser();

        $first = $generator->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $user);
        $generator->markSigned($first, $user, 'hr/documents/1/signed-scan.pdf');
        $signedHash = hash('sha256', Storage::disk('local')->get($first->file_path));

        $hiring->contract->update(['salary' => 400000]);
        $second = $generator->generate($hiring->fresh(), HrDocumentTemplate::TYPE_CONTRACT, $user);

        $this->assertSame(1, $first->version);
        $this->assertSame(2, $second->version);
        $this->assertNotSame($first->file_path, $second->file_path);
        $this->assertSame($signedHash, hash('sha256', Storage::disk('local')->get($first->fresh()->file_path)));
        $this->assertSame(HrDocument::STATUS_SIGNED, $first->fresh()->status);
        $this->assertStringContainsString('400 000 (четыреста тысяч) тенге', $this->docxText(Storage::disk('local')->path($second->file_path)));
    }

    public function test_executor_defaults_to_the_user_and_sticks_on_regeneration(): void
    {
        $generator = app(HiringDocumentGenerator::class);
        $hiring = $this->makeHiring();
        $author = $this->hrUser();

        $first = $generator->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $author);
        $this->assertSame('М.Р. Тасполтаева', $first->oup_executor);

        $colleague = \App\Models\User::factory()->create(['name' => 'Ахметова Гульнара Сериковна', 'role' => 'hr']);
        $second = $generator->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $colleague);
        $this->assertSame('М.Р. Тасполтаева', $second->oup_executor);

        $third = $generator->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $colleague, ['executor' => 'Г.С. Ахметова']);
        $this->assertSame('Г.С. Ахметова', $third->oup_executor);
        $this->assertStringContainsString('Г.С. Ахметова', $this->docxText(Storage::disk('local')->path($third->file_path)));
    }

    public function test_generation_is_audited_without_personal_data(): void
    {
        $document = app(HiringDocumentGenerator::class)->generate($this->makeHiring(), HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());

        $log = AuditLog::query()->where('event_type', 'hr.document.generated')->sole();
        $this->assertSame($document->id, $log->subject_id);
        $serialized = json_encode($log->toArray(), JSON_UNESCAPED_UNICODE);
        $this->assertStringNotContainsString('940512300019', $serialized);
        $this->assertStringNotContainsString('Айтмаганбетов', $serialized);
    }

    public function test_iin_and_id_number_are_encrypted_at_rest(): void
    {
        $hiring = $this->makeHiring();
        $raw = \Illuminate\Support\Facades\DB::table('hr_employees')->where('id', $hiring->employee_id)->first();

        $this->assertStringNotContainsString('940512300019', $raw->iin);
        $this->assertStringNotContainsString('052345678', $raw->id_card_number);
        $this->assertSame(hash_hmac('sha256', '940512300019', config('app.key')), $raw->iin_hash);
        $this->assertSame('9405******19', $hiring->employee->maskedIin());
        $this->assertSame('******678', $hiring->employee->maskedIdCardNumber());
        $this->assertArrayNotHasKey('iin', $hiring->employee->toArray());
    }

    /**
     * @param  array<string, string>  $normalize  regex => replacement for values that change between runs
     */
    private function assertMatchesReference(string $fixture, HrDocument $document, array $normalize = []): void
    {
        $text = $this->docxText(Storage::disk('local')->path($document->file_path));
        $text = preg_replace(array_keys($normalize), array_values($normalize), $text);
        $path = base_path("tests/Fixtures/Hr/{$fixture}.txt");

        if (getenv('UPDATE_HR_FIXTURES')) {
            @mkdir(dirname($path), 0777, true);
            file_put_contents($path, $text);
        }

        $this->assertStringNotContainsString('${', $text, 'unfilled tag left in the document');
        $this->assertFileExists($path);
        $this->assertSame(file_get_contents($path), $text);
    }
}

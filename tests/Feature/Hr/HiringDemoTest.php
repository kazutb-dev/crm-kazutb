<?php

namespace Tests\Feature\Hr;

use App\Models\HrDocumentTemplate;
use App\Models\HrHiring;
use App\Models\OrgUnit;
use App\Models\User;
use App\Services\Hr\HiringDemoFiller;
use App\Services\Hr\HiringDocumentGenerator;
use App\Services\Hr\HiringService;
use App\Services\Hr\Iin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;
use ZipArchive;

/**
 * «Демо-приём» and «Заполнить демо-данными»: administrators get a draft the documents need nothing more for,
 * marked «ДЕМО» in the numbers.
 */
class HiringDemoTest extends TestCase
{
    use BuildsHirings;
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        Storage::fake('local');
        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->makeHiring(); // the catalog: a faculty, its chair and a position with case forms
    }

    public function test_demo_hiring_is_complete_for_all_three_documents(): void
    {
        $this->actingAs($this->admin)->post(route('hr.hiring.demo.store'))->assertRedirect()->assertSessionHas('success');
        $hiring = HrHiring::query()->latest('id')->firstOrFail();

        $this->assertSame(HiringDemoFiller::CONTRACT_NUMBER, $hiring->contract->number);
        $this->assertSame(HiringDemoFiller::ORDER_NUMBER, $hiring->order_number);
        $this->assertTrue(Iin::parse($hiring->employee->iin)->valid);
        $this->assertNotNull($hiring->sub_unit_id, 'a chair from the catalog');
        $this->assertSame('pps', $hiring->staff_category);
        Storage::disk('local')->assertExists($hiring->employee->photo_path);

        foreach (app(HiringService::class)->checks($hiring) as $type => $check) {
            $this->assertSame([], $check['missing'], "nothing missing for {$type}");
        }
        foreach (array_keys(HrDocumentTemplate::TYPE_LABELS) as $type) {
            $document = app(HiringDocumentGenerator::class)->generate($hiring, $type, $this->admin);
            $zip = new ZipArchive;
            $zip->open(Storage::disk('local')->path($document->file_path));
            $this->assertStringNotContainsString('${', (string) $zip->getFromName('word/document.xml'), $type);
            $zip->close();
        }
    }

    public function test_each_demo_gets_its_own_iin_and_only_drafts_are_refilled(): void
    {
        $this->actingAs($this->admin)->post(route('hr.hiring.demo.store'));
        $this->actingAs($this->admin)->post(route('hr.hiring.demo.store'));
        $this->assertSame(2, HrHiring::query()->whereHas('employee', fn ($q) => $q->where('last_name', 'Тестова'))->count());
        [$first, $second] = HrHiring::query()->latest('id')->take(2)->get()->all();
        $this->assertNotSame($first->employee->iin_hash, $second->employee->iin_hash);

        $signed = $this->makeHiring(['iin' => '940512300029'], ['status' => HrHiring::STATUS_SIGNED]);
        $this->actingAs($this->admin)->post(route('hr.hiring.demo.fill', $signed))->assertSessionHas('error');
        $this->assertNotSame('Тестова', $signed->employee->fresh()->last_name);
    }

    public function test_without_catalog_forms_the_demo_types_in_a_faculty_and_a_chair(): void
    {
        OrgUnit::query()->update(['name_kz_gen' => null]);

        $this->actingAs($this->admin)->post(route('hr.hiring.demo.store'));
        $hiring = HrHiring::query()->latest('id')->firstOrFail();

        $this->assertNull($hiring->top_unit_id);
        $this->assertSame('Кафедра «Информационные системы»', $hiring->sub_unit_name_ru);
        foreach (app(HiringService::class)->checks($hiring) as $type => $check) {
            $this->assertSame([], $check['missing'], "nothing missing for {$type}");
        }
    }
}

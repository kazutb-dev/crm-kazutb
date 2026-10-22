<?php

namespace Tests\Feature\Hr;

use App\Models\AppSetting;
use App\Models\HrDocumentPreview;
use App\Models\HrDocumentTemplate;
use App\Models\HrEmployee;
use App\Models\HrHiring;
use App\Models\User;
use App\Services\Hr\HiringDocumentGenerator;
use App\Services\Hr\HrNumberSuggester;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;

/**
 * Deleted drafts (files at once, records after 30 days), the hr role's start page and the order number
 * issued outside the module.
 */
class HiringCleanupTest extends TestCase
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

    public function test_deleting_a_draft_removes_files_at_once_and_records_after_thirty_days(): void
    {
        [$hiring, $files] = $this->draftWithFiles();

        $this->actingAs($this->hr)->delete(route('hr.hiring.destroy', $hiring))->assertRedirect(route('hr.hiring.index'));

        foreach ($files as $file) {
            Storage::disk('local')->assertMissing($file);
        }
        $this->assertSoftDeleted($hiring);
        $this->assertSoftDeleted($hiring->employee);
        $this->assertNull(HrEmployee::withTrashed()->find($hiring->employee_id)->iin_hash, 'the IIN is free for a new hiring');
        $this->assertSame(0, HrDocumentPreview::query()->count());

        $this->travel(29)->days();
        $this->artisan('hr:purge-deleted')->assertSuccessful();
        $this->assertNotNull(HrHiring::withTrashed()->find($hiring->id));

        $this->travel(2)->days();
        $this->artisan('hr:purge-deleted')->expectsOutput('Purged deleted HR drafts: hirings 1, employees 1')->assertSuccessful();
        $this->assertNull(HrHiring::withTrashed()->find($hiring->id));
        $this->assertNull(HrEmployee::withTrashed()->find($hiring->employee_id));
        $this->assertSame(0, \Illuminate\Support\Facades\DB::table('hr_documents')->count());
        $this->assertSame(0, \Illuminate\Support\Facades\DB::table('hr_employee_attachments')->count());
    }

    public function test_the_same_person_can_be_entered_again_after_the_draft_was_deleted(): void
    {
        [$hiring] = $this->draftWithFiles();
        $this->actingAs($this->hr)->delete(route('hr.hiring.destroy', $hiring));

        $this->actingAs($this->hr)->post(route('hr.hiring.store'));
        $new = HrHiring::query()->latest('id')->firstOrFail();

        $this->actingAs($this->hr)->putJson(route('hr.hiring.update', $new), ['employee' => ['iin' => '940512300019']])->assertOk();
    }

    public function test_an_employee_with_another_hiring_keeps_photo_and_scans(): void
    {
        [$hiring, $files] = $this->draftWithFiles();
        $this->actingAs($this->hr)->post(route('hr.hiring.rehire', $hiring));
        $second = HrHiring::query()->latest('id')->firstOrFail();

        $this->actingAs($this->hr)->delete(route('hr.hiring.destroy', $second))->assertRedirect();

        $this->assertNotSoftDeleted($hiring->employee);
        Storage::disk('local')->assertExists($files['photo']);
        Storage::disk('local')->assertExists($files['attachment']);
        Storage::disk('local')->assertExists($files['document']); // documents of the other hiring stay
    }

    public function test_hr_role_starts_on_the_hiring_list_after_login(): void
    {
        $hr = User::factory()->create(['role' => 'hr', 'password' => 'Secret-2026']);
        $teacher = User::factory()->create(['role' => 'teacher', 'password' => 'Secret-2026']);

        $this->post('/login', ['email' => $hr->email, 'password' => 'Secret-2026'])->assertRedirect(route('hr.hiring.index'));
        auth()->logout();
        $this->post('/login', ['email' => $teacher->email, 'password' => 'Secret-2026'])->assertRedirect(route('profile.edit'));
    }

    public function test_order_number_continues_from_the_number_issued_outside_the_module(): void
    {
        $this->makeHiring();

        $this->actingAs($this->hr)->put(route('hr.hiring.settings.numbering'), ['year' => 2026, 'last_order_number' => 500])->assertSessionHas('success');
        $this->assertSame(['year' => 2026, 'last_order_number' => 500], AppSetting::query()->where('key', HrNumberSuggester::EXTERNAL_KEY)->value('value'));

        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'order', 'date' => '2026-12-01']))
            ->assertJson(['next' => '501-К', 'external_last' => 500]);
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'order', 'date' => '2027-01-10']))
            ->assertJson(['next' => '1-К', 'external_last' => null]);
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'contract', 'date' => '2026-12-01']))
            ->assertJson(['next' => '413']);

        $this->actingAs($this->hr)->put(route('hr.hiring.settings.numbering'), ['year' => 2026, 'last_order_number' => 300]);
        $this->actingAs($this->hr)->getJson(route('hr.hiring.lookup.numbers', ['kind' => 'order', 'date' => '2026-12-01']))
            ->assertJson(['next' => '413-К'], 'a smaller outside number does not lower the counter');
    }

    /**
     * A draft with a generated document, a preview, a photo and a scan.
     *
     * @return array{HrHiring, array<string, string>}
     */
    private function draftWithFiles(): array
    {
        $hiring = $this->makeHiring(['photo_path' => 'hr/employees/photo.png']);
        $employee = $hiring->employee;
        Storage::disk('local')->put('hr/employees/photo.png', 'png');
        Storage::disk('local')->put("hr/employees/{$employee->id}/attachments/a.pdf", '%PDF');
        $employee->attachments()->create(['doc_type' => 'diploma', 'original_name' => 'd.pdf', 'file_path' => "hr/employees/{$employee->id}/attachments/a.pdf"]);
        $document = app(HiringDocumentGenerator::class)->generate($hiring, HrDocumentTemplate::TYPE_CONTRACT, $this->hr);
        Storage::disk('local')->put('hr/previews/p.pdf', '%PDF');
        HrDocumentPreview::query()->create(['hiring_id' => $hiring->id, 'user_id' => $this->hr->id, 'type' => 'contract', 'status' => 'ready', 'pdf_path' => 'hr/previews/p.pdf']);

        return [$hiring, [
            'photo' => 'hr/employees/photo.png',
            'attachment' => "hr/employees/{$employee->id}/attachments/a.pdf",
            'document' => $document->file_path,
            'preview' => 'hr/previews/p.pdf',
        ]];
    }
}

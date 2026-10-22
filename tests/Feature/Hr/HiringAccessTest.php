<?php

namespace Tests\Feature\Hr;

use App\Models\HrDocument;
use App\Models\HrDocumentPreview;
use App\Models\HrDocumentTemplate;
use App\Models\HrEmployeeAttachment;
use App\Models\HrHiring;
use App\Models\Position;
use App\Models\User;
use App\Services\Hr\HiringDocumentGenerator;
use App\Services\Hr\HrAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;

/**
 * Who reaches which route of the hiring module, and that ids of another hiring or another user give 404.
 */
class HiringAccessTest extends TestCase
{
    use BuildsHirings;
    use RefreshDatabase;

    private HrHiring $hiring;

    private HrDocument $document;

    private HrEmployeeAttachment $attachment;

    private HrDocumentPreview $preview;

    private HrDocumentTemplate $template;

    private User $hr;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        Storage::fake('local');

        $this->hr = $this->hrUser();
        $this->hiring = $this->makeHiring(['photo_path' => 'hr/employees/photo.png']);
        Storage::disk('local')->put('hr/employees/photo.png', 'png');
        $this->document = app(HiringDocumentGenerator::class)->generate($this->hiring, HrDocumentTemplate::TYPE_CONTRACT, $this->hr);
        $this->document->forceFill(['signed_scan_path' => 'hr/documents/scan.pdf'])->save();
        Storage::disk('local')->put('hr/documents/scan.pdf', '%PDF-1.4');
        Storage::disk('local')->put('hr/employees/a.pdf', '%PDF-1.4');
        $this->attachment = $this->hiring->employee->attachments()->create(['doc_type' => 'diploma', 'original_name' => 'd.pdf', 'file_path' => 'hr/employees/a.pdf']);
        Storage::disk('local')->put('hr/previews/p.pdf', '%PDF-1.4');
        $this->preview = HrDocumentPreview::query()->create(['hiring_id' => $this->hiring->id, 'user_id' => $this->hr->id, 'type' => 'contract', 'status' => HrDocumentPreview::STATUS_READY, 'pdf_path' => 'hr/previews/p.pdf']);
        $this->template = HrDocumentTemplate::active(HrDocumentTemplate::TYPE_ORDER);
    }

    /**
     * [method, route name, params builder key, needed right: null | hr.* | admin | owner]
     *
     * @return array<string, array{string, string, string, ?string}>
     */
    public static function routes(): array
    {
        return [
            'list' => ['get', 'hr.hiring.index', 'none', null],
            'wizard' => ['get', 'hr.hiring.edit', 'hiring', null],
            'card' => ['get', 'hr.hiring.show', 'hiring', null],
            'save' => ['putJson', 'hr.hiring.update', 'hiring', null],
            'photo' => ['get', 'hr.hiring.photo.show', 'hiring', null],
            'download' => ['get', 'hr.hiring.documents.download', 'document', null],
            'generate' => ['postJson', 'hr.hiring.documents.generate', 'type', null],
            'preview status' => ['getJson', 'hr.hiring.previews.show', 'preview', 'owner'],
            'preview pdf' => ['get', 'hr.hiring.previews.pdf', 'preview', 'owner'],
            'lookup units' => ['getJson', 'hr.hiring.lookup.units', 'none', null],
            'lookup numbers' => ['getJson', 'hr.hiring.lookup.numbers', 'numbers', null],
            'settings' => ['get', 'hr.hiring.settings.index', 'none', null],
            'template download' => ['get', 'hr.hiring.settings.templates.download', 'template', null],
            'attachment pdf' => ['get', 'hr.hiring.attachments.show', 'attachment', HrAccess::SENSITIVE],
            'signed scan' => ['get', 'hr.hiring.documents.scan', 'document', HrAccess::SENSITIVE],
            'catalog position' => ['putJson', 'hr.hiring.settings.positions.update', 'position', HrAccess::CATALOG],
            'rights users' => ['getJson', 'hr.hiring.settings.users', 'users', 'admin'],
        ];
    }

    #[DataProvider('routes')]
    public function test_route_access_by_role_and_right(string $method, string $name, string $params, ?string $right): void
    {
        $url = route($name, $this->params($params));
        $teacher = User::factory()->create(['role' => 'teacher']);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->assertGuestBlocked($method, $url);
        $this->assertBlocked($this->actingAs($teacher)->{$method}($url));

        $hrResponse = $this->actingAs($this->hr)->{$method}($url, $this->payload($name));
        if ($right === 'owner') {
            // A preview belongs to the person who requested it (here: the hr user), even administrators get 404.
            $this->assertLessThan(400, $hrResponse->getStatusCode(), "owner on {$name}");
            $this->actingAs($admin)->{$method}($url)->assertNotFound();

            return;
        }
        if ($right === null) {
            $this->assertLessThan(400, $hrResponse->getStatusCode(), "hr on {$name}: ".$hrResponse->getContent());
        } else {
            $hrResponse->assertForbidden();
            if ($right !== 'admin') {
                app(HrAccess::class)->grant($this->hr, $right, $admin);
                $this->assertLessThan(400, $this->actingAs($this->hr->fresh())->{$method}($url, $this->payload($name))->getStatusCode(), "hr with {$right} on {$name}");
            }
        }

        $this->assertLessThan(400, $this->actingAs($admin)->{$method}($url, $this->payload($name))->getStatusCode(), "admin on {$name}");
    }

    public function test_a_document_of_another_hiring_is_not_reachable(): void
    {
        $other = $this->makeHiring(['iin' => '940512300029']);

        $this->actingAs($this->hr)->get(route('hr.hiring.documents.download', [$other, $this->document]))->assertNotFound();
        $this->actingAs($this->hr)->post(route('hr.hiring.documents.sign', [$other, $this->document]), ['scan' => UploadedFile::fake()->create('s.pdf', 10, 'application/pdf')])->assertNotFound();
    }

    public function test_an_attachment_of_another_employee_is_not_reachable(): void
    {
        $other = $this->makeHiring(['iin' => '940512300029']);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->get(route('hr.hiring.attachments.show', [$other, $this->attachment]))->assertNotFound();
        $this->actingAs($admin)->delete(route('hr.hiring.attachments.destroy', [$other, $this->attachment]))->assertNotFound();
        $this->assertModelExists($this->attachment);
    }

    public function test_a_preview_is_private_to_the_person_who_requested_it(): void
    {
        $colleague = User::factory()->create(['role' => 'hr']);

        $this->actingAs($colleague)->getJson(route('hr.hiring.previews.show', [$this->hiring, $this->preview]))->assertNotFound();
        $this->actingAs($colleague)->get(route('hr.hiring.previews.pdf', [$this->hiring, $this->preview]))->assertNotFound();

        $other = $this->makeHiring(['iin' => '940512300029']);
        $this->actingAs($this->hr)->get(route('hr.hiring.previews.pdf', [$other, $this->preview]))->assertNotFound();
    }

    public function test_deleted_hiring_is_gone_for_everyone(): void
    {
        $draft = HrHiring::query()->create(['employee_id' => $this->hiring->employee_id]);
        $this->actingAs($this->hr)->delete(route('hr.hiring.destroy', $draft))->assertRedirect(route('hr.hiring.index'));

        $this->actingAs($this->hr)->get(route('hr.hiring.show', $draft))->assertNotFound();
    }

    public function test_rights_are_granted_and_revoked_by_administrators_only(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $payload = ['user_id' => $this->hr->id, 'capability' => HrAccess::SENSITIVE];

        $this->actingAs($this->hr)->post(route('hr.hiring.settings.rights.grant'), $payload)->assertForbidden();

        $this->actingAs($admin)->post(route('hr.hiring.settings.rights.grant'), $payload)->assertRedirect();
        $this->assertTrue(app(HrAccess::class)->canViewSensitive($this->hr->fresh()));

        $this->actingAs($admin)->delete(route('hr.hiring.settings.rights.revoke'), $payload)->assertRedirect();
        $this->assertFalse((new HrAccess)->canViewSensitive($this->hr->fresh()));
    }

    public function test_a_right_does_not_open_the_module_without_the_role(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        app(HrAccess::class)->grant($teacher, HrAccess::SENSITIVE, User::factory()->create(['role' => 'admin']));

        $this->assertFalse((new HrAccess)->canViewSensitive($teacher));
        $this->assertBlocked($this->actingAs($teacher)->get(route('hr.hiring.attachments.show', [$this->hiring, $this->attachment])));
    }

    /**
     * @return array<string, mixed>
     */
    private function params(string $kind): array
    {
        return match ($kind) {
            'none' => [],
            'hiring' => [$this->hiring],
            'document' => [$this->hiring, $this->document],
            'type' => [$this->hiring, 'order'],
            'preview' => [$this->hiring, $this->preview],
            'attachment' => [$this->hiring, $this->attachment],
            'template' => [$this->template],
            'position' => [Position::query()->firstOrFail()],
            'numbers' => ['kind' => 'contract'],
            'users' => ['q' => 'Тас'],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(string $name): array
    {
        return match ($name) {
            'hr.hiring.update' => ['contract' => ['salary' => 390000]],
            'hr.hiring.settings.positions.update' => ['name_ru_gen' => 'старшего преподавателя', 'verified' => true],
            default => [],
        };
    }

    private function assertGuestBlocked(string $method, string $url): void
    {
        auth()->logout();
        $response = $this->{$method}($url);
        $this->assertContains($response->getStatusCode(), [302, 401], 'guest must be sent to the login page');
    }

    private function assertBlocked($response): void
    {
        $status = $response->getStatusCode();
        $this->assertTrue($status === 403 || ($status === 302 && ! str_contains((string) $response->headers->get('Location'), '/hr/hiring')), "expected 403 or a redirect away, got {$status}");
    }
}

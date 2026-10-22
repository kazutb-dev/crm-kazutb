<?php

namespace Tests\Feature\Hr;

use App\Jobs\RenderHrDocumentPreview;
use App\Models\HrDocumentPreview;
use App\Models\HrDocumentTemplate;
use App\Services\Hr\HiringPreviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;

class HiringPreviewTest extends TestCase
{
    use BuildsHirings;
    use RefreshDatabase;

    private string $fakeSoffice;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->fakeSoffice = tempnam(sys_get_temp_dir(), 'soffice-');
        chmod($this->fakeSoffice, 0755);
    }

    protected function tearDown(): void
    {
        @unlink($this->fakeSoffice);

        parent::tearDown();
    }

    public function test_without_libreoffice_the_preview_is_unavailable_and_nothing_is_queued(): void
    {
        config(['hr.libreoffice.binary' => null]);
        Queue::fake();

        $preview = app(HiringPreviewService::class)->request($this->makeHiring(), HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());

        $this->assertSame(HrDocumentPreview::STATUS_UNAVAILABLE, $preview->status);
        $this->assertSame('Предпросмотр недоступен: LibreOffice не установлен на сервере.', $preview->error);
        Queue::assertNothingPushed();
    }

    public function test_preview_is_queued_and_rendered_with_its_own_profile_and_timeout(): void
    {
        config(['hr.libreoffice.binary' => $this->fakeSoffice, 'hr.libreoffice.timeout' => 45]);
        Queue::fake();

        $preview = app(HiringPreviewService::class)->request($this->makeHiring(), HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());

        $this->assertSame(HrDocumentPreview::STATUS_PENDING, $preview->status);
        Storage::disk('local')->assertExists($preview->docx_path);
        Queue::assertPushed(RenderHrDocumentPreview::class, fn (RenderHrDocumentPreview $job) => $job->previewId === $preview->id);

        $profiles = [];
        Process::fake(function (PendingProcess $process) use (&$profiles) {
            $command = $process->command;
            $profiles[] = collect($command)->first(fn ($arg) => str_starts_with($arg, '-env:UserInstallation=file://'));
            $this->assertSame(55, $process->timeout);
            if (is_executable('/usr/bin/timeout')) {
                $this->assertSame(['/usr/bin/timeout', '--kill-after=5', '45'], array_slice($command, 0, 3));
            }
            $docx = end($command);
            file_put_contents(dirname($docx).'/'.pathinfo($docx, PATHINFO_FILENAME).'.pdf', '%PDF-1.4 fake');

            return Process::result();
        });

        (new RenderHrDocumentPreview($preview->id))->handle(app(HiringPreviewService::class));
        $second = app(HiringPreviewService::class)->request($preview->hiring, HrDocumentTemplate::TYPE_ORDER, $this->hrUser());
        (new RenderHrDocumentPreview($second->id))->handle(app(HiringPreviewService::class));

        $preview->refresh();
        $this->assertSame(HrDocumentPreview::STATUS_READY, $preview->status);
        Storage::disk('local')->assertExists($preview->pdf_path);
        $this->assertCount(2, $profiles);
        $this->assertNotSame($profiles[0], $profiles[1], 'every run must use its own LibreOffice profile');
    }

    public function test_timeout_marks_the_preview_failed(): void
    {
        config(['hr.libreoffice.binary' => $this->fakeSoffice, 'hr.libreoffice.timeout' => 30]);
        Queue::fake();
        $preview = app(HiringPreviewService::class)->request($this->makeHiring(), HrDocumentTemplate::TYPE_CONTRACT, $this->hrUser());

        Process::fake(fn () => Process::result(exitCode: 124));
        (new RenderHrDocumentPreview($preview->id))->handle(app(HiringPreviewService::class));

        $this->assertSame(HrDocumentPreview::STATUS_FAILED, $preview->fresh()->status);
        $this->assertSame('Предпросмотр не построен: LibreOffice не ответил за 30 с.', $preview->fresh()->error);
    }

    public function test_a_new_request_replaces_the_previous_preview_and_old_ones_are_pruned(): void
    {
        config(['hr.libreoffice.binary' => $this->fakeSoffice]);
        Queue::fake();
        $service = app(HiringPreviewService::class);
        $hiring = $this->makeHiring();
        $user = $this->hrUser();

        $first = $service->request($hiring, HrDocumentTemplate::TYPE_CONTRACT, $user);
        $second = $service->request($hiring, HrDocumentTemplate::TYPE_CONTRACT, $user);

        $this->assertNull(HrDocumentPreview::query()->find($first->id));
        Storage::disk('local')->assertMissing($first->docx_path);

        $this->travel(25)->hours();
        $this->artisan('hr:prune-previews')->expectsOutput('Deleted HR document previews: 1')->assertSuccessful();
        Storage::disk('local')->assertMissing($second->docx_path);
    }
}

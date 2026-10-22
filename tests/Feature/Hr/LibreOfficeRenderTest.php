<?php

namespace Tests\Feature\Hr;

use App\Models\HrDocumentPreview;
use App\Models\HrDocumentTemplate;
use App\Models\HrEmploymentContract;
use App\Services\Hr\HiringPreviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Hr\Concerns\BuildsHirings;
use Tests\TestCase;

/**
 * Real LibreOffice conversion of all document types. Skipped unless HR_LIBREOFFICE_BINARY points to soffice;
 * with HR_RENDER_OUT set, the PDFs are copied there for a visual check.
 */
class LibreOfficeRenderTest extends TestCase
{
    use BuildsHirings;
    use RefreshDatabase;

    public function test_documents_convert_to_pdf_with_libreoffice(): void
    {
        $binary = getenv('HR_LIBREOFFICE_BINARY');
        if (! $binary || ! is_executable($binary)) {
            $this->markTestSkipped('HR_LIBREOFFICE_BINARY is not set');
        }

        config(['hr.libreoffice.binary' => $binary]);
        Storage::fake('local');
        Queue::fake();
        $service = app(HiringPreviewService::class);
        $user = $this->hrUser();

        $cases = [
            'contract-1y' => [$this->makeHiring(), HrDocumentTemplate::TYPE_CONTRACT],
            'contract-indefinite-aup-secondary' => [$this->makeHiring(['iin' => '940512300029'], ['probation_months' => 0], ['term' => HrEmploymentContract::TERM_INDEFINITE, 'schedule' => 'aup', 'employment' => 'secondary', 'vacation_days' => 24]), HrDocumentTemplate::TYPE_CONTRACT],
            'contract-replacement-shift' => [$this->makeHiring(['iin' => '940512300039'], ['replaces_full_name' => 'Иманова Сауле Ериковна'], ['term' => HrEmploymentContract::TERM_REPLACEMENT, 'schedule' => 'shift']), HrDocumentTemplate::TYPE_CONTRACT],
            'order' => [$this->makeHiring(['iin' => '940512300049']), HrDocumentTemplate::TYPE_ORDER],
            'card' => [$this->makeHiring(['iin' => '940512300059']), HrDocumentTemplate::TYPE_CARD],
        ];

        foreach ($cases as $name => [$hiring, $type]) {
            $preview = $service->request($hiring, $type, $user, ['sensitive' => true]);
            $service->render($preview);
            $preview->refresh();

            $this->assertSame(HrDocumentPreview::STATUS_READY, $preview->status, $name.': '.$preview->error);
            $this->assertStringStartsWith('%PDF', Storage::disk('local')->get($preview->pdf_path));

            if ($out = getenv('HR_RENDER_OUT')) {
                @mkdir($out, 0777, true);
                copy(Storage::disk('local')->path($preview->pdf_path), "{$out}/{$name}.pdf");
                copy(Storage::disk('local')->path($preview->docx_path), "{$out}/{$name}.docx");
            }
        }
    }
}

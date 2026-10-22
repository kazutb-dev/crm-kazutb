<?php

namespace App\Jobs;

use App\Models\HrDocumentPreview;
use App\Services\Hr\HiringPreviewService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Renders one hiring document preview to PDF with LibreOffice. The converter has its own timeout
 * (HR_LIBREOFFICE_TIMEOUT); the job timeout stays above it and below the cron worker's 120 s.
 */
class RenderHrDocumentPreview implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 100;

    public function __construct(public string $previewId) {}

    public function handle(HiringPreviewService $service): void
    {
        $preview = HrDocumentPreview::query()->find($this->previewId);

        if ($preview === null || $preview->status !== HrDocumentPreview::STATUS_PENDING) {
            return;
        }

        $service->render($preview);
    }

    public function failed(?Throwable $exception): void
    {
        HrDocumentPreview::query()
            ->whereKey($this->previewId)
            ->where('status', HrDocumentPreview::STATUS_PENDING)
            ->update([
                'status' => HrDocumentPreview::STATUS_FAILED,
                'error' => 'Предпросмотр не построен. Нажмите «Обновить» ещё раз.',
                'updated_at' => now(),
            ]);
    }
}

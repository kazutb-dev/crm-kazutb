<?php

namespace App\Services\Hr;

use App\Jobs\RenderHrDocumentPreview;
use App\Models\HrDocumentPreview;
use App\Models\HrHiring;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * PDF preview of a hiring document: the .docx is filled now, LibreOffice renders it in the queue.
 * Without LibreOffice the preview is "unavailable" and nothing is queued; .docx downloads are unaffected.
 */
class HiringPreviewService
{
    public function __construct(
        private readonly HiringDocumentGenerator $generator,
        private readonly DocxToPdfConverter $converter,
        private readonly HrAuditLogger $audit,
    ) {}

    /**
     * @param  array{executor?: ?string, sensitive?: bool}  $options
     */
    public function request(HrHiring $hiring, string $type, User $user, array $options = []): HrDocumentPreview
    {
        // One preview per hiring, document and person: older files go away with their rows.
        HrDocumentPreview::query()
            ->where('hiring_id', $hiring->id)
            ->where('type', $type)
            ->where('user_id', $user->id)
            ->get()
            ->each(fn (HrDocumentPreview $old) => $this->delete($old));

        if (! $this->converter->isAvailable()) {
            return HrDocumentPreview::query()->create([
                'hiring_id' => $hiring->id,
                'user_id' => $user->id,
                'type' => $type,
                'status' => HrDocumentPreview::STATUS_UNAVAILABLE,
                'error' => 'Предпросмотр недоступен: LibreOffice не установлен на сервере.',
            ]);
        }

        $id = (string) Str::uuid();
        $docxPath = "hr/previews/{$id}.docx";
        $tmp = $this->generator->renderToTemp($hiring, $type, $user, $options);
        try {
            Storage::disk(config('hr.disk'))->put($docxPath, file_get_contents($tmp));
        } finally {
            @unlink($tmp);
        }

        $preview = HrDocumentPreview::query()->create([
            'id' => $id,
            'hiring_id' => $hiring->id,
            'user_id' => $user->id,
            'type' => $type,
            'status' => HrDocumentPreview::STATUS_PENDING,
            'docx_path' => $docxPath,
        ]);

        $this->audit->preview($hiring, $type, $user);
        RenderHrDocumentPreview::dispatch($preview->id);

        return $preview;
    }

    /**
     * Runs in the queue job.
     */
    public function render(HrDocumentPreview $preview): void
    {
        $disk = Storage::disk(config('hr.disk'));

        try {
            $pdf = $this->converter->convert($disk->path($preview->docx_path));
            $preview->forceFill([
                'status' => HrDocumentPreview::STATUS_READY,
                'pdf_path' => 'hr/previews/'.basename($pdf),
                'error' => null,
            ])->save();
        } catch (\RuntimeException $e) {
            $preview->forceFill(['status' => HrDocumentPreview::STATUS_FAILED, 'error' => $e->getMessage()])->save();
        }
    }

    public function delete(HrDocumentPreview $preview): void
    {
        $disk = Storage::disk(config('hr.disk'));
        foreach ([$preview->docx_path, $preview->pdf_path] as $path) {
            if ($path) {
                $disk->delete($path);
            }
        }
        $preview->delete();
    }

    /** Removes previews older than the configured lifetime; returns how many. */
    public function prune(): int
    {
        $count = 0;
        HrDocumentPreview::query()
            ->where('created_at', '<', now()->subHours(max(1, (int) config('hr.preview_ttl_hours'))))
            ->get()
            ->each(function (HrDocumentPreview $preview) use (&$count): void {
                $this->delete($preview);
                $count++;
            });

        return $count;
    }
}

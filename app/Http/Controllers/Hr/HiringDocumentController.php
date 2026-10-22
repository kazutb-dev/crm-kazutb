<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrDocument;
use App\Models\HrDocumentPreview;
use App\Models\HrDocumentTemplate;
use App\Models\HrHiring;
use App\Services\Hr\Docx\HrTemplateException;
use App\Services\Hr\HiringDocumentGenerator;
use App\Services\Hr\HiringPreviewService;
use App\Services\Hr\HiringService;
use App\Services\Hr\HrAccess;
use App\Services\Hr\HrAuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Generated documents (versions, download, signing with the scan) and PDF previews of a hiring.
 * Documents and previews are bound through the hiring, so ids of another hiring give 404;
 * a preview is also private to the person who requested it.
 */
class HiringDocumentController extends Controller
{
    private const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    private const NO_CACHE = ['Cache-Control' => 'private, no-store, max-age=0', 'X-Content-Type-Options' => 'nosniff'];

    public function __construct(
        private readonly HiringDocumentGenerator $generator,
        private readonly HiringPreviewService $previews,
        private readonly HiringService $hirings,
        private readonly HrAccess $access,
        private readonly HrAuditLogger $audit,
    ) {}

    public function generate(Request $request, HrHiring $hiring, string $type): JsonResponse|RedirectResponse
    {
        $data = $request->validate(['executor' => ['nullable', 'string', 'max:100']]);

        try {
            $document = $this->generator->generate($hiring, $type, $request->user(), [
                'executor' => $data['executor'] ?? null,
                'sensitive' => $this->access->canViewSensitive($request->user()),
            ]);
        } catch (HrTemplateException $e) {
            return $request->expectsJson()
                ? response()->json(['message' => $e->getMessage()], 422)
                : Redirect::back()->with('error', $e->getMessage());
        }

        if ($request->expectsJson()) {
            return response()->json([
                'document' => [
                    'id' => $document->id,
                    'version' => $document->version,
                    'download_url' => route('hr.hiring.documents.download', [$hiring, $document]),
                ],
                'documents' => $this->hirings->documents($hiring, $request->user()),
            ], 201);
        }

        return Redirect::back()->with('success', HrDocumentTemplate::TYPE_LABELS[$type].': сформирована версия '.$document->version.'.');
    }

    public function download(Request $request, HrHiring $hiring, HrDocument $document): StreamedResponse
    {
        abort_unless(Storage::disk(config('hr.disk'))->exists($document->file_path), 404);
        $this->audit->document(HrAuditLogger::DOCUMENT_DOWNLOADED, $document, $request->user());

        return Storage::disk(config('hr.disk'))->download($document->file_path, $document->downloadName(), self::NO_CACHE + ['Content-Type' => self::DOCX_MIME]);
    }

    /** «Подписан»: the scan of the signed copy is required; the version becomes final. */
    public function sign(Request $request, HrHiring $hiring, HrDocument $document): RedirectResponse
    {
        if ($document->isSigned()) {
            return Redirect::back()->with('warning', 'Эта версия уже отмечена подписанной.');
        }

        $request->validate(['scan' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:20480']], [
            'scan.required' => 'Приложите скан подписанного документа.',
            'scan.mimes' => 'Скан — PDF, JPG или PNG.',
            'scan.max' => 'Скан не больше 20 МБ.',
        ]);

        $file = $request->file('scan');
        $path = $file->storeAs("hr/documents/{$hiring->id}", "signed-{$document->type}-v{$document->version}-".Str::random(8).'.'.$file->guessExtension(), config('hr.disk'));

        $this->generator->markSigned($document, $request->user(), $path);
        $this->hirings->refreshStatus($hiring);

        return Redirect::back()->with('success', HrDocumentTemplate::TYPE_LABELS[$document->type].' v'.$document->version.' отмечен подписанным.');
    }

    public function scan(Request $request, HrHiring $hiring, HrDocument $document): StreamedResponse
    {
        abort_unless($document->signed_scan_path && Storage::disk(config('hr.disk'))->exists($document->signed_scan_path), 404);
        $this->audit->document(HrAuditLogger::DOCUMENT_SCAN_OPENED, $document, $request->user());

        return Storage::disk(config('hr.disk'))->response($document->signed_scan_path, 'signed-'.$document->id.'.'.pathinfo($document->signed_scan_path, PATHINFO_EXTENSION), self::NO_CACHE, 'inline');
    }

    public function storePreview(Request $request, HrHiring $hiring, string $type): JsonResponse
    {
        try {
            $preview = $this->previews->request($hiring, $type, $request->user(), [
                'sensitive' => $this->access->canViewSensitive($request->user()),
            ]);
        } catch (HrTemplateException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['preview' => $this->previewPayload($hiring, $preview)], 201);
    }

    public function showPreview(Request $request, HrHiring $hiring, HrDocumentPreview $preview): JsonResponse
    {
        abort_unless($preview->user_id === $request->user()->id, 404);

        return response()->json(['preview' => $this->previewPayload($hiring, $preview)]);
    }

    public function previewPdf(Request $request, HrHiring $hiring, HrDocumentPreview $preview): StreamedResponse
    {
        abort_unless($preview->user_id === $request->user()->id && $preview->status === HrDocumentPreview::STATUS_READY, 404);
        abort_unless($preview->pdf_path && Storage::disk(config('hr.disk'))->exists($preview->pdf_path), 404);
        $this->audit->preview($hiring, $preview->type, $request->user(), HrAuditLogger::PREVIEW_OPENED);

        return Storage::disk(config('hr.disk'))->response($preview->pdf_path, 'preview.pdf', self::NO_CACHE + ['Content-Type' => 'application/pdf'], 'inline');
    }

    /**
     * @return array<string, mixed>
     */
    private function previewPayload(HrHiring $hiring, HrDocumentPreview $preview): array
    {
        return [
            'id' => $preview->id,
            'type' => $preview->type,
            'status' => $preview->status,
            'error' => $preview->error,
            'status_url' => route('hr.hiring.previews.show', [$hiring, $preview]),
            'pdf_url' => $preview->status === HrDocumentPreview::STATUS_READY ? route('hr.hiring.previews.pdf', [$hiring, $preview]) : null,
        ];
    }
}

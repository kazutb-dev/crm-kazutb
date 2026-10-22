<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrEmployeeAttachment;
use App\Models\HrHiring;
use App\Services\Hr\HrAuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Photo and PDF scans of the personal file. Files live on the private HR disk and are streamed only
 * through these routes; an attachment is looked up through the hiring (scoped binding), so another
 * employee's file cannot be reached by changing the id. Opening a scan needs the hr.sensitive right.
 */
class HiringFileController extends Controller
{
    private const NO_CACHE = ['Cache-Control' => 'private, no-store, max-age=0', 'X-Content-Type-Options' => 'nosniff'];

    public function __construct(private readonly HrAuditLogger $audit) {}

    public function storePhoto(Request $request, HrHiring $hiring): JsonResponse
    {
        $request->validate(['photo' => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:5120']], [
            'photo.required' => 'Выберите файл фото.',
            'photo.mimes' => 'Фото — JPG или PNG.',
            'photo.max' => 'Фото не больше 5 МБ.',
        ]);

        $employee = $hiring->employee;
        $disk = Storage::disk(config('hr.disk'));
        $old = $employee->photo_path;
        $file = $request->file('photo');
        $path = $file->storeAs("hr/employees/{$employee->id}", 'photo-'.Str::random(12).'.'.$file->guessExtension(), config('hr.disk'));

        $employee->forceFill(['photo_path' => $path, 'updated_by' => $request->user()->id])->save();
        if ($old && $old !== $path) {
            $disk->delete($old);
        }
        $this->audit->hiring(HrAuditLogger::PHOTO_UPLOADED, $hiring, 'Загружено фото (приём #'.$hiring->id.')', [], $request->user());

        return response()->json(['photo_url' => route('hr.hiring.photo.show', [$hiring, 'v' => substr(md5($path), 0, 8)])]);
    }

    public function showPhoto(HrHiring $hiring): StreamedResponse
    {
        $path = $hiring->employee->photo_path;
        abort_unless($path && Storage::disk(config('hr.disk'))->exists($path), 404);

        return Storage::disk(config('hr.disk'))->response($path, 'photo.'.pathinfo($path, PATHINFO_EXTENSION), self::NO_CACHE);
    }

    public function destroyPhoto(Request $request, HrHiring $hiring): JsonResponse
    {
        $employee = $hiring->employee;
        if ($employee->photo_path) {
            Storage::disk(config('hr.disk'))->delete($employee->photo_path);
            $employee->forceFill(['photo_path' => null])->save();
            $this->audit->hiring(HrAuditLogger::PHOTO_DELETED, $hiring, 'Удалено фото (приём #'.$hiring->id.')', [], $request->user());
        }

        return response()->json(['photo_url' => null]);
    }

    public function storeAttachment(Request $request, HrHiring $hiring): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
            'doc_type' => ['required', Rule::in(array_keys(HrEmployeeAttachment::DOC_TYPES))],
        ], [
            'file.required' => 'Выберите PDF-файл.',
            'file.mimes' => 'Прикрепляются только PDF-файлы.',
            'file.max' => 'Файл не больше 20 МБ.',
            'doc_type.required' => 'Выберите вид документа.',
            'doc_type.in' => 'Выберите вид документа из списка.',
        ]);

        $employee = $hiring->employee;
        $file = $request->file('file');
        $path = $file->storeAs("hr/employees/{$employee->id}/attachments", Str::random(24).'.pdf', config('hr.disk'));

        $attachment = $employee->attachments()->create([
            'doc_type' => $data['doc_type'],
            'original_name' => Str::limit($file->getClientOriginalName(), 200, ''),
            'file_path' => $path,
            'size' => $file->getSize(),
            'sha256' => hash_file('sha256', Storage::disk(config('hr.disk'))->path($path)),
            'uploaded_by' => $request->user()->id,
        ]);
        $this->audit->hiring(HrAuditLogger::ATTACHMENT_UPLOADED, $hiring, 'Прикреплён PDF: '.$attachment->docTypeLabel(), ['attachment_id' => $attachment->id], $request->user());

        return response()->json(['attachment' => [
            'id' => $attachment->id,
            'doc_type' => $attachment->doc_type,
            'doc_type_label' => $attachment->docTypeLabel(),
            'original_name' => $attachment->original_name,
            'size' => $attachment->size,
            'uploaded_at' => $attachment->created_at?->format('d.m.Y H:i'),
            'url' => null,
        ]], 201);
    }

    public function showAttachment(Request $request, HrHiring $hiring, HrEmployeeAttachment $attachment): StreamedResponse
    {
        abort_unless(Storage::disk(config('hr.disk'))->exists($attachment->file_path), 404);
        $this->audit->hiring(HrAuditLogger::ATTACHMENT_OPENED, $hiring, 'Открыт PDF: '.$attachment->docTypeLabel(), ['attachment_id' => $attachment->id], $request->user());

        return Storage::disk(config('hr.disk'))->response($attachment->file_path, 'document-'.$attachment->id.'.pdf', self::NO_CACHE + ['Content-Type' => 'application/pdf'], 'inline');
    }

    public function destroyAttachment(Request $request, HrHiring $hiring, HrEmployeeAttachment $attachment): JsonResponse
    {
        Storage::disk(config('hr.disk'))->delete($attachment->file_path);
        $attachment->delete();
        $this->audit->hiring(HrAuditLogger::ATTACHMENT_DELETED, $hiring, 'Удалён PDF: '.$attachment->docTypeLabel(), ['attachment_id' => $attachment->id], $request->user());

        return response()->json(['deleted' => true]);
    }
}

<?php

namespace App\Services\Hr;

use App\Models\HrDocument;
use App\Models\HrDocumentPreview;
use App\Models\HrEmployee;
use App\Models\HrHiring;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Deleted drafts hold personal data. Their files go at once (documents, previews and — when the person has no
 * other hiring — photo and scans); the records stay soft-deleted for RETENTION_DAYS and are then purged by
 * `hr:purge-deleted`. The IIN is released immediately so the person can be hired again.
 */
class HiringCleanup
{
    public const RETENTION_DAYS = 30;

    public function __construct(private readonly HrAuditLogger $audit) {}

    public function deleteDraft(HrHiring $hiring, User $user): void
    {
        DB::transaction(function () use ($hiring): void {
            $this->deleteHiringFiles($hiring);
            $hiring->delete();

            $employee = $hiring->employee;
            if ($employee !== null && ! $employee->hirings()->exists()) {
                $this->deleteEmployeeFiles($employee);
                $employee->forceFill(['iin_hash' => null, 'photo_path' => null])->save();
                $employee->delete();
            }
        });

        $this->audit->hiring(HrAuditLogger::HIRING_DELETED, $hiring, 'Удалён черновик приёма #'.$hiring->id.' (файлы удалены, запись — через '.self::RETENTION_DAYS.' дней)', [], $user);
    }

    /**
     * Purges records deleted more than RETENTION_DAYS ago; returns [hirings, employees].
     *
     * @return array{int, int}
     */
    public function purge(): array
    {
        $before = now()->subDays(self::RETENTION_DAYS);
        $hirings = 0;
        $employees = 0;

        HrHiring::onlyTrashed()->where('deleted_at', '<', $before)->with('employee')->get()
            ->each(function (HrHiring $hiring) use (&$hirings): void {
                $this->deleteHiringFiles($hiring);
                $hiring->forceDelete();
                $hirings++;
            });

        HrEmployee::onlyTrashed()->where('deleted_at', '<', $before)->get()
            ->each(function (HrEmployee $employee) use (&$employees): void {
                if (HrHiring::withTrashed()->where('employee_id', $employee->id)->exists()) {
                    return;
                }
                $this->deleteEmployeeFiles($employee);
                $employee->forceDelete();
                $employees++;
            });

        if ($hirings > 0 || $employees > 0) {
            $this->audit->module(HrAuditLogger::HIRING_PURGED, 'HrHiring', null,
                "Окончательно удалены черновики: приёмов {$hirings}, сотрудников {$employees}", ['hirings' => $hirings, 'employees' => $employees]);
        }

        return [$hirings, $employees];
    }

    private function deleteHiringFiles(HrHiring $hiring): void
    {
        $disk = Storage::disk(config('hr.disk'));

        HrDocument::query()->where('hiring_id', $hiring->id)->get(['file_path', 'signed_scan_path'])
            ->each(fn (HrDocument $document) => $disk->delete(array_filter([$document->file_path, $document->signed_scan_path])));
        HrDocumentPreview::query()->where('hiring_id', $hiring->id)->get(['docx_path', 'pdf_path'])
            ->each(fn (HrDocumentPreview $preview) => $disk->delete(array_filter([$preview->docx_path, $preview->pdf_path])));
        HrDocumentPreview::query()->where('hiring_id', $hiring->id)->delete();
        $disk->deleteDirectory("hr/documents/{$hiring->id}");
    }

    private function deleteEmployeeFiles(HrEmployee $employee): void
    {
        $disk = Storage::disk(config('hr.disk'));

        $disk->delete(array_filter(array_merge([$employee->photo_path], $employee->attachments()->pluck('file_path')->all())));
        $disk->deleteDirectory("hr/employees/{$employee->id}");
    }
}

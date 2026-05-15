<?php

namespace App\Services;

use App\Exceptions\Kpi\KpiEntryStatusException;
use App\Models\KpiEntry;
use App\Models\KpiEntryFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class KpiEntryFileService
{
    public function upload(KpiEntry $entry, UploadedFile $file, ?int $uploadedBy): KpiEntryFile
    {
        if (!$entry->canBeEdited()) {
            throw new KpiEntryStatusException('Для approved/locked записи нельзя загружать файлы.');
        }

        return DB::transaction(function () use ($entry, $file, $uploadedBy): KpiEntryFile {
            $disk = 'public';
            $path = $file->store('kpi/entries/' . $entry->id, $disk);

            return KpiEntryFile::query()->create([
                'kpi_entry_id' => $entry->id,
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_disk' => $disk,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'uploaded_by' => $uploadedBy,
            ]);
        });
    }

    public function purgeForEntry(KpiEntry $entry): void
    {
        DB::transaction(function () use ($entry): void {
            $files = KpiEntryFile::query()
                ->where('kpi_entry_id', $entry->id)
                ->get();

            foreach ($files as $file) {
                if (!empty($file->file_path)) {
                    Storage::disk($file->file_disk ?: 'public')->delete($file->file_path);
                }

                $file->delete();
            }
        });
    }
}

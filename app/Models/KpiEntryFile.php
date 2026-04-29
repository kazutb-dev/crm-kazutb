<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class KpiEntryFile extends Model
{
    use HasFactory;

    /**
     * @var string
     */
    protected $table = 'kpi_entry_files';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'kpi_entry_id',
        'file_path',
        'file_name',
        'file_disk',
        'file_type',
        'file_size',
        'uploaded_by',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'kpi_entry_id' => 'integer',
        'file_size' => 'integer',
        'uploaded_by' => 'integer',
    ];

    /**
     * @var list<string>
     */
    protected $appends = [
        'file_url',
    ];

    public function entry(): BelongsTo
    {
        return $this->belongsTo(KpiEntry::class, 'kpi_entry_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function getFileUrlAttribute(): ?string
    {
        if ($this->file_path === null || $this->file_path === '') {
            return null;
        }

        return Storage::disk($this->file_disk)->url($this->file_path);
    }
}

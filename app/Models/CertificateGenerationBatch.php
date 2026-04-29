<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CertificateGenerationBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_version_id',
        'source_type',
        'source_file_path',
        'total_rows',
        'success_rows',
        'failed_rows',
        'status',
        'created_by',
    ];

    protected $casts = [
        'total_rows' => 'integer',
        'success_rows' => 'integer',
        'failed_rows' => 'integer',
    ];

    public function templateVersion(): BelongsTo
    {
        return $this->belongsTo(CertificateTemplateVersion::class, 'template_version_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(CertificateGenerationBatchItem::class, 'batch_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

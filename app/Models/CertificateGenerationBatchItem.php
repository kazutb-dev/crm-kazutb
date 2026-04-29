<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CertificateGenerationBatchItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'batch_id',
        'row_index',
        'payload_json',
        'result_certificate_id',
        'status',
        'error_message',
    ];

    protected $casts = [
        'row_index' => 'integer',
        'payload_json' => 'array',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(CertificateGenerationBatch::class, 'batch_id');
    }

    public function resultCertificate(): BelongsTo
    {
        return $this->belongsTo(Certificate::class, 'result_certificate_id');
    }
}

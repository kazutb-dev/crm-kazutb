<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Certificate extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_GENERATED = 'generated';
    public const STATUS_ISSUED = 'issued';
    public const STATUS_REVOKED = 'revoked';

    protected $fillable = [
        'template_id',
        'template_version_id',
        'certificate_number',
        'recipient_full_name',
        'topic',
        'optional_json',
        'qr_payload',
        'status',
        'file_pdf_path',
        'file_png_path',
        'checksum_sha256',
        'generated_at',
        'issued_at',
        'revoked_at',
        'revoked_reason',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'optional_json' => 'array',
        'generated_at' => 'datetime',
        'issued_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(CertificateTemplate::class, 'template_id');
    }

    public function templateVersion(): BelongsTo
    {
        return $this->belongsTo(CertificateTemplateVersion::class, 'template_version_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}

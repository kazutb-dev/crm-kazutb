<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A generated document version. Each generation creates a new row and file; a signed version is never overwritten.
 */
class HrDocument extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SIGNED = 'signed';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'hiring_id',
        'type',
        'version',
        'template_id',
        'file_path',
        'sha256',
        'status',
        'oup_executor',
        'missing_fields',
        'warnings',
        'generated_by',
        'signed_at',
        'signed_by',
        'signed_scan_path',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'missing_fields' => 'array',
            'warnings' => 'array',
            'signed_at' => 'datetime',
        ];
    }

    public function hiring(): BelongsTo
    {
        return $this->belongsTo(HrHiring::class, 'hiring_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(HrDocumentTemplate::class, 'template_id');
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function signer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signed_by');
    }

    public function isSigned(): bool
    {
        return $this->status === self::STATUS_SIGNED;
    }

    /** «Трудовой договор №412 (v2).docx» style download name without personal data. */
    public function downloadName(): string
    {
        return HrDocumentTemplate::TYPE_LABELS[$this->type].' (приём '.$this->hiring_id.', v'.$this->version.').docx';
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CertificateTemplateVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_id',
        'version',
        'background_path',
        'canvas_width',
        'canvas_height',
        'dpi',
        'layout_json',
        'text_rules_json',
        'qr_rules_json',
        'is_published',
        'published_at',
        'created_by',
    ];

    protected $casts = [
        'canvas_width' => 'integer',
        'canvas_height' => 'integer',
        'dpi' => 'integer',
        'layout_json' => 'array',
        'text_rules_json' => 'array',
        'qr_rules_json' => 'array',
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(CertificateTemplate::class, 'template_id');
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class, 'template_version_id');
    }

    public function generationBatches(): HasMany
    {
        return $this->hasMany(CertificateGenerationBatch::class, 'template_version_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

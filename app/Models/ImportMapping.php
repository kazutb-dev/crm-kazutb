<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportMapping extends Model
{
    protected $fillable = [
        'import_job_id',
        'source_field',
        'target_field',
        'mapping_kind',
        'transform_rule',
        'is_required',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'import_job_id' => 'integer',
            'is_required' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function importJob(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class, 'import_job_id');
    }
}

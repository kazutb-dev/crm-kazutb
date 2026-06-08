<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportValidation extends Model
{
    protected $fillable = [
        'import_job_id',
        'validation_key',
        'severity',
        'status',
        'message',
        'row_number',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'import_job_id' => 'integer',
            'row_number' => 'integer',
            'payload' => 'array',
        ];
    }

    public function importJob(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class, 'import_job_id');
    }
}

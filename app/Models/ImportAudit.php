<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportAudit extends Model
{
    protected $fillable = [
        'import_job_id',
        'actor_user_id',
        'action',
        'message',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'import_job_id' => 'integer',
            'actor_user_id' => 'integer',
            'payload' => 'array',
        ];
    }

    public function importJob(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class, 'import_job_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}

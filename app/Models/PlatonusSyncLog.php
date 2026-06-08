<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlatonusSyncLog extends Model
{
    protected $table = 'platonus_sync_logs';

    protected $fillable = [
        'entity_type',
        'direction',
        'status',
        'total_records',
        'created_records',
        'updated_records',
        'skipped_records',
        'failed_records',
        'error_message',
        'meta',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'meta'         => 'array',
        'started_at'   => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function conflicts(): HasMany
    {
        return $this->hasMany(PlatonusSyncConflict::class, 'sync_log_id');
    }
}

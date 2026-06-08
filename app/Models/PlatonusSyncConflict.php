<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatonusSyncConflict extends Model
{
    protected $table = 'platonus_sync_conflicts';

    protected $fillable = [
        'sync_log_id',
        'entity_type',
        'platonus_id',
        'field_name',
        'local_value',
        'remote_value',
        'resolution',
        'resolved_by',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function syncLog(): BelongsTo
    {
        return $this->belongsTo(PlatonusSyncLog::class, 'sync_log_id');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}

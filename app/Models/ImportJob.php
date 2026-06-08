<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportJob extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING = 'pending';
    public const STATUS_VALIDATING = 'validating';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_RUNNING = 'running';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'import_source_id',
        'requested_by',
        'approved_by',
        'target_domain',
        'target_entity',
        'status',
        'mode',
        'reason',
        'row_count',
        'valid_count',
        'invalid_count',
        'started_at',
        'finished_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'import_source_id' => 'integer',
            'requested_by' => 'integer',
            'approved_by' => 'integer',
            'row_count' => 'integer',
            'valid_count' => 'integer',
            'invalid_count' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(ImportSource::class, 'import_source_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}

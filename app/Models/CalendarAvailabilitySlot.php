<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CalendarAvailabilitySlot extends Model
{
    protected $fillable = [
        'user_id',
        'created_by',
        'date',
        'starts_at',
        'ends_at',
        'slot_duration_minutes',
        'buffer_minutes',
        'access_type',
        'min_rank_level',
        'recurrence_type',
        'recurrence_days',
        'recurrence_until',
        'is_active',
        'note',
    ];

    protected $casts = [
        'date' => 'date',
        'recurrence_days' => 'array',
        'recurrence_until' => 'date',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

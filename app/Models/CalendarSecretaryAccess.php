<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CalendarSecretaryAccess extends Model
{
    public $timestamps = false;

    protected $table = 'calendar_secretary_access';

    protected $fillable = [
        'manager_id',
        'secretary_id',
        'granted_at',
        'revoked_at',
        'is_active',
    ];

    protected $casts = [
        'granted_at' => 'datetime',
        'revoked_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function secretary(): BelongsTo
    {
        return $this->belongsTo(User::class, 'secretary_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserActivitySnapshot extends Model
{
    protected $table = 'user_activity_snapshots';

    protected $fillable = [
        'user_id',
        'last_seen_at',
        'last_ip_address',
        'last_route_name',
        'last_path',
        'last_user_agent',
        'last_activity_source',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
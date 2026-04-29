<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CalendarNotificationLog extends Model
{
    protected $table = 'calendar_notifications_log';

    public $timestamps = false;

    protected $fillable = [
        'event_id',
        'user_id',
        'channel',
        'type',
        'status',
        'sent_at',
        'payload',
        'error',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'payload' => 'array',
    ];
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CalendarAuditLog extends Model
{
    protected $table = 'calendar_audit_log';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'acting_for_id',
        'action',
        'subject_type',
        'subject_id',
        'changes',
        'ip_address',
        'created_at',
    ];

    protected $casts = [
        'changes' => 'array',
        'created_at' => 'datetime',
    ];
}

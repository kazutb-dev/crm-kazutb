<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CalendarEvent extends Model
{
    protected $fillable = [
        'organizer_id', 'attendee_id', 'title', 'type', 'color', 'description',
        'starts_at', 'ends_at', 'status', 'format', 'room',
        'zoom_meeting_id', 'zoom_join_url', 'priority_override',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
    ];

    protected $casts = [
        'starts_at'    => 'datetime',
        'ends_at'      => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function organizer() { return $this->belongsTo(\App\Models\User::class, 'organizer_id'); }
    public function attendee()  { return $this->belongsTo(\App\Models\User::class, 'attendee_id'); }
}

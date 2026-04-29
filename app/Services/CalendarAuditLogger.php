<?php

namespace App\Services;

use App\Models\CalendarAuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Throwable;

class CalendarAuditLogger
{
    public function log(Request $request, string $action, Model $subject, array $changes = [], ?int $actingForId = null): void
    {
        try {
            CalendarAuditLog::create([
                'user_id' => $request->user()?->id,
                'acting_for_id' => $actingForId,
                'action' => $action,
                'subject_type' => $subject::class,
                'subject_id' => $subject->getKey(),
                'changes' => $changes,
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }
}

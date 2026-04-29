<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE calendar_events MODIFY status ENUM('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'conflict') DEFAULT 'pending'");
        DB::statement("ALTER TABLE calendar_notifications_log MODIFY type ENUM('new_request', 'confirmed', 'declined', 'cancelled', 'reminder_60', 'reminder_30', 'reminder_15', 'rescheduled')");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE calendar_events MODIFY status ENUM('pending', 'confirmed', 'cancelled', 'completed', 'conflict') DEFAULT 'pending'");
        DB::statement("ALTER TABLE calendar_notifications_log MODIFY type ENUM('new_request', 'confirmed', 'cancelled', 'reminder_60', 'reminder_30', 'reminder_15', 'rescheduled')");
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->index(['organizer_id', 'starts_at'], 'calendar_events_organizer_starts_idx');
            $table->index(['attendee_id', 'starts_at'], 'calendar_events_attendee_starts_idx');
            $table->index(['status', 'starts_at'], 'calendar_events_status_starts_idx');
        });

        Schema::table('calendar_notifications_log', function (Blueprint $table) {
            $table->index(['event_id', 'user_id', 'type'], 'calendar_notifications_event_user_type_idx');
            $table->index(['status', 'sent_at'], 'calendar_notifications_status_sent_idx');
        });

        Schema::table('calendar_audit_log', function (Blueprint $table) {
            $table->index(['subject_type', 'subject_id'], 'calendar_audit_subject_idx');
            $table->index(['user_id', 'created_at'], 'calendar_audit_user_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('calendar_audit_log', function (Blueprint $table) {
            $table->dropIndex('calendar_audit_subject_idx');
            $table->dropIndex('calendar_audit_user_created_idx');
        });

        Schema::table('calendar_notifications_log', function (Blueprint $table) {
            $table->dropIndex('calendar_notifications_event_user_type_idx');
            $table->dropIndex('calendar_notifications_status_sent_idx');
        });

        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropIndex('calendar_events_organizer_starts_idx');
            $table->dropIndex('calendar_events_attendee_starts_idx');
            $table->dropIndex('calendar_events_status_starts_idx');
        });
    }
};

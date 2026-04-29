<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_notifications_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('calendar_events')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('channel', ['whatsapp', 'push', 'email']);
            $table->enum('type', ['new_request', 'confirmed', 'cancelled', 'reminder_60', 'reminder_30', 'reminder_15', 'rescheduled']);
            $table->enum('status', ['sent', 'failed', 'pending'])->default('pending');
            $table->datetime('sent_at')->nullable();
            $table->json('payload');
            $table->text('error')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_notifications_log');
    }
};

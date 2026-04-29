<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('organizer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('attendee_id')->constrained('users')->cascadeOnDelete();
            $table->datetime('starts_at');
            $table->datetime('ends_at');
            $table->enum('status', ['pending', 'confirmed', 'cancelled', 'completed', 'conflict'])->default('pending');
            $table->enum('format', ['offline', 'online'])->default('offline');
            $table->string('room', 100)->nullable();
            $table->string('zoom_meeting_id', 100)->nullable();
            $table->text('zoom_join_url')->nullable();
            $table->boolean('priority_override')->default(false);
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->datetime('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_events');
    }
};

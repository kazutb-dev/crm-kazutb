<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_availability_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->date('date')->nullable();
            $table->time('starts_at');
            $table->time('ends_at');
            $table->unsignedInteger('slot_duration_minutes')->default(30);
            $table->unsignedInteger('buffer_minutes')->default(0);
            $table->enum('access_type', ['open', 'invitation', 'rank'])->default('open');
            $table->unsignedTinyInteger('min_rank_level')->nullable();
            $table->enum('recurrence_type', ['once', 'weekly', 'daily'])->default('once');
            $table->json('recurrence_days')->nullable();
            $table->date('recurrence_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_availability_slots');
    }
};

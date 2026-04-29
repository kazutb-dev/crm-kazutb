<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->enum('type', [
                'meeting',       // Встреча
                'vacation',      // Отпуск
                'business_trip', // Командировка
                'sick_leave',    // Больничный
                'personal',      // Личное
                'remote',        // Удалённая работа
                'other',         // Другое
            ])->default('meeting')->after('title');

            // attendee_id can be null for personal/absence events
            $table->foreignId('attendee_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropColumn('type');
            $table->foreignId('attendee_id')->nullable(false)->change();
        });
    }
};

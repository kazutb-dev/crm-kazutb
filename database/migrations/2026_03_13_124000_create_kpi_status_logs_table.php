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
        Schema::create('kpi_status_logs', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('kpi_entry_id')
                ->constrained('kpi_entries')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);

            // Examples: submit, return, review, approve, reject, lock.
            $table->string('action', 30);

            $table->text('comment')->nullable();

            $table->foreignId('acted_by')
                ->constrained('users')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->timestamps();

            $table->index('kpi_entry_id', 'kpi_status_logs_entry_id_idx');
            $table->index('acted_by', 'kpi_status_logs_acted_by_idx');
            $table->index('action', 'kpi_status_logs_action_idx');
            $table->index('to_status', 'kpi_status_logs_to_status_idx');
            $table->index(['kpi_entry_id', 'created_at'], 'kpi_status_logs_entry_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_status_logs');
    }
};

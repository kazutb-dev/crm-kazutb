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
        Schema::create('kpi_periods', function (Blueprint $table): void {
            $table->id();

            // Link KPI period to the global academic year dictionary.
            $table->foreignId('academic_year_id')
                ->constrained('academic_years')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->string('name', 150);
            $table->enum('stage', ['plan', 'fact', 'review']);
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['draft', 'active', 'closed'])->default('draft');
            $table->text('description')->nullable();

            // Audit fields for who created/updated the period.
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->foreignId('updated_by')
                ->nullable()
                ->constrained('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index('academic_year_id', 'kpi_periods_academic_year_id_idx');
            $table->index('stage', 'kpi_periods_stage_idx');
            $table->index('status', 'kpi_periods_status_idx');

            // Avoid duplicate period names inside the same academic year.
            $table->unique(['academic_year_id', 'name'], 'kpi_periods_academic_year_name_uq');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_periods');
    }
};

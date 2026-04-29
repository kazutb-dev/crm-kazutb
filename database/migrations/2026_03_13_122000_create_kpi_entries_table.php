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
        Schema::create('kpi_entries', function (Blueprint $table): void {
            $table->id();

            // Context anchors.
            $table->foreignId('kpi_period_id')
                ->constrained('kpi_periods')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->foreignId('academic_year_id')
                ->constrained('academic_years')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            // KPI target level for this entry.
            $table->enum('entity_type', ['teacher', 'department_head', 'dean']);

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            // Optional organizational scope.
            $table->foreignId('faculty_id')
                ->nullable()
                ->constrained('faculties');

            $table->foreignId('department_id')
                ->nullable()
                ->constrained('departments');

            $table->foreignId('indicator_id')
                ->constrained('kpi_indicators')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            // PLAN/FACT values and score fields.
            $table->decimal('plan_value', 12, 2)->nullable();
            $table->decimal('fact_value', 12, 2)->nullable();
            $table->decimal('calculated_points', 10, 2)->default(0);
            $table->decimal('manual_points', 10, 2)->nullable();

            $table->text('comment')->nullable();

            $table->enum('status', [
                'draft',
                'submitted',
                'returned',
                'reviewed',
                'approved',
                'rejected',
                'locked',
            ])->default('draft');

            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Normalize nullable scope keys for strict unique index in MySQL.
            // MySQL allows multiple NULL values in unique indexes, so we use 0 as a canonical "no-scope" marker.
            $table->unsignedBigInteger('faculty_scope_id')
                ->storedAs('coalesce(faculty_id, 0)');
            $table->unsignedBigInteger('department_scope_id')
                ->storedAs('coalesce(department_id, 0)');

            $table->index('kpi_period_id', 'kpi_entries_period_id_idx');
            $table->index('academic_year_id', 'kpi_entries_academic_year_id_idx');
            $table->index('entity_type', 'kpi_entries_entity_type_idx');
            $table->index('user_id', 'kpi_entries_user_id_idx');
            $table->index('indicator_id', 'kpi_entries_indicator_id_idx');
            $table->index('faculty_id', 'kpi_entries_faculty_id_idx');
            $table->index('department_id', 'kpi_entries_department_id_idx');
            $table->index('status', 'kpi_entries_status_idx');
            $table->index(['kpi_period_id', 'status'], 'kpi_entries_period_status_idx');
            $table->index(['entity_type', 'status'], 'kpi_entries_entity_status_idx');

            // One KPI indicator per user/scope/entity inside one KPI period.
            $table->unique(
                [
                    'kpi_period_id',
                    'entity_type',
                    'user_id',
                    'faculty_scope_id',
                    'department_scope_id',
                    'indicator_id',
                ],
                'kpi_entries_unique_business_key'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_entries');
    }
};

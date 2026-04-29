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
        Schema::create('kpi_results', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('kpi_period_id')
                ->constrained('kpi_periods')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->foreignId('academic_year_id')
                ->constrained('academic_years')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->enum('result_type', ['user', 'department', 'faculty']);
            $table->enum('entity_type', ['teacher', 'department_head', 'dean'])->default('teacher');

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('faculty_id')
                ->nullable()
                ->constrained('faculties')
                ->nullOnDelete();

            $table->foreignId('department_id')
                ->nullable()
                ->constrained('departments')
                ->nullOnDelete();

            $table->unsignedInteger('approved_entries_count')->default(0);
            $table->json('section_scores')->nullable();

            $table->decimal('k1_score', 14, 2)->default(0);
            $table->decimal('k2_score', 14, 2)->default(0);
            $table->decimal('k3_score', 14, 2)->default(0);
            $table->decimal('k4_score', 14, 2)->default(0);
            $table->decimal('k5_score', 14, 2)->default(0);
            $table->decimal('k6_score', 14, 2)->default(0);

            $table->string('formula_name', 50)->default('rpps_v1');
            $table->decimal('rank_score', 14, 2)->default(0);
            $table->json('metadata')->nullable();
            $table->timestamp('calculated_at');

            $table->timestamps();

            $table->unsignedBigInteger('user_scope_id')
                ->storedAs('coalesce(user_id, 0)');
            $table->unsignedBigInteger('faculty_scope_id')
                ->storedAs('coalesce(faculty_id, 0)');
            $table->unsignedBigInteger('department_scope_id')
                ->storedAs('coalesce(department_id, 0)');

            $table->index(['kpi_period_id', 'result_type'], 'kpi_results_period_type_idx');
            $table->index(['academic_year_id', 'result_type'], 'kpi_results_year_type_idx');
            $table->index(['department_id', 'result_type'], 'kpi_results_department_type_idx');
            $table->index(['faculty_id', 'result_type'], 'kpi_results_faculty_type_idx');
            $table->index(['user_id', 'result_type'], 'kpi_results_user_type_idx');
            $table->index(['entity_type', 'rank_score'], 'kpi_results_entity_rank_idx');
            $table->index('calculated_at', 'kpi_results_calculated_at_idx');

            $table->unique(
                [
                    'kpi_period_id',
                    'result_type',
                    'entity_type',
                    'user_scope_id',
                    'faculty_scope_id',
                    'department_scope_id',
                ],
                'kpi_results_unique_business_key'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_results');
    }
};
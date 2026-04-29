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
        Schema::create('kpi_indicators', function (Blueprint $table): void {
            $table->id();

            // Target audience level for this KPI indicator.
            $table->enum('entity_type', ['teacher', 'department_head', 'dean']);

            // Business section (domain block) in KPI card.
            $table->enum('section', ['teaching', 'science', 'social', 'qualification', 'survey']);

            // Stable machine-readable key for integrations and formulas.
            $table->string('code', 100);
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('unit', 50)->nullable();

            $table->decimal('base_points', 10, 2)->default(0);

            // How the final value is produced: manual input, auto source, or formula engine.
            $table->enum('calculation_type', ['manual', 'auto', 'formula']);

            $table->boolean('requires_file')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['entity_type', 'code'], 'kpi_indicators_entity_code_uq');

            $table->index('entity_type', 'kpi_indicators_entity_type_idx');
            $table->index('section', 'kpi_indicators_section_idx');
            $table->index('calculation_type', 'kpi_indicators_calculation_type_idx');
            $table->index('is_active', 'kpi_indicators_is_active_idx');
            $table->index('sort_order', 'kpi_indicators_sort_order_idx');

            // Common listing/filtering path in UI and reporting.
            $table->index(['entity_type', 'section', 'is_active'], 'kpi_indicators_entity_section_active_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_indicators');
    }
};

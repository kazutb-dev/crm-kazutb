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
        Schema::table('kpi_indicators', function (Blueprint $table): void {
            $table->dropUnique('kpi_indicators_entity_section_code_uq');
            $table->index(['entity_type', 'section', 'code'], 'kpi_indicators_entity_section_code_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kpi_indicators', function (Blueprint $table): void {
            $table->dropIndex('kpi_indicators_entity_section_code_idx');
            $table->unique(['entity_type', 'section', 'code'], 'kpi_indicators_entity_section_code_uq');
        });
    }
};

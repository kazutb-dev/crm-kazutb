<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kpi_indicator_structural_unit', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kpi_indicator_id')
                ->constrained('kpi_indicators')
                ->onDelete('cascade');
            $table->foreignId('kpi_structural_unit_id')
                ->constrained('kpi_structural_units')
                ->onDelete('cascade');
            $table->timestamps();

            // Unique constraint with shorter name
            $table->unique(['kpi_indicator_id', 'kpi_structural_unit_id'], 'kpi_ind_unit_unique');
            
            // Indexes for faster queries
            $table->index('kpi_structural_unit_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kpi_indicator_structural_unit');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kpi_indicators', function (Blueprint $table): void {
            $table->foreignId('checker_structural_unit_id')
                ->nullable()
                ->after('checker_division_id')
                ->constrained('kpi_structural_units')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('kpi_indicators', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('checker_structural_unit_id');
        });
    }
};
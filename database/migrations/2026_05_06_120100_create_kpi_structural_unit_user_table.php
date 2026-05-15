<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kpi_structural_unit_user', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('kpi_structural_unit_id')->constrained('kpi_structural_units')->cascadeOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->unique(['user_id', 'kpi_structural_unit_id'], 'kpi_structural_unit_user_unique');
            $table->index('kpi_structural_unit_id', 'kpi_structural_unit_user_unit_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kpi_structural_unit_user');
    }
};
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
        Schema::create('kpi_structural_approvals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('kpi_entry_id')->constrained('kpi_entries')->cascadeOnDelete();
            $table->foreignId('structural_unit_id')->constrained('kpi_structural_units')->cascadeOnDelete();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('comment')->nullable();
            $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();
            $table->unique(['kpi_entry_id', 'structural_unit_id'], 'kpi_structural_approvals_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_structural_approvals');
    }
};

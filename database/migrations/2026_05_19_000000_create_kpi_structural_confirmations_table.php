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
        Schema::create('kpi_structural_confirmations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('kpi_record_id'); // ID KPI записи
            $table->unsignedBigInteger('structural_unit_id'); // ID структурного подразделения
            $table->unsignedBigInteger('confirmed_by')->nullable(); // Кто подтвердил/отклонил (user_id)
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('comment')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->unique(['kpi_record_id', 'structural_unit_id'], 'kpi_structural_unique');
            $table->foreign('kpi_record_id')->references('id')->on('kpi_records')->onDelete('cascade');
            $table->foreign('structural_unit_id')->references('id')->on('structural_units')->onDelete('cascade');
            $table->foreign('confirmed_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_structural_confirmations');
    }
};

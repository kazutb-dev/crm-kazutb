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
        Schema::create('kpi_access_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('permission', 50); // review_queue, approval_queue, structural_queue, indicators, analytics, periods
            $table->foreignId('granted_by')->constrained('users')->cascadeOnDelete();
            $table->datetime('granted_at');
            $table->boolean('is_active')->default(true);

            $table->unique(['user_id', 'permission']);
            $table->index(['user_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_access_grants');
    }
};

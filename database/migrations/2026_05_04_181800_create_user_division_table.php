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
        Schema::create('user_division', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('division_id')->constrained('divisions')->cascadeOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->unique(['user_id', 'division_id']);
            $table->index(['division_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_division');
    }
};

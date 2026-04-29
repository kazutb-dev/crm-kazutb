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
        Schema::create('topic_check_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('topic_check_id')->constrained('topic_checks')->cascadeOnDelete();
            $table->foreignId('matched_diploma_id')->nullable()->constrained('diplomas')->nullOnDelete();
            $table->string('original_title_ru');
            $table->decimal('score', 5, 4);
            $table->string('match_type', 20);
            $table->string('risk_level', 20);
            $table->timestamps();

            $table->index(['topic_check_id', 'score']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('topic_check_items');
    }
};

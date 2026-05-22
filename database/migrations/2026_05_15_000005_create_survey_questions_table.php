<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('survey_questions')) {
            return;
        }

        Schema::create('survey_questions', function (Blueprint $table) {
            $table->id();
            $table->string('text');
            $table->integer('order')->default(0);
            $table->enum('type', ['rating', 'text', 'multiple_choice'])->default('rating');
            $table->integer('min_rating')->default(1);
            $table->integer('max_rating')->default(5);
            $table->boolean('is_required')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('survey_questions');
    }
};

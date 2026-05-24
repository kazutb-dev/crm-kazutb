<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('survey_answers')) {
            return;
        }

        Schema::create('survey_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_id')->constrained('surveys')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('survey_questions')->cascadeOnDelete();
            $table->integer('rating_value')->nullable();
            $table->text('text_answer')->nullable();
            $table->string('selected_option')->nullable();
            $table->timestamps();
            $table->unique(['survey_id', 'question_id']);
            $table->index('survey_id');
            $table->index('question_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('survey_answers');
    }
};

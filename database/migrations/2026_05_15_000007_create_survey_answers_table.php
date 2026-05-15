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
        Schema::create('survey_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_id')->constrained('surveys')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('survey_questions')->cascadeOnDelete();
            $table->integer('rating_value')->nullable(); // Значение оценки (для рейтинговых вопросов)
            $table->text('text_answer')->nullable(); // Текстовый ответ
            $table->string('selected_option')->nullable(); // Выбранный вариант ответа
            $table->timestamps();
            $table->unique(['survey_id', 'question_id']);
            $table->index('survey_id');
            $table->index('question_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('survey_answers');
    }
};

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
        Schema::create('survey_questions', function (Blueprint $table) {
            $table->id();
            $table->string('text'); // Текст вопроса
            $table->integer('order')->default(0); // Порядок вопроса
            $table->enum('type', ['rating', 'text', 'multiple_choice'])->default('rating'); // Тип вопроса
            $table->integer('min_rating')->default(1); // Минимальная оценка
            $table->integer('max_rating')->default(5); // Максимальная оценка
            $table->boolean('is_required')->default(true); // Обязательный ли вопрос
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('survey_questions');
    }
};

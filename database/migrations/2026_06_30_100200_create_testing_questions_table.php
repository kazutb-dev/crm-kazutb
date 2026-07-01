<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('testing_questions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('test_id')->constrained('testing_tests')->cascadeOnDelete();
            $table->text('text');
            $table->string('type', 32)->default('single_choice');
            $table->json('options')->nullable();
            $table->json('correct_answers');
            $table->unsignedInteger('position')->default(1);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['test_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('testing_questions');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_ai_lessons', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('subject');
            $table->string('topic', 500);
            $table->string('language', 5)->default('ru');
            $table->string('audience')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->default(50);
            $table->unsignedTinyInteger('slides_count')->default(15);
            $table->unsignedTinyInteger('lecture_number')->nullable();
            $table->string('faculty_name')->nullable();
            $table->string('department_name')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('pending');
            $table->string('step', 20)->default('outline');
            $table->unsignedTinyInteger('step_attempts')->default(0);
            $table->json('outline')->nullable();
            $table->json('sections')->nullable();
            $table->json('presentation')->nullable();
            $table->json('images')->nullable();
            $table->string('model')->nullable();
            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_ai_lessons');
    }
};

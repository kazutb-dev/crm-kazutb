<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_ai_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 40);
            $table->string('title');
            $table->string('source', 10);
            $table->string('original_name')->nullable();
            $table->text('focus')->nullable();
            $table->longText('content_text');
            $table->unsignedInteger('content_chars')->default(0);
            $table->boolean('is_truncated')->default(false);
            $table->string('status', 20)->default('pending');
            $table->text('summary')->nullable();
            $table->json('key_points')->nullable();
            $table->json('findings')->nullable();
            $table->text('overall')->nullable();
            $table->string('model')->nullable();
            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_ai_reviews');
    }
};

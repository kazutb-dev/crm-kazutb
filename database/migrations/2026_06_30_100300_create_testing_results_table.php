<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('testing_results', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('test_id')->constrained('testing_tests')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('correct_answers_count')->default(0);
            $table->decimal('score', 5, 2)->default(0);
            $table->boolean('passed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->json('details')->nullable();
            $table->timestamps();

            $table->index(['test_id', 'completed_at']);
            $table->index(['user_id', 'completed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('testing_results');
    }
};

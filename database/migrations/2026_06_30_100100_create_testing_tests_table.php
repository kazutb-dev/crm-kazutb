<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('testing_tests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('binding_id')->constrained('testing_bindings')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('question_count')->default(1);
            $table->boolean('shuffle_questions')->default(false);
            $table->decimal('passing_score', 5, 2)->default(70);
            $table->unsignedInteger('time_limit_minutes')->nullable();
            $table->unsignedInteger('max_attempts')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->index(['binding_id', 'status']);
            $table->index(['binding_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('testing_tests');
    }
};

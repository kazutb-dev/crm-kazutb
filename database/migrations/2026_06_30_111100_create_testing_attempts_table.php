<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('testing_attempts', function (Blueprint $table): void {
            $table->id();
            $table->string('student_id')->index();
            $table->foreignId('test_id')->constrained('testing_tests')->cascadeOnDelete();
            $table->foreignId('teacher_binding_id')->constrained('testing_bindings')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('disciplines')->cascadeOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->decimal('score', 5, 2)->default(0);
            $table->decimal('percentage', 5, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('testing_attempts');
    }
};

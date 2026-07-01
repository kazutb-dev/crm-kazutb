<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('testing_student_bindings', function (Blueprint $table): void {
            $table->id();
            $table->string('student_id')->index();
            $table->foreignId('teacher_binding_id')->constrained('testing_bindings')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['student_id', 'teacher_binding_id'], 'student_teacher_binding_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('testing_student_bindings');
    }
};

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
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('first_name'); // Имя
            $table->string('last_name'); // Фамилия
            $table->string('middle_name')->nullable(); // Отчество
            $table->string('student_id')->unique(); // Номер студента
            $table->string('email')->nullable()->unique();
            $table->string('phone')->nullable();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->timestamps();
            $table->index('student_id');
            $table->index('group_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};

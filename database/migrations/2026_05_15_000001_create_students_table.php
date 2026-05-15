<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('middle_name')->nullable();
            $table->string('student_id')->unique();
            $table->string('email')->nullable()->unique();
            $table->string('phone')->nullable();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->timestamps();
            $table->index('student_id');
            $table->index('group_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};

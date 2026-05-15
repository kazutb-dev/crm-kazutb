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
        Schema::create('disciplines', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Название дисциплины
            $table->string('code')->unique(); // Код дисциплины
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // Преподаватель
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnDelete();
            $table->text('description')->nullable();
            $table->integer('credit_hours')->default(0);
            $table->timestamps();
            $table->index('user_id');
            $table->index('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('disciplines');
    }
};

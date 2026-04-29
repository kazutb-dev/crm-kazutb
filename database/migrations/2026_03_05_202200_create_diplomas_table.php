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
        Schema::create('diplomas', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('year');
            $table->string('semester', 20);

            $table->foreignId('faculty_id')->constrained('faculties')->restrictOnDelete();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->foreignId('program_id')->constrained('educational_programs')->restrictOnDelete();

            $table->foreignId('student_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('external_student_code')->nullable();
            $table->foreignId('supervisor_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('title_ru');
            $table->string('title_kz')->nullable();
            $table->string('title_en')->nullable();
            $table->text('abstract')->nullable();
            $table->json('keywords')->nullable();

            $table->string('normalized_title')->index();
            $table->string('type', 20)->default('diploma');
            $table->string('status', 20)->default('draft');
            $table->string('file_path')->nullable();
            $table->boolean('is_reference')->default(false);
            $table->timestamps();

            $table->index(['year', 'semester']);
            $table->index(['status', 'is_reference']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('diplomas');
    }
};

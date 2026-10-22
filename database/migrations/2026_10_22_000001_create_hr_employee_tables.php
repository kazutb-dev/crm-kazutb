<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Personal file of an employee hired through the HR module. IIN and ID card number are stored
        // encrypted with APP_KEY; iin_hash (HMAC) keeps them unique and searchable by the full number.
        Schema::create('hr_employees', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('last_name', 100)->nullable();
            $table->string('first_name', 100)->nullable();
            $table->string('middle_name', 100)->nullable();
            $table->text('iin')->nullable();
            $table->char('iin_hash', 64)->nullable()->unique();
            $table->date('birth_date')->nullable();
            $table->char('gender', 1)->nullable();
            $table->string('citizenship', 10)->default('kz');
            $table->string('citizenship_ru')->nullable();
            $table->string('citizenship_kz')->nullable();
            $table->string('photo_path')->nullable();
            $table->text('id_card_number')->nullable();
            $table->date('id_card_issued_at')->nullable();
            $table->string('id_card_issuer', 10)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('street', 150)->nullable();
            $table->string('house', 20)->nullable();
            $table->string('apartment', 20)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('marital_status', 20)->nullable();
            $table->string('military_status', 20)->nullable();
            $table->boolean('is_pensioner')->default(false);
            $table->string('disability', 5)->default('none');
            $table->boolean('is_student')->default(false);
            $table->boolean('is_large_family')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['last_name', 'first_name']);
        });

        Schema::create('hr_employee_children', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->string('full_name');
            $table->date('birth_date')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('hr_employee_educations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->string('level', 30);
            $table->string('institution')->nullable();
            $table->unsignedSmallInteger('graduation_year')->nullable();
            $table->string('specialty')->nullable();
            $table->string('diploma_number', 100)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('hr_employee_attachments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained('hr_employees')->cascadeOnDelete();
            $table->string('doc_type', 30);
            $table->string('original_name');
            $table->string('file_path');
            $table->unsignedInteger('size')->default(0);
            $table->char('sha256', 64)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employee_attachments');
        Schema::dropIfExists('hr_employee_educations');
        Schema::dropIfExists('hr_employee_children');
        Schema::dropIfExists('hr_employees');
    }
};

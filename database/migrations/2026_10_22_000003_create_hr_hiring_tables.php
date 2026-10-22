<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One hiring = employee + appointment + order. Unit and position may point to the catalog or be typed
        // in by hand; the names and case forms are always kept here as a snapshot used by the documents.
        Schema::create('hr_hirings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained('hr_employees');
            $table->string('status', 20)->default('draft');
            $table->string('staff_category', 5)->nullable();

            $table->foreignId('top_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->string('top_unit_name_ru')->nullable();
            $table->string('top_unit_name_ru_gen')->nullable();
            $table->string('top_unit_name_kz_gen')->nullable();

            $table->foreignId('sub_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->string('sub_unit_name_ru')->nullable();
            $table->string('sub_unit_name_ru_gen')->nullable();
            $table->string('sub_unit_name_kz_gen')->nullable();

            $table->foreignId('position_id')->nullable()->constrained('positions')->nullOnDelete();
            $table->string('position_name_ru')->nullable();
            $table->string('position_name_ru_gen')->nullable();
            $table->string('position_name_kz_poss')->nullable();

            $table->date('start_date')->nullable();
            $table->unsignedTinyInteger('probation_months')->default(0);

            $table->foreignId('replaces_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('replaces_employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();
            $table->string('replaces_full_name')->nullable();

            $table->string('order_number', 30)->nullable();
            $table->date('order_date')->nullable();
            $table->string('fio_accusative')->nullable();
            $table->boolean('fio_accusative_manual')->default(false);

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'start_date']);
        });

        Schema::create('hr_employment_contracts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hiring_id')->unique()->constrained('hr_hirings')->cascadeOnDelete();
            $table->string('number', 30)->nullable();
            $table->date('date')->nullable();
            $table->string('term', 15)->nullable();
            $table->unsignedInteger('salary')->nullable();
            $table->string('schedule', 10)->nullable();
            $table->string('employment', 10)->default('main');
            $table->unsignedSmallInteger('vacation_days')->nullable();
            $table->string('break_start', 5)->nullable();
            $table->string('break_end', 5)->nullable();
            $table->timestamps();

            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employment_contracts');
        Schema::dropIfExists('hr_hirings');
    }
};

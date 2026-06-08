<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('student_profiles')) {
            return;
        }

        $hasLegacyStudents = Schema::hasTable('students');

        Schema::create('student_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('legacy_student_id')->nullable()->index();
            $table->string('student_code', 120)->nullable()->index();
            $table->unsignedBigInteger('educational_program_id')->nullable()->index();
            $table->unsignedBigInteger('group_id')->nullable()->index();
            $table->unsignedSmallInteger('course_number')->nullable()->index();
            $table->string('stream_code', 120)->nullable()->index();
            $table->unsignedSmallInteger('entry_year')->nullable();
            $table->unsignedSmallInteger('expected_graduation_year')->nullable();
            $table->string('academic_status', 40)->default('unknown')->index();
            $table->string('source_system', 80)->default('crm')->index();
            $table->string('source_external_id', 190)->nullable()->index();
            $table->string('platonus_person_uid', 190)->nullable()->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        if ($hasLegacyStudents) {
            Schema::table('student_profiles', function (Blueprint $table): void {
                $table->foreign('legacy_student_id', 'student_profiles_legacy_student_id_fk')
                    ->references('id')
                    ->on('students')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('student_profiles') && Schema::hasColumn('student_profiles', 'legacy_student_id')) {
            Schema::table('student_profiles', function (Blueprint $table): void {
                $table->dropForeign('student_profiles_legacy_student_id_fk');
            });
        }

        Schema::dropIfExists('student_profiles');
    }
};

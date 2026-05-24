<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('questionnaire_group_courses')) {
            Schema::create('questionnaire_group_courses', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->unsignedInteger('sort_order')->default(0);
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->index(['status', 'sort_order']);
            });
        }

        if (! Schema::hasTable('questionnaire_group_specialities')) {
            Schema::create('questionnaire_group_specialities', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->unsignedInteger('sort_order')->default(0);
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->index(['status', 'sort_order']);
            });
        }

        if (! Schema::hasTable('questionnaire_group_educational_programs')) {
            Schema::create('questionnaire_group_educational_programs', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->unsignedInteger('sort_order')->default(0);
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->index(['status', 'sort_order']);
            });
        }

        if (Schema::hasTable('questionnaire_groups')) {
            Schema::table('questionnaire_groups', function (Blueprint $table): void {
                if (! Schema::hasColumn('questionnaire_groups', 'group_course_id')) {
                    $table->foreignId('group_course_id')
                        ->nullable()
                        ->after('name')
                        ->constrained('questionnaire_group_courses')
                        ->nullOnDelete();
                }

                if (! Schema::hasColumn('questionnaire_groups', 'group_speciality_id')) {
                    $table->foreignId('group_speciality_id')
                        ->nullable()
                        ->after('group_course_id')
                        ->constrained('questionnaire_group_specialities')
                        ->nullOnDelete();
                }

                if (! Schema::hasColumn('questionnaire_groups', 'group_educational_program_id')) {
                    $table->foreignId('group_educational_program_id')
                        ->nullable()
                        ->after('group_speciality_id')
                        ->constrained('questionnaire_group_educational_programs')
                        ->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('questionnaire_groups')) {
            Schema::table('questionnaire_groups', function (Blueprint $table): void {
                if (Schema::hasColumn('questionnaire_groups', 'group_educational_program_id')) {
                    $table->dropConstrainedForeignId('group_educational_program_id');
                }

                if (Schema::hasColumn('questionnaire_groups', 'group_speciality_id')) {
                    $table->dropConstrainedForeignId('group_speciality_id');
                }

                if (Schema::hasColumn('questionnaire_groups', 'group_course_id')) {
                    $table->dropConstrainedForeignId('group_course_id');
                }
            });
        }

        Schema::dropIfExists('questionnaire_group_educational_programs');
        Schema::dropIfExists('questionnaire_group_specialities');
        Schema::dropIfExists('questionnaire_group_courses');
    }
};

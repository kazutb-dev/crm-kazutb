<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('questionnaire_groups')) {
            Schema::create('questionnaire_groups', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('course', 20)->nullable();
                $table->string('speciality')->nullable();
                $table->string('educational_program')->nullable();
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->index('name');
                $table->index('status');
            });
        }

        if (!Schema::hasTable('questionnaire_disciplines')) {
            Schema::create('questionnaire_disciplines', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('code')->nullable();
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->unique('code');
                $table->index('name');
                $table->index('status');
            });
        }

        if (!Schema::hasTable('questionnaire_students')) {
            Schema::create('questionnaire_students', function (Blueprint $table): void {
                $table->id();
                $table->string('full_name');
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('login')->nullable();
                $table->foreignId('group_id')->constrained('questionnaire_groups')->cascadeOnDelete();
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->index('full_name');
                $table->index('login');
                $table->index('status');
                $table->index(['user_id', 'group_id']);
            });
        }

        if (!Schema::hasTable('questionnaire_teacher_disciplines')) {
            Schema::create('questionnaire_teacher_disciplines', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('discipline_id')->constrained('questionnaire_disciplines')->cascadeOnDelete();
                $table->string('academic_year', 20);
                $table->string('semester', 20);
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->unique(['teacher_id', 'discipline_id', 'academic_year', 'semester'], 'uq_questionnaire_teacher_discipline_period');
                $table->index('status');
            });
        }

        if (!Schema::hasTable('questionnaire_group_disciplines')) {
            Schema::create('questionnaire_group_disciplines', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('group_id')->constrained('questionnaire_groups')->cascadeOnDelete();
                $table->foreignId('teacher_discipline_id')->constrained('questionnaire_teacher_disciplines')->cascadeOnDelete();
                $table->string('academic_year', 20);
                $table->string('semester', 20);
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->unique(['group_id', 'teacher_discipline_id', 'academic_year', 'semester'], 'uq_questionnaire_group_discipline_period');
                $table->index('status');
            });
        }

        if (!Schema::hasTable('questionnaire_surveys')) {
            Schema::create('questionnaire_surveys', function (Blueprint $table): void {
                $table->id();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('academic_year', 20);
                $table->string('semester', 20);
                $table->date('start_date');
                $table->date('end_date');
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->index(['status', 'start_date', 'end_date']);
                $table->index(['academic_year', 'semester']);
            });
        }

        if (!Schema::hasTable('questionnaire_survey_questions')) {
            Schema::create('questionnaire_survey_questions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('survey_id')->constrained('questionnaire_surveys')->cascadeOnDelete();
                $table->text('question_text');
                $table->string('question_type', 30)->default('single_choice');
                $table->boolean('is_required')->default(true);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['survey_id', 'sort_order']);
            });
        }

        if (!Schema::hasTable('questionnaire_survey_options')) {
            Schema::create('questionnaire_survey_options', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('question_id')->constrained('questionnaire_survey_questions')->cascadeOnDelete();
                $table->string('option_text');
                $table->decimal('score', 8, 2)->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['question_id', 'sort_order']);
            });
        }

        if (!Schema::hasTable('questionnaire_survey_responses')) {
            Schema::create('questionnaire_survey_responses', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('survey_id')->constrained('questionnaire_surveys')->cascadeOnDelete();
                $table->foreignId('student_id')->constrained('questionnaire_students')->cascadeOnDelete();
                $table->foreignId('group_id')->constrained('questionnaire_groups')->cascadeOnDelete();
                $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('discipline_id')->constrained('questionnaire_disciplines')->cascadeOnDelete();
                $table->foreignId('teacher_discipline_id')->constrained('questionnaire_teacher_disciplines')->cascadeOnDelete();
                $table->foreignId('group_discipline_id')->constrained('questionnaire_group_disciplines')->cascadeOnDelete();
                $table->string('academic_year', 20);
                $table->string('semester', 20);
                $table->string('status', 20)->default('submitted');
                $table->timestamp('submitted_at')->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'survey_id',
                        'student_id',
                        'teacher_id',
                        'discipline_id',
                        'group_id',
                        'teacher_discipline_id',
                        'group_discipline_id',
                        'academic_year',
                        'semester',
                    ],
                    'uq_questionnaire_response_no_repeat'
                );

                $table->index(['student_id', 'survey_id']);
                $table->index(['teacher_id', 'discipline_id']);
                $table->index(['academic_year', 'semester']);
                $table->index('status');
            });
        }

        if (!Schema::hasTable('questionnaire_survey_answers')) {
            Schema::create('questionnaire_survey_answers', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('response_id')->constrained('questionnaire_survey_responses')->cascadeOnDelete();
                $table->foreignId('question_id')->constrained('questionnaire_survey_questions')->cascadeOnDelete();
                $table->foreignId('option_id')->nullable()->constrained('questionnaire_survey_options')->nullOnDelete();
                $table->text('text_answer')->nullable();
                $table->decimal('numeric_answer', 10, 2)->nullable();
                $table->timestamps();

                $table->unique(['response_id', 'question_id'], 'uq_questionnaire_answer_once_per_question');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('questionnaire_survey_answers');
        Schema::dropIfExists('questionnaire_survey_responses');
        Schema::dropIfExists('questionnaire_survey_options');
        Schema::dropIfExists('questionnaire_survey_questions');
        Schema::dropIfExists('questionnaire_surveys');
        Schema::dropIfExists('questionnaire_group_disciplines');
        Schema::dropIfExists('questionnaire_teacher_disciplines');
        Schema::dropIfExists('questionnaire_students');
        Schema::dropIfExists('questionnaire_disciplines');
        Schema::dropIfExists('questionnaire_groups');
    }
};

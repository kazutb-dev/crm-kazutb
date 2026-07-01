<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('language_testing_tests')) {
            Schema::create('language_testing_tests', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->string('language', 32);
                $table->text('description')->nullable();
                $table->unsignedInteger('passing_score')->default(60);
                $table->unsignedInteger('total_questions')->default(20);
                $table->string('status', 20)->default('active');
                $table->timestamps();

                $table->index(['language', 'status']);
            });
        }

        if (! Schema::hasTable('language_testing_questions')) {
            Schema::create('language_testing_questions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('language_testing_test_id')->constrained('language_testing_tests')->cascadeOnDelete();
                $table->text('question');
                $table->string('question_type', 32)->default('single_choice');
                $table->unsignedInteger('points')->default(1);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['language_testing_test_id', 'sort_order'], 'lt_questions_test_sort_idx');
            });
        }

        if (! Schema::hasTable('language_testing_answers')) {
            Schema::create('language_testing_answers', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('language_testing_question_id')->constrained('language_testing_questions')->cascadeOnDelete();
                $table->text('answer');
                $table->boolean('is_correct')->default(false);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['language_testing_question_id', 'sort_order'], 'lt_answers_question_sort_idx');
            });
        }

        if (! Schema::hasTable('language_testing_sessions')) {
            Schema::create('language_testing_sessions', function (Blueprint $table): void {
                $table->id();
                $table->uuid('public_session_id')->unique();
                $table->foreignId('language_testing_test_id')->constrained('language_testing_tests')->cascadeOnDelete();
                $table->string('student_id')->nullable();
                $table->string('first_name')->nullable();
                $table->string('last_name')->nullable();
                $table->string('email')->nullable();
                $table->string('phone')->nullable();
                $table->json('question_payload');
                $table->json('submitted_answers')->nullable();
                $table->unsignedInteger('score')->nullable();
                $table->decimal('percentage', 5, 2)->nullable();
                $table->unsignedInteger('correct_answers')->nullable();
                $table->unsignedInteger('total_questions')->nullable();
                $table->string('status', 20)->default('started');
                $table->timestamp('started_at');
                $table->timestamp('finished_at')->nullable();
                $table->timestamps();

                $table->index(['language_testing_test_id', 'status'], 'lt_sessions_test_status_idx');
                $table->index(['student_id', 'email'], 'lt_sessions_student_idx');
            });
        }

        if (! Schema::hasTable('language_testing_results')) {
            Schema::create('language_testing_results', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('language_testing_session_id')->unique()->constrained('language_testing_sessions')->cascadeOnDelete();
                $table->foreignId('language_testing_test_id')->constrained('language_testing_tests')->cascadeOnDelete();
                $table->string('student_id')->nullable();
                $table->string('first_name');
                $table->string('last_name');
                $table->string('email');
                $table->string('phone')->nullable();
                $table->string('language', 32);
                $table->string('test_name');
                $table->unsignedInteger('score');
                $table->decimal('percentage', 5, 2);
                $table->unsignedInteger('correct_answers');
                $table->unsignedInteger('total_questions');
                $table->string('status', 20);
                $table->timestamp('submitted_at');
                $table->timestamps();

                $table->index(['language_testing_test_id', 'status'], 'lt_results_test_status_idx');
                $table->index(['language', 'submitted_at'], 'lt_results_language_date_idx');
                $table->index(['email', 'phone'], 'lt_results_contact_idx');
            });
        }

        $this->seedDefaultTests();
    }

    public function down(): void
    {
        Schema::dropIfExists('language_testing_results');
        Schema::dropIfExists('language_testing_sessions');
        Schema::dropIfExists('language_testing_answers');
        Schema::dropIfExists('language_testing_questions');
        Schema::dropIfExists('language_testing_tests');
    }

    private function seedDefaultTests(): void
    {
        $defaults = config('language_testing_module.default_tests', []);

        if (! is_array($defaults) || $defaults === []) {
            return;
        }

        $existingNames = DB::table('language_testing_tests')->pluck('name')->all();
        $now = Carbon::now();

        $rows = collect($defaults)
            ->filter(fn (mixed $row): bool => is_array($row) && ! in_array((string) ($row['name'] ?? ''), $existingNames, true))
            ->map(function (array $row) use ($now): array {
                return [
                    'name' => (string) $row['name'],
                    'language' => (string) $row['language'],
                    'description' => $row['description'] ?? null,
                    'passing_score' => (int) ($row['passing_score'] ?? 60),
                    'total_questions' => (int) ($row['total_questions'] ?? 20),
                    'status' => (string) ($row['status'] ?? 'active'),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })
            ->values()
            ->all();

        if ($rows !== []) {
            DB::table('language_testing_tests')->insert($rows);
        }
    }
};
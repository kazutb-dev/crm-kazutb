<?php

namespace App\Modules\LanguageTestingModule\Services;

use App\Modules\LanguageTestingModule\DTO\LanguageTestingListFiltersData;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingQuestionFiltersData;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingStatisticsFiltersData;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingSubmissionData;
use App\Modules\LanguageTestingModule\Models\LanguageTestingQuestion;
use App\Modules\LanguageTestingModule\Models\LanguageTestingResult;
use App\Modules\LanguageTestingModule\Models\LanguageTestingSession;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use App\Modules\LanguageTestingModule\Repositories\LanguageTestingRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LanguageTestingService
{
    public function __construct(
        private readonly LanguageTestingRepository $repository,
    ) {
    }

    public function paginateTests(LanguageTestingListFiltersData $filters): LengthAwarePaginator
    {
        return $this->repository->paginateTests($filters);
    }

    public function paginateActiveTests(LanguageTestingListFiltersData $filters): LengthAwarePaginator
    {
        return $this->repository->paginateActiveTests($filters);
    }

    public function testOptions(): array
    {
        return [
            'languages' => config('language_testing_module.languages', []),
            'statuses' => config('language_testing_module.statuses', []),
        ];
    }

    public function createTest(array $validated): LanguageTestingTest
    {
        return $this->repository->createTest($validated)->loadCount('questions');
    }

    public function updateTest(LanguageTestingTest $test, array $validated): LanguageTestingTest
    {
        return $this->repository->updateTest($test, $validated);
    }

    public function deleteTest(LanguageTestingTest $test): void
    {
        $this->repository->deleteTest($test);
    }

    public function paginateQuestions(LanguageTestingTest $test, LanguageTestingQuestionFiltersData $filters): LengthAwarePaginator
    {
        return $this->repository->paginateQuestions($test, $filters);
    }

    public function createQuestion(LanguageTestingTest $test, array $validated): LanguageTestingQuestion
    {
        $nextOrder = (int) ($test->questions()->max('sort_order') ?? 0) + 1;

        return $this->repository->createQuestion(
            $test,
            [
                'question' => (string) $validated['question'],
                'question_type' => 'single_choice',
                'points' => (int) $validated['points'],
                'sort_order' => (int) ($validated['sort_order'] ?? $nextOrder),
            ],
            $validated['options'] ?? [],
        );
    }

    public function updateQuestion(LanguageTestingQuestion $question, array $validated): LanguageTestingQuestion
    {
        return $this->repository->updateQuestion(
            $question,
            [
                'question' => (string) $validated['question'],
                'question_type' => 'single_choice',
                'points' => (int) $validated['points'],
                'sort_order' => (int) ($validated['sort_order'] ?? $question->sort_order),
            ],
            $validated['options'] ?? [],
        );
    }

    public function deleteQuestion(LanguageTestingQuestion $question): void
    {
        $this->repository->deleteQuestion($question);
    }

    /**
     * @param  array<int, int>  $questionIds
     */
    public function reorderQuestions(LanguageTestingTest $test, array $questionIds): void
    {
        $existingIds = $test->questions()->pluck('id')->sort()->values()->all();
        $incomingIds = collect($questionIds)->map(fn (mixed $id): int => (int) $id)->sort()->values()->all();

        if ($existingIds !== $incomingIds) {
            throw ValidationException::withMessages([
                'question_ids' => 'Список вопросов для сортировки не совпадает с составом теста.',
            ]);
        }

        $this->repository->reorderQuestions($test, array_values($questionIds));
    }

    public function startSession(LanguageTestingTest $test): array
    {
        if ($test->status !== LanguageTestingTest::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'test' => 'Тест недоступен для прохождения.',
            ]);
        }

        $availableQuestions = (int) $test->questions()->count();
        $limit = min($availableQuestions, max(1, (int) $test->total_questions));

        if ($limit < 1) {
            throw ValidationException::withMessages([
                'test' => 'В тесте нет доступных вопросов.',
            ]);
        }

        $questions = $this->repository->randomQuestionsForSession($test, $limit)
            ->shuffle()
            ->values();

        $payload = $questions->map(function (LanguageTestingQuestion $question, int $index): array {
            $answers = $question->answers->shuffle()->values()->map(function ($answer, int $answerIndex): array {
                return [
                    'id' => (int) $answer->id,
                    'text' => (string) $answer->answer,
                    'sort_order' => $answerIndex + 1,
                ];
            })->all();

            $correctAnswerId = (int) optional($question->answers->firstWhere('is_correct', true))->id;
            if ($correctAnswerId < 1) {
                throw ValidationException::withMessages([
                    'test' => 'Один из вопросов теста не имеет правильного ответа.',
                ]);
            }

            return [
                'question_id' => (int) $question->id,
                'text' => (string) $question->question,
                'points' => (int) $question->points,
                'sort_order' => $index + 1,
                'correct_answer_id' => $correctAnswerId,
                'answers' => $answers,
            ];
        })->all();

        $session = $this->repository->createSession([
            'public_session_id' => (string) Str::uuid(),
            'language_testing_test_id' => $test->id,
            'question_payload' => $payload,
            'total_questions' => count($payload),
            'status' => LanguageTestingSession::STATUS_STARTED,
            'started_at' => now(),
        ]);

        return [
            'session_id' => $session->public_session_id,
            'test_id' => $test->id,
            'test' => [
                'id' => $test->id,
                'name' => $test->name,
                'language' => $test->language,
                'description' => $test->description,
                'passing_score' => (int) $test->passing_score,
                'total_questions' => (int) $test->total_questions,
                'status' => $test->status,
            ],
            'questions' => collect($payload)->map(fn (array $item): array => [
                'id' => $item['question_id'],
                'text' => $item['text'],
                'answers' => collect($item['answers'])->map(fn (array $answer): array => [
                    'id' => $answer['id'],
                    'text' => $answer['text'],
                ])->all(),
            ])->all(),
        ];
    }

    public function submitSession(LanguageTestingTest $test, LanguageTestingSubmissionData $submission): array
    {
        $session = $this->repository->findStartedSession($test, $submission->sessionId);
        if (! $session) {
            throw ValidationException::withMessages([
                'session_id' => 'Сессия тестирования не найдена или уже завершена.',
            ]);
        }

        $questionPayload = collect($session->question_payload ?? []);
        if ($questionPayload->isEmpty()) {
            throw ValidationException::withMessages([
                'session_id' => 'Содержимое сессии повреждено.',
            ]);
        }

        $submittedByQuestion = collect($submission->answers)->keyBy('question_id');
        $totalQuestions = $questionPayload->count();
        $totalPoints = (int) $questionPayload->sum(fn (array $item): int => (int) ($item['points'] ?? 0));
        $correctAnswers = 0;
        $score = 0;

        $submittedAnswers = $questionPayload->map(function (array $question) use ($submittedByQuestion, &$correctAnswers, &$score): array {
            $questionId = (int) $question['question_id'];
            $submitted = $submittedByQuestion->get($questionId);
            $selectedAnswerId = isset($submitted['answer_id']) ? (int) $submitted['answer_id'] : null;
            $allowedAnswerIds = collect($question['answers'] ?? [])->pluck('id')->map(fn (mixed $id): int => (int) $id)->all();

            if ($selectedAnswerId !== null && ! in_array($selectedAnswerId, $allowedAnswerIds, true)) {
                throw ValidationException::withMessages([
                    'answers' => 'Один из переданных ответов не принадлежит текущей сессии.',
                ]);
            }

            $isCorrect = $selectedAnswerId !== null && $selectedAnswerId === (int) $question['correct_answer_id'];

            if ($isCorrect) {
                $correctAnswers++;
                $score += (int) ($question['points'] ?? 0);
            }

            return [
                'question_id' => $questionId,
                'selected_answer_id' => $selectedAnswerId,
                'is_correct' => $isCorrect,
            ];
        })->all();

        $percentage = $totalPoints > 0 ? round(($score / $totalPoints) * 100, 2) : 0.0;
        $status = $percentage >= (float) $test->passing_score
            ? LanguageTestingResult::STATUS_PASSED
            : LanguageTestingResult::STATUS_FAILED;

        $finishedAt = now();
        $this->repository->finalizeSession($session, [
            'student_id' => $submission->studentId,
            'iin' => $submission->iin,
            'first_name' => $submission->firstName,
            'middle_name' => $submission->middleName,
            'last_name' => $submission->lastName,
            'email' => $submission->email,
            'phone' => $submission->phone,
            'submitted_answers' => $submittedAnswers,
            'score' => $score,
            'percentage' => $percentage,
            'correct_answers' => $correctAnswers,
            'total_questions' => $totalQuestions,
            'status' => LanguageTestingSession::STATUS_SUBMITTED,
            'finished_at' => $finishedAt,
        ]);

        $result = $this->repository->createResult([
            'language_testing_session_id' => $session->id,
            'language_testing_test_id' => $test->id,
            'student_id' => $submission->studentId,
            'iin' => $submission->iin,
            'first_name' => $submission->firstName,
            'middle_name' => $submission->middleName,
            'last_name' => $submission->lastName,
            'email' => $submission->email,
            'phone' => $submission->phone,
            'language' => $test->language,
            'test_name' => $test->name,
            'score' => $score,
            'percentage' => $percentage,
            'correct_answers' => $correctAnswers,
            'total_questions' => $totalQuestions,
            'status' => $status,
            'submitted_at' => $finishedAt,
        ]);

        return [
            'result_id' => $result->id,
            'score' => $score,
            'percentage' => $percentage,
            'correct_answers' => $correctAnswers,
            'total_questions' => $totalQuestions,
            'passed' => $status === LanguageTestingResult::STATUS_PASSED,
            'completed_at' => $finishedAt->toIso8601String(),
            'status' => $status === LanguageTestingResult::STATUS_PASSED ? 'Passed' : 'Failed',
        ];
    }

    public function paginateStatistics(LanguageTestingStatisticsFiltersData $filters): LengthAwarePaginator
    {
        return $this->repository->paginateResults($filters);
    }

    public function statisticsOptions(): array
    {
        return [
            'tests' => $this->repository->allTestsOrdered()->map(fn (LanguageTestingTest $test): array => [
                'id' => $test->id,
                'name' => $test->name,
                'language' => $test->language,
            ])->all(),
            'languages' => config('language_testing_module.languages', []),
            'statuses' => config('language_testing_module.result_statuses', []),
        ];
    }

    public function activeTestsCatalog(): Collection
    {
        return $this->repository->activeTestsCatalog();
    }

    public function allTestsCatalog(): Collection
    {
        return $this->repository->allTestsOrdered()->loadCount('questions');
    }

    public function serializeTest(LanguageTestingTest $test): array
    {
        $questionsCount = isset($test->questions_count) ? (int) $test->questions_count : (int) $test->questions()->count();

        return [
            'id' => $test->id,
            'name' => $test->name,
            'language' => $test->language,
            'language_label' => config('language_testing_module.languages.' . $test->language, $test->language),
            'description' => $test->description,
            'passing_score' => (int) $test->passing_score,
            'total_questions' => (int) $test->total_questions,
            'questions_count' => $questionsCount,
            'status' => $test->status,
            'status_label' => config('language_testing_module.statuses.' . $test->status, $test->status),
            'created_at' => optional($test->created_at)?->toIso8601String(),
            'updated_at' => optional($test->updated_at)?->toIso8601String(),
        ];
    }

    public function serializeQuestion(LanguageTestingQuestion $question): array
    {
        $question->loadMissing('answers');

        return [
            'id' => $question->id,
            'test_id' => $question->language_testing_test_id,
            'question' => $question->question,
            'question_type' => $question->question_type,
            'points' => (int) $question->points,
            'sort_order' => (int) $question->sort_order,
            'options' => $question->answers->map(fn ($answer): array => [
                'id' => $answer->id,
                'text' => $answer->answer,
                'is_correct' => (bool) $answer->is_correct,
                'sort_order' => (int) $answer->sort_order,
            ])->values()->all(),
            'created_at' => optional($question->created_at)?->toIso8601String(),
            'updated_at' => optional($question->updated_at)?->toIso8601String(),
        ];
    }

    public function serializeResult(LanguageTestingResult $result): array
    {
        return [
            'id' => $result->id,
            'student_id' => $result->student_id,
            'iin' => $result->iin,
            'first_name' => $result->first_name,
            'middle_name' => $result->middle_name,
            'last_name' => $result->last_name,
            'email' => $result->email,
            'phone' => $result->phone,
            'language' => $result->language,
            'language_label' => config('language_testing_module.languages.' . $result->language, $result->language),
            'test_name' => $result->test_name,
            'score' => (int) $result->score,
            'percentage' => (float) $result->percentage,
            'correct_answers' => (int) $result->correct_answers,
            'total_questions' => (int) $result->total_questions,
            'passed' => $result->status === LanguageTestingResult::STATUS_PASSED,
            'status' => $result->status,
            'status_label' => $result->status === LanguageTestingResult::STATUS_PASSED ? 'Passed' : 'Failed',
            'completed_at' => optional($result->submitted_at)?->toIso8601String(),
            'submitted_at' => optional($result->submitted_at)?->toIso8601String(),
        ];
    }
}
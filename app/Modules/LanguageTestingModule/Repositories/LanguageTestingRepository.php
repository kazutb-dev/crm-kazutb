<?php

namespace App\Modules\LanguageTestingModule\Repositories;

use App\Modules\LanguageTestingModule\DTO\LanguageTestingListFiltersData;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingQuestionFiltersData;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingStatisticsFiltersData;
use App\Modules\LanguageTestingModule\Models\LanguageTestingQuestion;
use App\Modules\LanguageTestingModule\Models\LanguageTestingResult;
use App\Modules\LanguageTestingModule\Models\LanguageTestingSession;
use App\Modules\LanguageTestingModule\Models\LanguageTestingTest;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class LanguageTestingRepository
{
    public function paginateTests(LanguageTestingListFiltersData $filters): LengthAwarePaginator
    {
        return $this->testsQuery($filters)
            ->withCount('questions')
            ->paginate($filters->perPage)
            ->withQueryString();
    }

    public function paginateActiveTests(LanguageTestingListFiltersData $filters): LengthAwarePaginator
    {
        return $this->testsQuery($filters)
            ->where('status', LanguageTestingTest::STATUS_ACTIVE)
            ->withCount('questions')
            ->paginate($filters->perPage)
            ->withQueryString();
    }

    public function allTestsOrdered(): Collection
    {
        return LanguageTestingTest::query()->orderBy('name')->get();
    }

    public function createTest(array $payload): LanguageTestingTest
    {
        return LanguageTestingTest::query()->create($payload);
    }

    public function updateTest(LanguageTestingTest $test, array $payload): LanguageTestingTest
    {
        $test->fill($payload)->save();

        return $test->refresh()->loadCount('questions');
    }

    public function deleteTest(LanguageTestingTest $test): void
    {
        $test->delete();
    }

    public function paginateQuestions(LanguageTestingTest $test, LanguageTestingQuestionFiltersData $filters): LengthAwarePaginator
    {
        return $this->questionsQuery($test, $filters)
            ->with('answers')
            ->paginate($filters->perPage)
            ->withQueryString();
    }

    public function createQuestion(LanguageTestingTest $test, array $questionPayload, array $options): LanguageTestingQuestion
    {
        return DB::transaction(function () use ($test, $questionPayload, $options): LanguageTestingQuestion {
            $question = $test->questions()->create($questionPayload);

            foreach ($options as $index => $option) {
                $question->answers()->create([
                    'answer' => (string) $option['text'],
                    'is_correct' => (bool) $option['is_correct'],
                    'sort_order' => $index + 1,
                ]);
            }

            return $question->refresh()->load('answers');
        });
    }

    public function updateQuestion(LanguageTestingQuestion $question, array $questionPayload, array $options): LanguageTestingQuestion
    {
        return DB::transaction(function () use ($question, $questionPayload, $options): LanguageTestingQuestion {
            $question->fill($questionPayload)->save();
            $question->answers()->delete();

            foreach ($options as $index => $option) {
                $question->answers()->create([
                    'answer' => (string) $option['text'],
                    'is_correct' => (bool) $option['is_correct'],
                    'sort_order' => $index + 1,
                ]);
            }

            return $question->refresh()->load('answers');
        });
    }

    public function deleteQuestion(LanguageTestingQuestion $question): void
    {
        $question->delete();
    }

    /**
     * @param  array<int, int>  $questionIds
     */
    public function reorderQuestions(LanguageTestingTest $test, array $questionIds): void
    {
        DB::transaction(function () use ($test, $questionIds): void {
            foreach (array_values($questionIds) as $index => $questionId) {
                LanguageTestingQuestion::query()
                    ->where('language_testing_test_id', $test->id)
                    ->whereKey($questionId)
                    ->update(['sort_order' => $index + 1]);
            }
        });
    }

    public function randomQuestionsForSession(LanguageTestingTest $test, int $limit): Collection
    {
        return LanguageTestingQuestion::query()
            ->where('language_testing_test_id', $test->id)
            ->with('answers')
            ->inRandomOrder()
            ->limit($limit)
            ->get();
    }

    public function createSession(array $payload): LanguageTestingSession
    {
        return LanguageTestingSession::query()->create($payload);
    }

    public function findStartedSession(LanguageTestingTest $test, string $publicSessionId): ?LanguageTestingSession
    {
        return LanguageTestingSession::query()
            ->where('language_testing_test_id', $test->id)
            ->where('public_session_id', $publicSessionId)
            ->where('status', LanguageTestingSession::STATUS_STARTED)
            ->first();
    }

    public function finalizeSession(LanguageTestingSession $session, array $payload): LanguageTestingSession
    {
        $session->fill($payload)->save();

        return $session->refresh();
    }

    public function createResult(array $payload): LanguageTestingResult
    {
        return LanguageTestingResult::query()->create($payload);
    }

    public function paginateResults(LanguageTestingStatisticsFiltersData $filters): LengthAwarePaginator
    {
        return $this->resultsQuery($filters)
            ->paginate($filters->perPage)
            ->withQueryString();
    }

    public function resultsForExport(LanguageTestingStatisticsFiltersData $filters): Collection
    {
        return $this->resultsQuery($filters)->get();
    }

    public function findResult(int|string $id): ?LanguageTestingResult
    {
        return LanguageTestingResult::query()->find($id);
    }

    public function activeTestsCatalog(): Collection
    {
        return LanguageTestingTest::query()
            ->where('status', LanguageTestingTest::STATUS_ACTIVE)
            ->withCount('questions')
            ->orderBy('name')
            ->get();
    }

    private function testsQuery(LanguageTestingListFiltersData $filters): Builder
    {
        $query = LanguageTestingTest::query();

        if ($filters->q !== '') {
            $query->where(function (Builder $builder) use ($filters): void {
                $builder
                    ->where('name', 'like', '%' . $filters->q . '%')
                    ->orWhere('description', 'like', '%' . $filters->q . '%');
            });
        }

        if ($filters->status !== '') {
            $query->where('status', $filters->status);
        }

        if ($filters->language !== '') {
            $query->where('language', $filters->language);
        }

        $sort = in_array($filters->sort, ['name', 'language', 'status', 'passing_score', 'total_questions', 'created_at'], true)
            ? $filters->sort
            : 'name';

        return $query->orderBy($sort, $filters->direction);
    }

    private function questionsQuery(LanguageTestingTest $test, LanguageTestingQuestionFiltersData $filters): Builder
    {
        $query = LanguageTestingQuestion::query()->where('language_testing_test_id', $test->id);

        if ($filters->q !== '') {
            $query->where('question', 'like', '%' . $filters->q . '%');
        }

        $sort = in_array($filters->sort, ['sort_order', 'points', 'created_at'], true) ? $filters->sort : 'sort_order';

        return $query->orderBy($sort, $filters->direction)->orderBy('id', $filters->direction);
    }

    private function resultsQuery(LanguageTestingStatisticsFiltersData $filters): Builder
    {
        $query = LanguageTestingResult::query();

        if ($filters->q !== '') {
            $query->where(function (Builder $builder) use ($filters): void {
                $builder
                    ->where('first_name', 'like', '%' . $filters->q . '%')
                    ->orWhere('last_name', 'like', '%' . $filters->q . '%')
                    ->orWhere('email', 'like', '%' . $filters->q . '%')
                    ->orWhere('phone', 'like', '%' . $filters->q . '%')
                    ->orWhere('student_id', 'like', '%' . $filters->q . '%')
                    ->orWhere('test_name', 'like', '%' . $filters->q . '%');
            });
        }

        if ($filters->testId) {
            $query->where('language_testing_test_id', $filters->testId);
        }

        if ($filters->language !== '') {
            $query->where('language', $filters->language);
        }

        if ($filters->status !== '') {
            $query->where('status', $filters->status);
        }

        if ($filters->fromDate !== '') {
            $query->whereDate('submitted_at', '>=', $filters->fromDate);
        }

        if ($filters->toDate !== '') {
            $query->whereDate('submitted_at', '<=', $filters->toDate);
        }

        $sort = in_array($filters->sort, ['submitted_at', 'percentage', 'score', 'correct_answers', 'test_name', 'language'], true)
            ? $filters->sort
            : 'submitted_at';

        return $query->orderBy($sort, $filters->direction)->orderBy('id', 'desc');
    }
}
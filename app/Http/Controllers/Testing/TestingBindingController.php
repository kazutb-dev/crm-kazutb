<?php

namespace App\Http\Controllers\Testing;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Testing\Concerns\AuthorizesTestingAccess;
use App\Models\Testing\TestingBinding;
use App\Models\Testing\TestingResult;
use App\Models\Testing\TestingSubject;
use App\Models\Testing\TestingTest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TestingBindingController extends Controller
{
    use AuthorizesTestingAccess;

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->ensureTestingUser($user);

        $data = $request->validate([
            'subject_id' => [
                'required',
                'integer',
                Rule::exists('disciplines', 'id'),
            ],
        ]);

        $binding = TestingBinding::query()->firstOrCreate([
            'teacher_id' => $user->id,
            'subject_id' => (int) $data['subject_id'],
        ]);

        return redirect()
            ->route('testing.index')
            ->with('success', 'Привязка предмета создана.');
    }

    public function show(Request $request, TestingBinding $binding): Response
    {
        $user = $request->user();
        $this->ensureBindingAccess($user, $binding);

        $binding->load('subject:id,name,code,description');

        $tests = TestingTest::query()
            ->with(['questions:id,test_id,text,type,position', 'results.user:id,name,display_name,email'])
            ->where('binding_id', $binding->id)
            ->withCount('results')
            ->withAvg('results as average_score', 'score')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (TestingTest $test): array => [
                'id' => $test->id,
                'title' => $test->title,
                'description' => $test->description,
                'status' => $test->status,
                'question_count' => (int) $test->question_count,
                'questions_total' => $test->questions->count(),
                'shuffle_questions' => (bool) $test->shuffle_questions,
                'passing_score' => (float) $test->passing_score,
                'results_count' => (int) $test->results_count,
                'average_score' => round((float) ($test->average_score ?? 0), 1),
                'updated_at' => optional($test->updated_at)->toDateTimeString(),
                'questions' => $test->questions->map(fn ($question): array => [
                    'id' => $question->id,
                    'text' => $question->text,
                    'type' => $question->type,
                    'position' => (int) $question->position,
                ])->values(),
                'results' => $test->results->map(fn ($result): array => [
                    'id' => $result->id,
                    'user_name' => $result->user?->display_name ?: $result->user?->name ?: $result->user?->email ?: 'Пользователь',
                    'score' => round((float) $result->score, 1),
                    'correct_answers_count' => (int) $result->correct_answers_count,
                    'passed' => (bool) $result->passed,
                    'completed_at' => optional($result->completed_at)->toDateTimeString(),
                ])->values()->all(),
            ])
            ->values();

        return Inertia::render('Testing/BindingShow', [
            'binding' => [
                'id' => $binding->id,
                'created_at' => optional($binding->created_at)->toDateTimeString(),
                'subject' => [
                    'id' => $binding->subject?->id,
                    'name' => $binding->subject?->name,
                    'code' => $binding->subject?->code,
                    'description' => $binding->subject?->description,
                ],
            ],
            'tests' => $tests,
            'analytics' => $this->bindingAnalytics($binding),
        ]);
    }

    public function analytics(Request $request, TestingBinding $binding): Response
    {
        $user = $request->user();
        $this->ensureBindingAccess($user, $binding);

        $binding->load('subject:id,name,code,description');

        $tests = TestingTest::query()
            ->where('binding_id', $binding->id)
            ->orderBy('title')
            ->get();

        $testAnalytics = $tests->map(fn (TestingTest $test): array => $this->singleTestAnalytics($test))->values();

        $results = TestingResult::query()
            ->with(['user:id,name,display_name,email', 'test:id,title,passing_score'])
            ->whereIn('test_id', $tests->pluck('id'))
            ->latest('completed_at')
            ->limit(50)
            ->get()
            ->map(function (TestingResult $result): array {
                $userName = $result->user?->display_name ?: $result->user?->name ?: $result->user?->email;

                return [
                    'id' => $result->id,
                    'user_name' => $userName,
                    'user_email' => $result->user?->email,
                    'test_title' => $result->test?->title,
                    'score' => round((float) $result->score, 1),
                    'correct_answers_count' => (int) $result->correct_answers_count,
                    'passed' => (bool) $result->passed,
                    'completed_at' => optional($result->completed_at)->toDateTimeString(),
                ];
            })
            ->values();

        return Inertia::render('Testing/BindingAnalytics', [
            'binding' => [
                'id' => $binding->id,
                'subject' => [
                    'id' => $binding->subject?->id,
                    'name' => $binding->subject?->name,
                    'code' => $binding->subject?->code,
                    'description' => $binding->subject?->description,
                ],
            ],
            'analytics' => $this->bindingAnalytics($binding),
            'testAnalytics' => $testAnalytics,
            'results' => $results,
        ]);
    }

    public function destroy(Request $request, TestingBinding $binding): RedirectResponse
    {
        $user = $request->user();
        $this->ensureBindingAccess($user, $binding);

        $binding->delete();

        return redirect()
            ->route('testing.index')
            ->with('success', 'Привязка предмета удалена вместе с тестами.');
    }

    private function bindingAnalytics(TestingBinding $binding): array
    {
        $tests = TestingTest::query()
            ->with('results:id,test_id,user_id,score,passed,completed_at')
            ->where('binding_id', $binding->id)
            ->get();

        $allResults = $tests->flatMap->results;

        return [
            'tests_count' => $tests->count(),
            'attempts_count' => $allResults->count(),
            'users_count' => $allResults->pluck('user_id')->filter()->unique()->count(),
            'average_score' => round((float) ($allResults->avg('score') ?? 0), 1),
            'success_rate' => $allResults->count() > 0
                ? round(($allResults->where('passed', true)->count() / $allResults->count()) * 100, 1)
                : 0,
            'last_completed_at' => optional($allResults->sortByDesc('completed_at')->first()?->completed_at)->toDateTimeString(),
        ];
    }

    private function singleTestAnalytics(TestingTest $test): array
    {
        $test->loadMissing('results:id,test_id,user_id,score,passed,completed_at');

        $results = $test->results;

        return [
            'id' => $test->id,
            'title' => $test->title,
            'status' => $test->status,
            'question_count' => (int) $test->question_count,
            'attempts_count' => $results->count(),
            'users_count' => $results->pluck('user_id')->filter()->unique()->count(),
            'average_score' => round((float) ($results->avg('score') ?? 0), 1),
            'success_rate' => $results->count() > 0
                ? round(($results->where('passed', true)->count() / $results->count()) * 100, 1)
                : 0,
            'last_completed_at' => optional($results->sortByDesc('completed_at')->first()?->completed_at)->toDateTimeString(),
        ];
    }
}

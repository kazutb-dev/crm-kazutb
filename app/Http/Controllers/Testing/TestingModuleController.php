<?php

namespace App\Http\Controllers\Testing;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Testing\Concerns\AuthorizesTestingAccess;
use App\Models\Testing\TestingBinding;
use App\Models\Testing\TestingSubject;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TestingModuleController extends Controller
{
    use AuthorizesTestingAccess;

    public function index(Request $request): Response
    {
        $user = $request->user();
        $this->ensureTestingUser($user);

        $subjects = TestingSubject::query()
            ->where(function ($query) use ($user) {
                if ($user->department_id) {
                    $query->where('department_id', $user->department_id)
                        ->orWhere('user_id', $user->id)
                        ->orWhereHas('bindings', function ($qb) use ($user) {
                            $qb->where('teacher_id', $user->id);
                        });
                } else {
                    $query->whereRaw('1=1');
                }
            })
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'description'])
            ->map(function (TestingSubject $subject) use ($user): array {
                $bindingId = TestingBinding::query()
                    ->where('teacher_id', $user->id)
                    ->where('subject_id', $subject->id)
                    ->value('id');

                return [
                    'id' => $subject->id,
                    'name' => $subject->name,
                    'code' => $subject->code,
                    'description' => $subject->description,
                    'has_binding' => $bindingId !== null,
                    'binding_id' => $bindingId,
                ];
            })
            ->values();

        $bindings = TestingBinding::query()
            ->with('subject:id,name,code')
            ->withCount('tests')
            ->withCount('results as attempts_count')
            ->withAvg('results as average_score', 'score')
            ->where('teacher_id', $user->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(function (TestingBinding $binding): array {
                $studentsCount = \DB::table('testing_results')
                    ->join('testing_tests', 'testing_results.test_id', '=', 'testing_tests.id')
                    ->where('testing_tests.binding_id', $binding->id)
                    ->distinct('testing_results.user_id')
                    ->count('testing_results.user_id');

                $passedCount = $binding->results()->where('passed', true)->count();
                $attemptsCount = (int) $binding->attempts_count;
                $successRate = $attemptsCount > 0 ? round(($passedCount / $attemptsCount) * 100) : 0;
                $maxScore = round((float) ($binding->results()->max('score') ?? 0), 1);

                return [
                    'id' => $binding->id,
                    'created_at' => optional($binding->created_at)->toDateTimeString(),
                    'subject' => [
                        'id' => $binding->subject?->id,
                        'name' => $binding->subject?->name,
                        'code' => $binding->subject?->code,
                    ],
                    'tests_count' => (int) $binding->tests_count,
                    'attempts_count' => $attemptsCount,
                    'average_score' => round((float) ($binding->average_score ?? 0), 1),
                    'students_count' => $studentsCount,
                    'success_rate' => $successRate,
                    'max_score' => $maxScore,
                ];
            })
            ->values();

        $totalStudentsCount = \DB::table('testing_results')
            ->join('testing_tests', 'testing_results.test_id', '=', 'testing_tests.id')
            ->join('testing_bindings', 'testing_tests.binding_id', '=', 'testing_bindings.id')
            ->where('testing_bindings.teacher_id', $user->id)
            ->distinct('testing_results.user_id')
            ->count('testing_results.user_id');

        return Inertia::render('Testing/Index', [
            'subjects' => $subjects,
            'bindings' => $bindings,
            'total_students_count' => $totalStudentsCount,
        ]);
    }
}

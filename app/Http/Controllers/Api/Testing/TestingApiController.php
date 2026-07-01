<?php

namespace App\Http\Controllers\Api\Testing;

use App\Http\Controllers\Controller;
use App\Models\Testing\TestingAttempt;
use App\Models\Testing\TestingAttemptAnswer;
use App\Models\Testing\TestingBinding;
use App\Models\Testing\TestingQuestion;
use App\Models\Testing\TestingResult;
use App\Models\Testing\TestingStudentBinding;
use App\Models\Testing\TestingSubject;
use App\Models\Testing\TestingTest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class TestingApiController extends Controller
{
    /**
     * GET /api/testing/subjects
     * Get subjects list.
     */
    public function subjects(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $perPage = (int) $request->query('per_page', 15);

        $query = TestingSubject::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $subjects = $query->paginate($perPage);

        return response()->json([
            'data' => $subjects->items(),
            'current_page' => $subjects->currentPage(),
            'last_page' => $subjects->lastPage(),
            'per_page' => $subjects->perPage(),
            'total' => $subjects->total(),
        ]);
    }

    /**
     * GET /api/testing/subjects/{subjectId}/teachers
     * Get list of teachers having a binding on this subject.
     */
    public function teachers(Request $request, $subjectId): JsonResponse
    {
        $subject = TestingSubject::find($subjectId);
        if (!$subject) {
            return response()->json(['error' => 'Subject not found.'], 404);
        }

        $bindings = TestingBinding::with('teacher:id,name,email')
            ->where('subject_id', $subjectId)
            ->get();

        $teachers = $bindings->map(function ($binding) {
            return [
                'teacher_binding_id' => $binding->id,
                'teacher_id' => $binding->teacher?->id,
                'name' => $binding->teacher?->name,
                'email' => $binding->teacher?->email,
                'created_at' => $binding->created_at?->toDateTimeString(),
            ];
        });

        return response()->json([
            'subject_id' => $subject->id,
            'subject_name' => $subject->name,
            'teachers' => $teachers
        ]);
    }

    /**
     * POST /api/testing/student-bindings
     * Create student binding.
     */
    public function storeStudentBinding(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'studentId' => 'required|string',
            'teacherBindingId' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $teacherBinding = TestingBinding::find($request->input('teacherBindingId'));
        if (!$teacherBinding) {
            return response()->json(['error' => 'Teacher binding not found.'], 404);
        }

        $binding = TestingStudentBinding::firstOrCreate([
            'student_id' => $request->input('studentId'),
            'teacher_binding_id' => $request->input('teacherBindingId'),
        ]);

        return response()->json([
            'message' => 'Student binding created successfully.',
            'data' => $binding
        ], 201);
    }

    /**
     * GET /api/testing/student-bindings/{studentId}
     * Get student bindings.
     */
    public function getStudentBindings(Request $request, $studentId): JsonResponse
    {
        $bindings = TestingStudentBinding::with([
            'teacherBinding.subject',
            'teacherBinding.teacher'
        ])
        ->where('student_id', $studentId)
        ->get();

        $formatted = $bindings->map(function ($b) {
            return [
                'id' => $b->id,
                'student_id' => $b->student_id,
                'teacher_binding_id' => $b->teacher_binding_id,
                'created_at' => $b->created_at?->toDateTimeString(),
                'subject' => [
                    'id' => $b->teacherBinding?->subject?->id,
                    'name' => $b->teacherBinding?->subject?->name,
                    'code' => $b->teacherBinding?->subject?->code,
                ],
                'teacher' => [
                    'id' => $b->teacherBinding?->teacher?->id,
                    'name' => $b->teacherBinding?->teacher?->name,
                    'email' => $b->teacherBinding?->teacher?->email,
                ],
            ];
        });

        return response()->json([
            'student_id' => $studentId,
            'bindings' => $formatted
        ]);
    }

    /**
     * GET /api/testing/tests
     * Get tests list.
     */
    public function tests(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'studentId' => 'required|string',
            'bindingId' => 'required|integer', // teacher_binding_id
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $studentId = $request->query('studentId');
        $bindingId = (int) $request->query('bindingId');

        // Verify student binding exists
        $hasBinding = TestingStudentBinding::where('student_id', $studentId)
            ->where('teacher_binding_id', $bindingId)
            ->exists();

        if (!$hasBinding) {
            return response()->json([
                'error' => 'Student is not bound to this teacher and subject.'
            ], 403);
        }

        $tests = TestingTest::withCount('questions')
            ->where('binding_id', $bindingId)
            ->where('status', 'published')
            ->get();

        $formatted = $tests->map(function ($test) {
            return [
                'id' => $test->id,
                'title' => $test->title,
                'description' => $test->description,
                'question_count' => $test->questions_count,
                'status' => $test->status,
                'published_at' => $test->created_at?->toDateTimeString(),
                'attempts_allowed' => $test->meta['attempts_allowed'] ?? 1,
            ];
        });

        return response()->json([
            'tests' => $formatted
        ]);
    }

    /**
     * GET /api/testing/tests/{testId}
     * Get test details.
     */
    public function showTest(Request $request, $testId): JsonResponse
    {
        $test = TestingTest::where('status', 'published')->find($testId);
        if (!$test) {
            return response()->json(['error' => 'Test not found or not published.'], 404);
        }

        $questions = TestingQuestion::where('test_id', $testId)
            ->orderBy('position')
            ->get()
            ->map(function ($q) {
                return [
                    'id' => $q->id,
                    'text' => $q->text,
                    'type' => $q->type,
                    'options' => $q->options ?: [],
                ];
            });

        return response()->json([
            'id' => $test->id,
            'title' => $test->title,
            'description' => $test->description,
            'time_limit' => $test->time_limit,
            'questions' => $questions,
        ]);
    }

    /**
     * POST /api/testing/tests/{testId}/submit
     * Submit test results.
     */
    public function submitTest(Request $request, $testId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'studentId' => 'required|string',
            'answers' => 'required|array',
            'startedAt' => 'nullable|string',
            'finishedAt' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $test = TestingTest::with('binding')->find($testId);
        if (!$test) {
            return response()->json(['error' => 'Test not found.'], 404);
        }

        $studentId = $request->input('studentId');
        $submittedAnswers = $request->input('answers'); // Format: [ ['questionId' => 1, 'selected' => 'Option A'], ... ]

        $questions = TestingQuestion::where('test_id', $testId)->get();
        if ($questions->isEmpty()) {
            return response()->json(['error' => 'This test has no questions.'], 400);
        }

        $correctCount = 0;
        $totalQuestions = $questions->count();
        $answersDetails = [];

        // Build a mapping of questionId -> answers from input
        $inputMap = [];
        foreach ($submittedAnswers as $ans) {
            if (isset($ans['questionId'])) {
                $inputMap[(int) $ans['questionId']] = $ans['selected'] ?? null;
            }
        }

        foreach ($questions as $q) {
            $selected = $inputMap[$q->id] ?? null;
            $correct = $q->correct_answers ?: [];
            $isCorrect = false;

            if ($selected !== null) {
                if ($q->type === 'multiple_choice') {
                    $selArray = is_array($selected) ? $selected : [$selected];
                    $corArray = is_array($correct) ? $correct : [$correct];

                    // Sort and compare arrays
                    sort($selArray);
                    sort($corArray);
                    $isCorrect = ($selArray === $corArray);
                } else {
                    // Single choice or short text
                    $selStr = trim(strtolower((string) $selected));
                    $corStr = is_array($correct) ? trim(strtolower((string) ($correct[0] ?? ''))) : trim(strtolower((string) $correct));
                    $isCorrect = ($selStr === $corStr);
                }
            }

            if ($isCorrect) {
                $correctCount++;
            }

            $answersDetails[] = [
                'question_id' => $q->id,
                'selected_answer' => $selected,
                'is_correct' => $isCorrect,
            ];
        }

        $percentage = ($correctCount / $totalQuestions) * 100;
        $score = round($percentage, 2);
        $passed = ($percentage >= 50.0); // Passing score threshold

        // Use timestamps
        $startedAt = $request->input('startedAt') ? Carbon::parse($request->input('startedAt')) : now()->subMinutes(10);
        $finishedAt = $request->input('finishedAt') ? Carbon::parse($request->input('finishedAt')) : now();

        // 1. Save in Integration tables
        $attempt = TestingAttempt::create([
            'student_id' => $studentId,
            'test_id' => $testId,
            'teacher_binding_id' => $test->binding_id,
            'subject_id' => $test->binding->subject_id,
            'started_at' => $startedAt,
            'finished_at' => $finishedAt,
            'score' => $score,
            'percentage' => $score,
        ]);

        foreach ($answersDetails as $detail) {
            TestingAttemptAnswer::create([
                'attempt_id' => $attempt->id,
                'question_id' => $detail['question_id'],
                'selected_answer' => is_array($detail['selected_answer']) ? json_encode($detail['selected_answer']) : (string) $detail['selected_answer'],
                'is_correct' => $detail['is_correct'],
            ]);
        }

        // 2. Self-Healing sync with main CRM users and testing_results tables
        $user = User::where('ad_login', $studentId)
            ->orWhere('email', $studentId)
            ->orWhere('id', $studentId)
            ->first();

        if (!$user) {
            $user = User::create([
                'name' => $studentId,
                'email' => str_contains($studentId, '@') ? $studentId : "{$studentId}@kaztbu.edu.kz",
                'ad_login' => $studentId,
                'role' => 'student',
                'password' => bcrypt(Str::random(16)),
            ]);
        }

        TestingResult::create([
            'test_id' => $testId,
            'user_id' => $user->id,
            'correct_answers_count' => $correctCount,
            'score' => $score,
            'passed' => $passed,
            'completed_at' => $finishedAt,
            'details' => [
                'attempt_id' => $attempt->id,
                'answers' => $answersDetails,
                'started_at' => $startedAt->toDateTimeString(),
                'finished_at' => $finishedAt->toDateTimeString(),
            ]
        ]);

        return response()->json([
            'message' => 'Test submitted successfully.',
            'attempt_id' => $attempt->id,
            'score' => $score,
            'percentage' => $score,
            'correct_answers_count' => $correctCount,
            'total_questions' => $totalQuestions,
            'passed' => $passed,
            'finished_at' => $finishedAt->toDateTimeString(),
        ]);
    }

    /**
     * GET /api/testing/results/{studentId}
     * Get student's attempts history.
     */
    public function studentResults(Request $request, $studentId): JsonResponse
    {
        $attempts = TestingAttempt::with(['test', 'subject', 'teacherBinding.teacher'])
            ->where('student_id', $studentId)
            ->orderByDesc('finished_at')
            ->get();

        $formatted = $attempts->map(function ($attempt) {
            return [
                'id' => $attempt->id,
                'test' => [
                    'id' => $attempt->test?->id,
                    'title' => $attempt->test?->title,
                ],
                'subject' => [
                    'id' => $attempt->subject?->id,
                    'name' => $attempt->subject?->name,
                    'code' => $attempt->subject?->code,
                ],
                'teacher' => [
                    'id' => $attempt->teacherBinding?->teacher?->id,
                    'name' => $attempt->teacherBinding?->teacher?->name,
                ],
                'score' => (float) $attempt->score,
                'percentage' => (float) $attempt->percentage,
                'passed' => $attempt->percentage >= 50.0,
                'started_at' => $attempt->started_at?->toDateTimeString(),
                'finished_at' => $attempt->finished_at?->toDateTimeString(),
                'time_taken_seconds' => $attempt->started_at && $attempt->finished_at 
                    ? $attempt->started_at->diffInSeconds($attempt->finished_at) 
                    : 0,
            ];
        });

        return response()->json([
            'student_id' => $studentId,
            'attempts' => $formatted
        ]);
    }

    /**
     * GET /api/testing/analytics/{bindingId}
     * Get teacher analytics.
     */
    public function analytics(Request $request, $bindingId): JsonResponse
    {
        $binding = TestingBinding::with('subject')->find($bindingId);
        if (!$binding) {
            return response()->json(['error' => 'Binding not found.'], 404);
        }

        $attempts = TestingAttempt::where('teacher_binding_id', $bindingId)->get();

        $attemptsCount = $attempts->count();
        $uniqueStudents = $attempts->pluck('student_id')->unique()->count();
        $avgScore = $attemptsCount > 0 ? round($attempts->avg('score'), 2) : 0;
        
        $passedCount = $attempts->filter(function ($a) {
            return $a->percentage >= 50.0;
        })->count();
        $successRate = $attemptsCount > 0 ? round(($passedCount / $attemptsCount) * 100, 2) : 0;

        $recentAttempts = TestingAttempt::with('test')
            ->where('teacher_binding_id', $bindingId)
            ->orderByDesc('finished_at')
            ->limit(10)
            ->get()
            ->map(function ($attempt) {
                // Fetch student name if user exists in crm
                $user = User::where('ad_login', $attempt->student_id)->first();
                $studentName = $user ? $user->name : $attempt->student_id;

                return [
                    'id' => $attempt->id,
                    'student_id' => $attempt->student_id,
                    'student_name' => $studentName,
                    'test_title' => $attempt->test?->title,
                    'score' => (float) $attempt->score,
                    'passed' => $attempt->percentage >= 50.0,
                    'finished_at' => $attempt->finished_at?->toDateTimeString(),
                ];
            });

        return response()->json([
            'binding_id' => $bindingId,
            'subject_name' => $binding->subject?->name,
            'attempts_count' => $attemptsCount,
            'students_count' => $uniqueStudents,
            'average_score' => $avgScore,
            'success_rate' => $successRate,
            'recent_results' => $recentAttempts
        ]);
    }
}

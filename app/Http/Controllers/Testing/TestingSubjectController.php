<?php

namespace App\Http\Controllers\Testing;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Discipline;
use App\Models\User;
use App\Models\Testing\TestingBinding;
use App\Models\Testing\TestingAttempt;
use App\Models\Testing\TestingResult;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TestingSubjectController extends Controller
{
    /**
     * Ensure only admin/superadmin can manage subjects.
     */
    private function authorizeAdmin(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        if (! in_array($role, ['admin', 'superadmin'], true)) {
            abort(403, 'Управление предметами доступно только администраторам.');
        }
    }

    public function index(Request $request): Response
    {
        $this->authorizeAdmin($request);

        $search = $request->query('search', '');

        $disciplines = Discipline::query()
            ->with([
                'department:id,name,code',
                'bindings.teacher:id,name,display_name,email'
            ])
            ->when($search, fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('code', 'like', "%{$search}%"))
            ->orderBy('name')
            ->get()
            ->map(fn (Discipline $d) => [
                'id'            => $d->id,
                'name'          => $d->name,
                'code'          => $d->code,
                'description'   => $d->description,
                'credit_hours'  => $d->credit_hours,
                'department'    => $d->department ? [
                    'id'   => $d->department->id,
                    'name' => $d->department->name,
                    'code' => $d->department->code,
                ] : null,
                'bindings'      => $d->bindings->map(fn ($b) => [
                    'id'         => $b->id,
                    'created_at' => optional($b->created_at)->toDateTimeString(),
                    'teacher'    => $b->teacher ? [
                        'id'    => $b->teacher->id,
                        'name'  => $b->teacher->display_name ?: $b->teacher->name,
                        'email' => $b->teacher->email,
                    ] : null,
                ])->filter(fn ($b) => !empty($b['teacher']))->values(),
            ]);

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Testing/Subjects', [
            'disciplines' => $disciplines,
            'departments' => $departments,
            'filters'     => ['search' => $search],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
        ]);

        $data['code'] = 'SUBJ-' . strtoupper(bin2hex(random_bytes(4)));
        $data['user_id'] = null;
        $data['credit_hours'] = 0;

        Discipline::create($data);

        return redirect()
            ->route('testing.subjects.index')
            ->with('success', 'Предмет успешно создан.');
    }

    public function update(Request $request, Discipline $discipline): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
        ]);

        if (empty($discipline->code)) {
            $data['code'] = 'SUBJ-' . strtoupper(bin2hex(random_bytes(4)));
        }

        $discipline->update($data);

        return redirect()
            ->route('testing.subjects.index')
            ->with('success', 'Предмет успешно обновлён.');
    }

    public function destroy(Request $request, Discipline $discipline): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $discipline->delete();

        return redirect()
            ->route('testing.subjects.index')
            ->with('success', 'Предмет удалён.');
    }

    public function getBindingStudents(Request $request, $bindingId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $binding = TestingBinding::with(['subject', 'teacher'])->findOrFail($bindingId);

        // Fetch all bound students from testing_student_bindings
        $boundStudents = \DB::table('testing_student_bindings')
            ->where('teacher_binding_id', $bindingId)
            ->pluck('student_id')
            ->toArray();

        // Fetch all student attempts from testing_attempts
        $attempts = TestingAttempt::with('test')
            ->where('teacher_binding_id', $bindingId)
            ->orderByDesc('finished_at')
            ->get();

        $studentMap = [];

        // Pre-populate with bound students
        foreach ($boundStudents as $studentId) {
            $user = User::where('ad_login', $studentId)
                ->orWhere('email', $studentId)
                ->orWhere('id', $studentId)
                ->first();

            $studentMap[$studentId] = [
                'student_id' => $studentId,
                'name' => $user ? ($user->display_name ?: $user->name) : $studentId,
                'email' => $user ? $user->email : '—',
                'attempts' => [],
            ];
        }

        // Add attempts to mapping
        foreach ($attempts as $attempt) {
            $studentId = $attempt->student_id;
            
            if (!isset($studentMap[$studentId])) {
                $user = User::where('ad_login', $studentId)
                    ->orWhere('email', $studentId)
                    ->orWhere('id', $studentId)
                    ->first();

                $studentMap[$studentId] = [
                    'student_id' => $studentId,
                    'name' => $user ? ($user->display_name ?: $user->name) : $studentId,
                    'email' => $user ? $user->email : '—',
                    'attempts' => [],
                ];
            }

            $studentMap[$studentId]['attempts'][] = [
                'id' => $attempt->id,
                'test_title' => $attempt->test?->title ?: 'Удаленный тест',
                'score' => (float) $attempt->score,
                'percentage' => (float) $attempt->percentage,
                'passed' => $attempt->percentage >= 50.0,
                'completed_at' => $attempt->finished_at ? $attempt->finished_at->toDateTimeString() : '—',
            ];
        }

        // Merge results from testing_results table
        $legacyResults = TestingResult::with(['user', 'test'])
            ->whereHas('test', function ($query) use ($bindingId) {
                $query->where('binding_id', $bindingId);
            })
            ->orderByDesc('completed_at')
            ->get();

        foreach ($legacyResults as $res) {
            if (!$res->user) continue;
            
            $studentId = $res->user->ad_login ?: (string) $res->user->id;
            
            if (!isset($studentMap[$studentId])) {
                $studentMap[$studentId] = [
                    'student_id' => $studentId,
                    'name' => $res->user->display_name ?: $res->user->name,
                    'email' => $res->user->email ?: '—',
                    'attempts' => [],
                ];
            }

            // Check if this attempt is already added
            $exists = false;
            foreach ($studentMap[$studentId]['attempts'] as $existingAttempt) {
                if ($existingAttempt['test_title'] === ($res->test?->title ?: 'Удаленный тест') &&
                    abs(strtotime($existingAttempt['completed_at']) - strtotime($res->completed_at?->toDateTimeString())) < 5) {
                    $exists = true;
                    break;
                }
            }

            if (!$exists) {
                $studentMap[$studentId]['attempts'][] = [
                    'id' => $res->id,
                    'test_title' => $res->test?->title ?: 'Удаленный тест',
                    'score' => (float) $res->score,
                    'percentage' => (float) $res->score,
                    'passed' => (bool) $res->passed,
                    'completed_at' => $res->completed_at ? $res->completed_at->toDateTimeString() : '—',
                ];
            }
        }

        return response()->json([
            'binding_id' => $binding->id,
            'subject_name' => $binding->subject?->name,
            'teacher_name' => $binding->teacher?->display_name ?: $binding->teacher?->name,
            'students' => array_values($studentMap),
        ]);
    }
}

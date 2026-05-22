<?php

namespace App\Http\Controllers;

use App\Models\Discipline;
use App\Models\Group;
use App\Models\Student;
use App\Models\Survey;
use App\Services\SurveyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class SurveyAdminController extends Controller
{
    public function index()
    {
        Gate::authorize('viewAny', Survey::class);
        $surveys = Survey::with(['student', 'teacher', 'discipline', 'group'])->get();
        return view('surveys.admin.index', compact('surveys'));
    }

    public function create()
    {
        Gate::authorize('create', Survey::class);
        $groups = Group::orderBy('name')->get(['id', 'name', 'code']);
        $disciplines = Discipline::orderBy('name')->get(['id', 'name']);

        return view('surveys.admin.create', compact('groups', 'disciplines'));
    }

    public function groupsIndex()
    {
        Gate::authorize('viewAny', Survey::class);

        $groups = Group::query()
            ->withCount('students')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'description']);

        $students = Student::query()
            ->with('group:id,name')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(function (Student $student) {
                return [
                    'id' => $student->id,
                    'full_name' => $student->full_name,
                    'student_id' => $student->student_id,
                    'group_id' => $student->group_id,
                    'group_name' => $student->group?->name,
                ];
            })
            ->values();

        return Inertia::render('Admin/SurveyGroups', [
            'groups' => $groups,
            'students' => $students,
        ]);
    }

    public function groupsStore(Request $request)
    {
        Gate::authorize('create', Survey::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100', 'unique:groups,code'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        Group::create($data);

        return back()->with('success', 'Группа создана');
    }

    public function groupsUpdate(Request $request, Group $group)
    {
        Gate::authorize('create', Survey::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('groups', 'code')->ignore($group->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $group->update($data);

        return back()->with('success', 'Группа обновлена');
    }

    public function groupsDestroy(Group $group)
    {
        Gate::authorize('create', Survey::class);

        if ($group->students()->exists()) {
            return back()->with('error', 'Нельзя удалить группу, пока в ней есть студенты');
        }

        $group->delete();

        return back()->with('success', 'Группа удалена');
    }

    public function studentsIndex()
    {
        Gate::authorize('viewAny', Survey::class);

        $students = Student::query()
            ->with('group:id,name')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(function (Student $student) {
                return [
                    'id' => $student->id,
                    'first_name' => $student->first_name,
                    'last_name' => $student->last_name,
                    'middle_name' => $student->middle_name,
                    'student_id' => $student->student_id,
                    'email' => $student->email,
                    'phone' => $student->phone,
                    'group_id' => $student->group_id,
                    'full_name' => $student->full_name,
                    'group' => $student->group ? ['id' => $student->group->id, 'name' => $student->group->name] : null,
                ];
            })
            ->values();

        $groups = Group::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Admin/SurveyStudents', [
            'students' => $students,
            'groups' => $groups,
        ]);
    }

    public function studentsStore(Request $request)
    {
        Gate::authorize('create', Survey::class);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'student_id' => ['required', 'string', 'max:100', 'unique:students,student_id'],
            'email' => ['nullable', 'email', 'max:255', 'unique:students,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
        ]);

        Student::create($data);

        return back()->with('success', 'Студент добавлен');
    }

    public function studentsUpdate(Request $request, Student $student)
    {
        Gate::authorize('create', Survey::class);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'student_id' => ['required', 'string', 'max:100', Rule::unique('students', 'student_id')->ignore($student->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('students', 'email')->ignore($student->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
        ]);

        $student->update($data);

        return back()->with('success', 'Данные студента обновлены');
    }

    public function studentsDestroy(Student $student)
    {
        Gate::authorize('create', Survey::class);

        $student->delete();

        return back()->with('success', 'Студент удален');
    }

    public function studentsAssignGroup(Request $request, Student $student)
    {
        Gate::authorize('create', Survey::class);

        $data = $request->validate([
            'group_id' => ['required', 'integer', 'exists:groups,id'],
        ]);

        $student->update([
            'group_id' => $data['group_id'],
        ]);

        return back()->with('success', 'Привязка обновлена');
    }

    public function storeBulk(Request $request, SurveyService $service)
    {
        Gate::authorize('create', Survey::class);
        $data = $request->validate([
            'group_id' => 'required|integer|exists:groups,id',
            'discipline_id' => 'required|integer|exists:disciplines,id',
        ]);
        $service->createBulkSurveys($data['group_id'], $data['discipline_id']);
        return redirect()->route('admin.surveys.index')->with('success', 'Анкеты созданы для всех студентов группы');
    }

    public function show(Survey $survey)
    {
        Gate::authorize('view', $survey);
        $survey->load(['student', 'teacher', 'discipline', 'group', 'answers.question']);
        return view('surveys.admin.show', compact('survey'));
    }

    public function cancel(Survey $survey)
    {
        Gate::authorize('update', $survey);
        $survey->cancel();
        $survey->save();
        return back()->with('success', 'Анкета отменена');
    }

    public function destroy(Survey $survey)
    {
        Gate::authorize('delete', $survey);
        $survey->delete();
        return redirect()->route('admin.surveys.index')->with('success', 'Анкета удалена');
    }
}

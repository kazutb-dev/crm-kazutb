<?php

namespace App\Http\Controllers\Api\Questionnaire;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Questionnaire\GroupCourse;
use App\Models\Questionnaire\GroupEducationalProgram;
use App\Models\Questionnaire\Discipline;
use App\Models\Questionnaire\Group;
use App\Models\Questionnaire\GroupDiscipline;
use App\Models\Questionnaire\GroupSpeciality;
use App\Models\Questionnaire\Student;
use App\Models\Questionnaire\Survey;
use App\Models\Questionnaire\SurveyOption;
use App\Models\Questionnaire\SurveyQuestion;
use App\Models\Questionnaire\TeacherDiscipline;
use App\Models\User;
use App\Services\ActiveDirectoryAuthenticator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDictionaryController extends Controller
{
    private const TEACHER_DISCIPLINE_DEFAULT_ACADEMIC_YEAR = 'all';

    private const TEACHER_DISCIPLINE_DEFAULT_SEMESTER = 'all';

    public function studentsIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $students = Student::query()
            ->with([
                'group:id,name',
                'user:id,name,display_name,email,ad_login,role,role_id',
            ])
            ->orderBy('full_name')
            ->get();

        $studentUsers = User::query()
            ->with('roleRef:id,slug')
            ->where(function ($query): void {
                $query->where('role', 'student')
                    ->orWhereHas('roleRef', function ($roleQuery): void {
                        $roleQuery->where('slug', 'student');
                    });
            })
            ->orderBy('name')
            ->get(['id', 'name', 'display_name', 'email', 'ad_login', 'role', 'role_id']);

        return response()->json([
            'data' => $students,
            'meta' => [
                'groups' => Group::query()->orderBy('name')->get(['id', 'name']),
                'student_users' => $studentUsers,
            ],
        ]);
    }

    public function studentsStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id', 'required_without:ad_login'],
            'ad_login' => ['nullable', 'string', 'max:255', 'required_without:user_id'],
            'full_name' => ['nullable', 'string', 'max:255'],
            'group_id' => ['required', 'integer', 'exists:questionnaire_groups,id'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $user = null;
        $adLogin = null;
        $fullName = null;
        $studentQuery = Student::query();

        if (! empty($data['user_id'])) {
            $user = User::query()->findOrFail((int) $data['user_id']);
            $adLogin = $user->ad_login;
            $fullName = (string) ($user->display_name ?: $user->name ?: $user->email ?: $user->ad_login ?: ('user_'.$user->id));

            $studentQuery
                ->where('user_id', (int) $data['user_id'])
                ->orWhere(function ($query) use ($user): void {
                    if (! empty($user->ad_login)) {
                        $query->where('login', (string) $user->ad_login);
                    }
                });
        } else {
            $adLogin = trim((string) ($data['ad_login'] ?? ''));
            $fullName = trim((string) ($data['full_name'] ?? ''));

            if ($adLogin === '') {
                return response()->json([
                    'message' => 'Укажите AD логин студента.',
                ], 422);
            }

            if ($fullName === '') {
                $fullName = $adLogin;
            }

            $studentQuery->where('login', $adLogin);
        }

        $student = $studentQuery->first();

        if ($student) {
            $student->update([
                'full_name' => (string) $fullName,
                'user_id' => $user?->id,
                'login' => $adLogin,
                'group_id' => (int) $data['group_id'],
                'status' => (string) $data['status'],
            ]);
        } else {
            $student = Student::query()->create([
                'full_name' => (string) $fullName,
                'user_id' => $user?->id,
                'login' => $adLogin,
                'group_id' => (int) $data['group_id'],
                'status' => (string) $data['status'],
            ]);
        }

        return response()->json([
            'message' => 'Привязка студента к группе сохранена.',
            'data' => $student->load(['group:id,name', 'user:id,name,display_name,email,ad_login']),
        ], 201);
    }

    public function studentsAdSearch(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        $search = trim((string) ($data['q'] ?? ''));
        $adUsers = app(ActiveDirectoryAuthenticator::class)->listStudentUsers($search) ?? [];

        $result = collect($adUsers)
            ->filter(fn (array $item): bool => trim((string) ($item['login'] ?? '')) !== '')
            ->map(function (array $item): array {
                $login = trim((string) ($item['login'] ?? ''));

                return [
                    'ad_login' => $login,
                    'display_name' => trim((string) ($item['display_name'] ?? $login)),
                    'email' => $item['email'] ?? null,
                    'department' => $item['department'] ?? null,
                ];
            })
            ->take(50)
            ->values()
            ->all();

        return response()->json([
            'data' => $result,
        ]);
    }

    public function studentsUpdate(Request $request, Student $student): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'group_id' => ['sometimes', 'required', 'integer', 'exists:questionnaire_groups,id'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        $student->update($data);

        return response()->json([
            'message' => 'Привязка студента обновлена.',
            'data' => $student->fresh()->load(['group:id,name', 'user:id,name,display_name,email,ad_login']),
        ]);
    }

    public function studentsDestroy(Request $request, Student $student): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $student->delete();

        return response()->json([
            'message' => 'Привязка студента удалена.',
        ]);
    }

    public function teachersIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $teachers = User::query()
            ->with('roleRef:id,slug')
            ->where(function ($query): void {
                $query->where('role', 'teacher')
                    ->orWhereHas('roleRef', function ($roleQuery): void {
                        $roleQuery->where('slug', 'teacher');
                    });
            })
            ->orderBy('name')
            ->get(['id', 'name', 'display_name', 'email', 'ad_login', 'role', 'role_id']);

        return response()->json([
            'data' => $teachers,
        ]);
    }

    public function teacherDisciplinesIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $teacherOverallRatings = DB::table('questionnaire_survey_answers')
            ->join('questionnaire_survey_responses', 'questionnaire_survey_responses.id', '=', 'questionnaire_survey_answers.response_id')
            ->leftJoin('questionnaire_survey_options', 'questionnaire_survey_options.id', '=', 'questionnaire_survey_answers.option_id')
            ->where('questionnaire_survey_responses.status', 'submitted')
            ->where(function ($query): void {
                $query->whereNotNull('questionnaire_survey_options.score')
                    ->orWhereNotNull('questionnaire_survey_answers.numeric_answer');
            })
            ->groupBy('questionnaire_survey_responses.teacher_id')
            ->get([
                'questionnaire_survey_responses.teacher_id',
                DB::raw('ROUND(AVG(COALESCE(questionnaire_survey_options.score, questionnaire_survey_answers.numeric_answer)), 2) as average_score'),
                DB::raw('COUNT(*) as answers_count'),
                DB::raw('COUNT(DISTINCT questionnaire_survey_responses.id) as responses_count'),
            ]);

        $teacherDisciplineRatings = DB::table('questionnaire_survey_answers')
            ->join('questionnaire_survey_responses', 'questionnaire_survey_responses.id', '=', 'questionnaire_survey_answers.response_id')
            ->leftJoin('questionnaire_survey_options', 'questionnaire_survey_options.id', '=', 'questionnaire_survey_answers.option_id')
            ->join('questionnaire_disciplines', 'questionnaire_disciplines.id', '=', 'questionnaire_survey_responses.discipline_id')
            ->where('questionnaire_survey_responses.status', 'submitted')
            ->where(function ($query): void {
                $query->whereNotNull('questionnaire_survey_options.score')
                    ->orWhereNotNull('questionnaire_survey_answers.numeric_answer');
            })
            ->groupBy('questionnaire_survey_responses.teacher_id', 'questionnaire_survey_responses.discipline_id', 'questionnaire_disciplines.name')
            ->orderBy('questionnaire_disciplines.name')
            ->get([
                'questionnaire_survey_responses.teacher_id',
                'questionnaire_survey_responses.discipline_id',
                'questionnaire_disciplines.name as discipline_name',
                DB::raw('ROUND(AVG(COALESCE(questionnaire_survey_options.score, questionnaire_survey_answers.numeric_answer)), 2) as average_score'),
                DB::raw('COUNT(*) as answers_count'),
                DB::raw('COUNT(DISTINCT questionnaire_survey_responses.id) as responses_count'),
            ]);

        return response()->json([
            'data' => TeacherDiscipline::query()
                ->with([
                    'teacher:id,name,display_name,email,ad_login',
                    'discipline:id,name,code,status',
                    'groupDisciplines:id,teacher_discipline_id,group_id,academic_year,semester,status',
                    'groupDisciplines.group' => fn ($query) => $query->select(['id', 'name'])->withCount('students'),
                ])
                ->orderByDesc('id')
                ->get(),
            'meta' => [
                'ratings' => [
                    'teacher_overall' => $teacherOverallRatings,
                    'teacher_discipline' => $teacherDisciplineRatings,
                ],
            ],
        ]);
    }

    public function teacherDisciplinesStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'teacher_id' => ['required', 'integer', 'exists:users,id'],
            'discipline_id' => ['required', 'integer', 'exists:questionnaire_disciplines,id'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $assignment = TeacherDiscipline::query()->updateOrCreate([
            'teacher_id' => (int) $data['teacher_id'],
            'discipline_id' => (int) $data['discipline_id'],
            'academic_year' => self::TEACHER_DISCIPLINE_DEFAULT_ACADEMIC_YEAR,
            'semester' => self::TEACHER_DISCIPLINE_DEFAULT_SEMESTER,
        ], [
            'status' => (string) $data['status'],
        ]);

        return response()->json([
            'message' => 'Привязка преподавателя к дисциплине сохранена.',
            'data' => $assignment->load([
                'teacher:id,name,display_name,email,ad_login',
                'discipline:id,name,code,status',
                'groupDisciplines:id,teacher_discipline_id,group_id,academic_year,semester,status',
                'groupDisciplines.group' => fn ($query) => $query->select(['id', 'name'])->withCount('students'),
            ]),
        ], 201);
    }

    public function teacherDisciplinesUpdate(Request $request, TeacherDiscipline $teacherDiscipline): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        $teacherDiscipline->update($data);

        return response()->json([
            'message' => 'Привязка преподавателя обновлена.',
            'data' => $teacherDiscipline->fresh()->load([
                'teacher:id,name,display_name,email,ad_login',
                'discipline:id,name,code,status',
                'groupDisciplines:id,teacher_discipline_id,group_id,academic_year,semester,status',
                'groupDisciplines.group' => fn ($query) => $query->select(['id', 'name'])->withCount('students'),
            ]),
        ]);
    }

    public function teacherDisciplinesDestroy(Request $request, TeacherDiscipline $teacherDiscipline): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        if ($teacherDiscipline->groupDisciplines()->exists()) {
            return response()->json([
                'message' => 'Нельзя удалить привязку, пока есть связанные назначения для групп.',
            ], 422);
        }

        $teacherDiscipline->delete();

        return response()->json([
            'message' => 'Привязка преподавателя удалена.',
        ]);
    }

    public function groupDisciplinesIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $groupDisciplines = GroupDiscipline::query()
            ->with([
                'group:id,name',
                'teacherDiscipline:id,teacher_id,discipline_id,academic_year,semester,status',
                'teacherDiscipline.teacher:id,name,display_name,email,ad_login',
                'teacherDiscipline.discipline:id,name,code,status',
            ])
            ->orderByDesc('id')
            ->get();

        $teacherDisciplines = TeacherDiscipline::query()
            ->with([
                'teacher:id,name,display_name,email,ad_login',
                'discipline:id,name,code,status',
            ])
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $groupDisciplines,
            'meta' => [
                'groups' => Group::query()->orderBy('name')->get(['id', 'name']),
                'teacher_disciplines' => $teacherDisciplines,
            ],
        ]);
    }

    public function groupDisciplinesStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'group_id' => ['required', 'integer', 'exists:questionnaire_groups,id'],
            'teacher_discipline_id' => ['required', 'integer', 'exists:questionnaire_teacher_disciplines,id'],
            'academic_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'string', 'max:20'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $assignment = GroupDiscipline::query()->updateOrCreate([
            'group_id' => (int) $data['group_id'],
            'teacher_discipline_id' => (int) $data['teacher_discipline_id'],
            'academic_year' => (string) $data['academic_year'],
            'semester' => (string) $data['semester'],
        ], [
            'status' => (string) $data['status'],
        ]);

        return response()->json([
            'message' => 'Назначение группы сохранено.',
            'data' => $assignment->load([
                'group:id,name',
                'teacherDiscipline:id,teacher_id,discipline_id,academic_year,semester,status',
                'teacherDiscipline.teacher:id,name,display_name,email,ad_login',
                'teacherDiscipline.discipline:id,name,code,status',
            ]),
        ], 201);
    }

    public function groupDisciplinesUpdate(Request $request, GroupDiscipline $groupDiscipline): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'group_id' => ['sometimes', 'required', 'integer', 'exists:questionnaire_groups,id'],
            'teacher_discipline_id' => ['sometimes', 'required', 'integer', 'exists:questionnaire_teacher_disciplines,id'],
            'academic_year' => ['sometimes', 'required', 'string', 'max:20'],
            'semester' => ['sometimes', 'required', 'string', 'max:20'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        if (array_key_exists('teacher_discipline_id', $data)) {
            $teacherDiscipline = TeacherDiscipline::query()->findOrFail((int) $data['teacher_discipline_id']);
            $data['academic_year'] = $data['academic_year'] ?? $teacherDiscipline->academic_year;
            $data['semester'] = $data['semester'] ?? $teacherDiscipline->semester;
        }

        $groupDiscipline->update($data);

        return response()->json([
            'message' => 'Назначение группы обновлено.',
            'data' => $groupDiscipline->fresh()->load([
                'group:id,name',
                'teacherDiscipline:id,teacher_id,discipline_id,academic_year,semester,status',
                'teacherDiscipline.teacher:id,name,display_name,email,ad_login',
                'teacherDiscipline.discipline:id,name,code,status',
            ]),
        ]);
    }

    public function groupDisciplinesDestroy(Request $request, GroupDiscipline $groupDiscipline): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $hasResponses = DB::table('questionnaire_survey_responses')
            ->where('group_discipline_id', $groupDiscipline->id)
            ->exists();

        if ($hasResponses) {
            return response()->json([
                'message' => 'Нельзя удалить назначение, по нему уже есть ответы анкетирования.',
            ], 422);
        }

        $groupDiscipline->delete();

        return response()->json([
            'message' => 'Назначение группы удалено.',
        ]);
    }

    public function groupsIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $groups = Group::query()
            ->with(['courseRef:id,name', 'specialityRef:id,name,department_id', 'specialityRef.department:id,name', 'educationalProgramRef:id,name'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $groups,
            'meta' => [
                'courses' => GroupCourse::query()->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
                'specialities' => GroupSpeciality::query()->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
                'educational_programs' => GroupEducationalProgram::query()->orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'group_speciality_id']),
            ],
        ]);
    }

    public function specialitiesIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        return response()->json([
            'data' => GroupSpeciality::query()
                ->with(['department:id,name'])
                ->withCount('educationalPrograms')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'meta' => [
                'departments' => Department::query()->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function specialitiesStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:questionnaire_group_specialities,name'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $speciality = GroupSpeciality::query()->create([
            'name' => (string) $data['name'],
            'department_id' => ! empty($data['department_id']) ? (int) $data['department_id'] : null,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'status' => (string) $data['status'],
        ]);

        return response()->json([
            'message' => 'Специальность создана.',
            'data' => $speciality->fresh()->load(['department:id,name'])->loadCount('educationalPrograms'),
        ], 201);
    }

    public function specialitiesUpdate(Request $request, GroupSpeciality $speciality): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', 'unique:questionnaire_group_specialities,name,'.$speciality->id],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        $speciality->update($data);

        return response()->json([
            'message' => 'Специальность обновлена.',
            'data' => $speciality->fresh()->load(['department:id,name'])->loadCount('educationalPrograms'),
        ]);
    }

    public function specialitiesDestroy(Request $request, GroupSpeciality $speciality): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        if ($speciality->groups()->exists()) {
            return response()->json([
                'message' => 'Нельзя удалить специальность, пока она используется в группах.',
            ], 422);
        }

        if ($speciality->educationalPrograms()->exists()) {
            return response()->json([
                'message' => 'Нельзя удалить специальность, пока к ней привязаны образовательные программы.',
            ], 422);
        }

        $speciality->delete();

        return response()->json([
            'message' => 'Специальность удалена.',
        ]);
    }

    public function educationalProgramsIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        return response()->json([
            'data' => GroupEducationalProgram::query()
                ->with(['speciality:id,name'])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'meta' => [
                'specialities' => GroupSpeciality::query()->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function educationalProgramsStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:questionnaire_group_educational_programs,name'],
            'speciality_id' => ['required', 'integer', 'exists:questionnaire_group_specialities,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $program = GroupEducationalProgram::query()->create([
            'name' => (string) $data['name'],
            'group_speciality_id' => (int) $data['speciality_id'],
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'status' => (string) $data['status'],
        ]);

        return response()->json([
            'message' => 'Образовательная программа создана.',
            'data' => $program->fresh()->load(['speciality:id,name']),
        ], 201);
    }

    public function educationalProgramsUpdate(Request $request, GroupEducationalProgram $educationalProgram): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', 'unique:questionnaire_group_educational_programs,name,'.$educationalProgram->id],
            'speciality_id' => ['sometimes', 'required', 'integer', 'exists:questionnaire_group_specialities,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        if (array_key_exists('speciality_id', $data)) {
            $data['group_speciality_id'] = (int) $data['speciality_id'];
            unset($data['speciality_id']);
        }

        $educationalProgram->update($data);

        return response()->json([
            'message' => 'Образовательная программа обновлена.',
            'data' => $educationalProgram->fresh()->load(['speciality:id,name']),
        ]);
    }

    public function educationalProgramsDestroy(Request $request, GroupEducationalProgram $educationalProgram): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        if ($educationalProgram->groups()->exists()) {
            return response()->json([
                'message' => 'Нельзя удалить программу, пока она используется в группах.',
            ], 422);
        }

        $educationalProgram->delete();

        return response()->json([
            'message' => 'Образовательная программа удалена.',
        ]);
    }

    public function groupsStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'course_id' => ['nullable', 'integer', 'exists:questionnaire_group_courses,id'],
            'speciality_id' => ['nullable', 'integer', 'exists:questionnaire_group_specialities,id'],
            'educational_program_id' => ['nullable', 'integer', 'exists:questionnaire_group_educational_programs,id'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $course = ! empty($data['course_id']) ? GroupCourse::query()->find((int) $data['course_id']) : null;
        $speciality = ! empty($data['speciality_id']) ? GroupSpeciality::query()->find((int) $data['speciality_id']) : null;
        $program = ! empty($data['educational_program_id']) ? GroupEducationalProgram::query()->find((int) $data['educational_program_id']) : null;

        $group = Group::query()->create([
            'name' => (string) $data['name'],
            'group_course_id' => $course?->id,
            'group_speciality_id' => $speciality?->id,
            'group_educational_program_id' => $program?->id,
            'course' => $course?->name,
            'speciality' => $speciality?->name,
            'educational_program' => $program?->name,
            'status' => (string) $data['status'],
        ]);

        return response()->json([
            'message' => 'Группа создана.',
            'data' => $group->load(['courseRef:id,name', 'specialityRef:id,name,department_id', 'specialityRef.department:id,name', 'educationalProgramRef:id,name']),
        ], 201);
    }

    public function groupsUpdate(Request $request, Group $group): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'course_id' => ['nullable', 'integer', 'exists:questionnaire_group_courses,id'],
            'speciality_id' => ['nullable', 'integer', 'exists:questionnaire_group_specialities,id'],
            'educational_program_id' => ['nullable', 'integer', 'exists:questionnaire_group_educational_programs,id'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        if (array_key_exists('course_id', $data)) {
            $course = ! empty($data['course_id']) ? GroupCourse::query()->find((int) $data['course_id']) : null;
            $data['group_course_id'] = $course?->id;
            $data['course'] = $course?->name;
            unset($data['course_id']);
        }

        if (array_key_exists('speciality_id', $data)) {
            $speciality = ! empty($data['speciality_id']) ? GroupSpeciality::query()->find((int) $data['speciality_id']) : null;
            $data['group_speciality_id'] = $speciality?->id;
            $data['speciality'] = $speciality?->name;
            unset($data['speciality_id']);
        }

        if (array_key_exists('educational_program_id', $data)) {
            $program = ! empty($data['educational_program_id']) ? GroupEducationalProgram::query()->find((int) $data['educational_program_id']) : null;
            $data['group_educational_program_id'] = $program?->id;
            $data['educational_program'] = $program?->name;
            unset($data['educational_program_id']);
        }

        $group->update($data);

        return response()->json([
            'message' => 'Группа обновлена.',
            'data' => $group->fresh()->load(['courseRef:id,name', 'specialityRef:id,name,department_id', 'specialityRef.department:id,name', 'educationalProgramRef:id,name']),
        ]);
    }

    public function groupsDestroy(Request $request, Group $group): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        if ($group->students()->exists()) {
            return response()->json([
                'message' => 'Нельзя удалить группу, пока к ней привязаны студенты.',
            ], 422);
        }

        $group->delete();

        return response()->json([
            'message' => 'Группа удалена.',
        ]);
    }

    public function disciplinesIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        return response()->json([
            'data' => Discipline::query()->orderBy('name')->get(),
        ]);
    }

    public function disciplinesStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255', 'unique:questionnaire_disciplines,code'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $discipline = Discipline::query()->create($data);

        return response()->json([
            'message' => 'Дисциплина создана.',
            'data' => $discipline,
        ], 201);
    }

    public function disciplinesUpdate(Request $request, Discipline $discipline): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255', 'unique:questionnaire_disciplines,code,'.$discipline->id],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        $discipline->update($data);

        return response()->json([
            'message' => 'Дисциплина обновлена.',
            'data' => $discipline->fresh(),
        ]);
    }

    public function disciplinesDestroy(Request $request, Discipline $discipline): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        if ($discipline->teacherDisciplines()->exists()) {
            return response()->json([
                'message' => 'Нельзя удалить дисциплину, пока есть связанные назначения преподавателей.',
            ], 422);
        }

        $discipline->delete();

        return response()->json([
            'message' => 'Дисциплина удалена.',
        ]);
    }

    public function surveysIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        return response()->json([
            'data' => Survey::query()
                ->with(['targetGroup:id,name'])
                ->orderByDesc('id')
                ->get([
                    'id',
                    'title',
                    'description',
                    'academic_year',
                    'semester',
                    'target_scope',
                    'target_group_id',
                    'start_date',
                    'end_date',
                    'status',
                ]),
            'meta' => [
                'groups' => Group::query()->orderBy('name')->get(['id', 'name', 'course']),
            ],
        ]);
    }

    public function surveysStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'academic_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'string', 'max:20'],
            'target_scope' => ['required', 'in:global,group'],
            'target_group_id' => ['nullable', 'integer', 'exists:questionnaire_groups,id', 'required_if:target_scope,group'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        if (($data['target_scope'] ?? 'global') !== 'group') {
            $data['target_group_id'] = null;
        }

        $survey = Survey::query()->create($data);

        return response()->json([
            'message' => 'Опрос создан.',
            'data' => $survey->load(['targetGroup:id,name']),
        ], 201);
    }

    public function surveysUpdate(Request $request, Survey $survey): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'academic_year' => ['sometimes', 'required', 'string', 'max:20'],
            'semester' => ['sometimes', 'required', 'string', 'max:20'],
            'target_scope' => ['sometimes', 'required', 'in:global,group'],
            'target_group_id' => ['nullable', 'integer', 'exists:questionnaire_groups,id'],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date' => ['sometimes', 'required', 'date', 'after_or_equal:start_date'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        $scope = (string) ($data['target_scope'] ?? $survey->target_scope ?? 'global');
        if ($scope !== 'group') {
            $data['target_group_id'] = null;
        } elseif (! array_key_exists('target_group_id', $data)) {
            $data['target_group_id'] = $survey->target_group_id;
        }

        $survey->update($data);

        return response()->json([
            'message' => 'Опрос обновлен.',
            'data' => $survey->fresh()->load(['targetGroup:id,name']),
        ]);
    }

    public function surveysDestroy(Request $request, Survey $survey): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $survey->delete();

        return response()->json([
            'message' => 'Опрос удален.',
        ]);
    }

    public function questionsIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $query = SurveyQuestion::query()
            ->with(['survey:id,title'])
            ->orderBy('sort_order');

        if ($request->filled('survey_id')) {
            $query->where('survey_id', (int) $request->input('survey_id'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function questionsStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'survey_id' => ['required', 'integer', 'exists:questionnaire_surveys,id'],
            'question_text' => ['required', 'string'],
            'question_type' => ['required', 'in:single_choice,multiple_choice,text,numeric'],
            'is_required' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $question = SurveyQuestion::query()->create([
            ...$data,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json([
            'message' => 'Вопрос создан.',
            'data' => $question,
        ], 201);
    }

    public function questionsUpdate(Request $request, SurveyQuestion $question): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'survey_id' => ['sometimes', 'required', 'integer', 'exists:questionnaire_surveys,id'],
            'question_text' => ['sometimes', 'required', 'string'],
            'question_type' => ['sometimes', 'required', 'in:single_choice,multiple_choice,text,numeric'],
            'is_required' => ['sometimes', 'required', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $question->update($data);

        return response()->json([
            'message' => 'Вопрос обновлен.',
            'data' => $question->fresh(),
        ]);
    }

    public function questionsDestroy(Request $request, SurveyQuestion $question): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $question->delete();

        return response()->json([
            'message' => 'Вопрос удален.',
        ]);
    }

    public function optionsIndex(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $query = SurveyOption::query()
            ->with(['question:id,question_text'])
            ->orderBy('sort_order');

        if ($request->filled('question_id')) {
            $query->where('question_id', (int) $request->input('question_id'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function optionsStore(Request $request): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'question_id' => ['required', 'integer', 'exists:questionnaire_survey_questions,id'],
            'option_text' => ['required', 'string', 'max:255'],
            'score' => ['nullable', 'numeric'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $option = SurveyOption::query()->create([
            ...$data,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json([
            'message' => 'Опция создана.',
            'data' => $option,
        ], 201);
    }

    public function optionsUpdate(Request $request, SurveyOption $option): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $data = $request->validate([
            'question_id' => ['sometimes', 'required', 'integer', 'exists:questionnaire_survey_questions,id'],
            'option_text' => ['sometimes', 'required', 'string', 'max:255'],
            'score' => ['nullable', 'numeric'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $option->update($data);

        return response()->json([
            'message' => 'Опция обновлена.',
            'data' => $option->fresh(),
        ]);
    }

    public function optionsDestroy(Request $request, SurveyOption $option): JsonResponse
    {
        $authError = $this->ensureAdmin($request);
        if ($authError !== null) {
            return $authError;
        }

        $option->delete();

        return response()->json([
            'message' => 'Опция удалена.',
        ]);
    }

    private function ensureAdmin(Request $request): ?JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Не авторизован.',
            ], 401);
        }

        if (! in_array((string) $user->resolvedRoleSlug(), ['admin', 'superadmin'], true)) {
            return response()->json([
                'message' => 'Недостаточно прав.',
            ], 403);
        }

        return null;
    }
}

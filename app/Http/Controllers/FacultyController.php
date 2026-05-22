<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FacultyController extends Controller
{
    public function index(): Response
    {
        $faculties = Faculty::query()
            ->with([
                'departments' => fn ($query) => $query->orderBy('name'),
            ])
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'description']);

        $facultyIds = $faculties->pluck('id')->values();
        $departmentIds = $faculties
            ->flatMap(fn (Faculty $faculty) => $faculty->departments->pluck('id'))
            ->values();

        $staff = User::query()
            ->with('roleRef:id,slug,name')
            ->select([
                'id',
                'name',
                'display_name',
                'email',
                'role',
                'role_id',
                'faculty_id',
                'department_id',
                'position_title',
                'ad_title',
            ])
            ->where(function ($query) use ($facultyIds, $departmentIds): void {
                $query
                    ->whereIn('faculty_id', $facultyIds)
                    ->orWhereIn('department_id', $departmentIds);
            })
            ->orderBy('name')
            ->get();

        $staffRows = $staff
            ->map(function (User $user): array {
                $roleSlug = $user->resolvedRoleSlug();

                return [
                    'id' => $user->id,
                    'name' => $user->display_name ?: $user->name,
                    'email' => $user->email,
                    'role_slug' => $roleSlug,
                    'role_label' => $this->roleLabel($roleSlug),
                    'faculty_id' => $user->faculty_id,
                    'department_id' => $user->department_id,
                    'position' => $user->position_title ?: $user->ad_title,
                ];
            })
            ->values();

        $staffByFaculty = $staffRows->groupBy('faculty_id');
        $staffByDepartment = $staffRows->groupBy('department_id');

        $facultyRows = $faculties
            ->map(function (Faculty $faculty) use ($staffByFaculty, $staffByDepartment): array {
                $facultyStaff = $staffByFaculty->get($faculty->id, collect());

                $deans = $facultyStaff
                    ->filter(fn (array $item): bool => $item['role_slug'] === 'dean')
                    ->values();

                $facultyLevelStaff = $facultyStaff
                    ->filter(fn (array $item): bool => empty($item['department_id']))
                    ->values();

                $departments = $faculty->departments
                    ->map(function (Department $department) use ($staffByDepartment): array {
                        $departmentStaff = $staffByDepartment->get($department->id, collect());

                        return [
                            'id' => $department->id,
                            'name' => $department->name,
                            'code' => $department->code,
                            'description' => $department->description,
                            'heads' => $departmentStaff
                                ->filter(fn (array $item): bool => $item['role_slug'] === 'hod')
                                ->values(),
                            'staff' => $departmentStaff->values(),
                            'staff_count' => $departmentStaff->count(),
                        ];
                    })
                    ->values();

                return [
                    'id' => $faculty->id,
                    'name' => $faculty->name,
                    'code' => $faculty->code,
                    'description' => $faculty->description,
                    'deans' => $deans,
                    'faculty_staff' => $facultyLevelStaff,
                    'departments' => $departments,
                    'department_count' => $departments->count(),
                    'staff_count' => $facultyStaff->count(),
                ];
            })
            ->values();

        $assignableStaff = User::query()
            ->with('roleRef:id,slug,name')
            ->select([
                'id',
                'name',
                'display_name',
                'email',
                'role',
                'role_id',
                'faculty_id',
                'department_id',
            ])
            ->where(function ($query): void {
                $query
                    ->whereNull('role')
                    ->orWhereNotIn('role', ['student']);
            })
            ->orderBy('name')
            ->get()
            ->map(function (User $user): array {
                $roleSlug = $user->resolvedRoleSlug();

                return [
                    'id' => $user->id,
                    'name' => $user->display_name ?: $user->name,
                    'email' => $user->email,
                    'role_slug' => $roleSlug,
                    'role_label' => $this->roleLabel($roleSlug),
                    'faculty_id' => $user->faculty_id,
                    'department_id' => $user->department_id,
                ];
            })
            ->values();

        return Inertia::render('Faculties/Index', [
            'faculties' => $facultyRows,
            'facultyOptions' => $faculties
                ->map(fn (Faculty $faculty): array => [
                    'id' => $faculty->id,
                    'name' => $faculty->name,
                ])
                ->values(),
            'departmentOptions' => $faculties
                ->flatMap(fn (Faculty $faculty) => $faculty->departments->map(fn (Department $department): array => [
                    'id' => $department->id,
                    'name' => $department->name,
                    'faculty_id' => $faculty->id,
                ]))
                ->values(),
            'staffOptions' => $assignableStaff,
            'roleOptions' => Role::query()
                ->whereIn('slug', ['teacher', 'hod', 'dean', 'structural', 'admin', 'superadmin'])
                ->orderBy('name')
                ->get(['id', 'slug', 'name'])
                ->map(fn (Role $role): array => [
                    'id' => $role->id,
                    'slug' => $role->slug,
                    'label' => $this->roleLabel((string) $role->slug),
                ])
                ->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:faculties,name'],
            'code' => ['nullable', 'string', 'max:50', 'unique:faculties,code'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        Faculty::create($data);

        return redirect()
            ->route('faculties.index')
            ->with('success', 'Факультет успешно создан.');
    }

    public function update(Request $request, Faculty $faculty): RedirectResponse
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('faculties', 'name')->ignore($faculty->id),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('faculties', 'code')->ignore($faculty->id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $faculty->update($data);

        return redirect()
            ->route('faculties.index')
            ->with('success', 'Факультет успешно обновлен.');
    }

    public function destroy(Faculty $faculty): RedirectResponse
    {
        if ($faculty->departments()->exists()) {
            return redirect()
                ->route('faculties.index')
                ->with('error', 'Нельзя удалить факультет, пока к нему привязаны кафедры.');
        }

        $faculty->delete();

        return redirect()
            ->route('faculties.index')
            ->with('success', 'Факультет удален.');
    }

    private function roleLabel(string $slug): string
    {
        return match ($slug) {
            'teacher' => 'Преподаватель',
            'hod', 'department_head' => 'Заведующий кафедрой',
            'dean' => 'Декан',
            'structural', 'department' => 'Структурное подразделение',
            'admin', 'superadmin' => 'Администратор',
            'student' => 'Студент',
            default => $slug,
        };
    }
}

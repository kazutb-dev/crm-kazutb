<?php

namespace App\Http\Controllers;

use App\Models\Department;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentController extends Controller
{
    public function index(): Response
    {
        $departments = Department::query()
            ->orderBy('name')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('Departments/Index', [
            'departments' => $departments,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Departments/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:departments,name'],
            'code' => ['nullable', 'string', 'max:50', 'unique:departments,code'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        Department::create($data);

        return redirect()
            ->route('departments.index')
            ->with('success', 'Кафедра успешно создана.');
    }

    public function edit(Department $department): Response
    {
        return Inertia::render('Departments/Edit', [
            'department' => $department,
        ]);
    }

    public function update(Request $request, Department $department): RedirectResponse
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('departments', 'name')->ignore($department->id),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('departments', 'code')->ignore($department->id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $department->update($data);

        return redirect()
            ->route('departments.index')
            ->with('success', 'Кафедра успешно обновлена.');
    }

    public function destroy(Department $department): RedirectResponse
    {
        $department->delete();

        return redirect()
            ->route('departments.index')
            ->with('success', 'Кафедра удалена.');
    }
}

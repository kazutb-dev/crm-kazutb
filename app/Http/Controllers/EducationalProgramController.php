<?php

namespace App\Http\Controllers;

use App\Models\AcademicYear;
use App\Models\Department;
use App\Models\EducationalProgram;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EducationalProgramController extends Controller
{
    public function index(): Response
    {
        $programs = EducationalProgram::query()
            ->with(['department:id,name', 'academicYear:id,name'])
            ->orderByDesc('id')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('EducationalPrograms/Index', [
            'programs' => $programs,
            'departments' => Department::query()
                ->orderBy('name')
                ->get(['id', 'name']),
            'academicYears' => AcademicYear::query()
                ->orderByDesc('start_year')
                ->get(['id', 'name']),
            'degreeOptions' => [
                ['value' => 'bachelor', 'label' => 'Бакалавриат'],
                ['value' => 'master', 'label' => 'Магистратура'],
                ['value' => 'phd', 'label' => 'Докторантура'],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:educational_programs,code'],
            'degree' => ['required', Rule::in(['bachelor', 'master', 'phd'])],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
        ]);

        EducationalProgram::create($data);

        return redirect()->route('educational-programs.index')
            ->with('success', 'Образовательная программа добавлена.');
    }

    public function update(Request $request, EducationalProgram $educationalProgram): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('educational_programs', 'code')->ignore($educationalProgram->id),
            ],
            'degree' => ['required', Rule::in(['bachelor', 'master', 'phd'])],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
        ]);

        $educationalProgram->update($data);

        return redirect()->route('educational-programs.index')
            ->with('success', 'Образовательная программа обновлена.');
    }

    public function destroy(EducationalProgram $educationalProgram): RedirectResponse
    {
        $educationalProgram->delete();

        return redirect()->route('educational-programs.index')
            ->with('success', 'Образовательная программа удалена.');
    }
}

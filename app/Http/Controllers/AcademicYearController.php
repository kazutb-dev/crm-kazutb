<?php

namespace App\Http\Controllers;

use App\Models\AcademicYear;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AcademicYearController extends Controller
{
    public function index(): Response
    {
        $academicYears = AcademicYear::query()
            ->orderByDesc('start_year')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('AcademicYears/Index', [
            'academicYears' => $academicYears,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'start_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'end_year' => ['required', 'integer', 'min:2000', 'max:2101', 'gte:start_year'],
            'is_active' => ['boolean'],
        ]);

        $name = sprintf('%d/%d', $data['start_year'], $data['end_year']);

        if ($data['is_active'] ?? false) {
            AcademicYear::query()->update(['is_active' => false]);
        }

        AcademicYear::create([
            'name' => $name,
            'start_year' => $data['start_year'],
            'end_year' => $data['end_year'],
            'is_active' => (bool) ($data['is_active'] ?? false),
        ]);

        return redirect()->route('academic-years.index')
            ->with('success', 'Учебный год добавлен.');
    }

    public function destroy(AcademicYear $academicYear): RedirectResponse
    {
        $academicYear->delete();

        return redirect()->route('academic-years.index')
            ->with('success', 'Учебный год удален.');
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Faculty;
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
            ->orderBy('name')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('Faculties/Index', [
            'faculties' => $faculties,
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
}

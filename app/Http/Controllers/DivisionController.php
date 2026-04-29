<?php

namespace App\Http\Controllers;

use App\Models\Division;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DivisionController extends Controller
{
    public function index(): Response
    {
        $divisions = Division::query()
            ->orderBy('name')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('Divisions/Index', [
            'divisions' => $divisions,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('divisions', 'name'),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('divisions', 'code'),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        Division::create($data);

        return redirect()
            ->route('divisions.index')
            ->with('success', 'Департамент успешно создан.');
    }

    public function update(Request $request, Division $division): RedirectResponse
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('divisions', 'name')->ignore($division->id),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('divisions', 'code')->ignore($division->id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $division->update($data);

        return redirect()
            ->route('divisions.index')
            ->with('success', 'Департамент успешно обновлен.');
    }

    public function destroy(Division $division): RedirectResponse
    {
        $division->delete();

        return redirect()
            ->route('divisions.index')
            ->with('success', 'Департамент удален.');
    }
}

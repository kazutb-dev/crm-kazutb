<?php

namespace App\Http\Controllers;

use App\Models\Position;
use App\Models\Division;
use App\Services\UniversityAuthorityCatalogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PositionController extends Controller
{
    public function index(): Response
    {
        $positions = Position::query()
            ->with('division:id,name')
            ->orderBy('name')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('Positions/Index', [
            'positions' => $positions,
            'catalog' => app(UniversityAuthorityCatalogService::class)->auditReport(),
            'divisions' => Division::query()
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'division_id' => ['required', 'integer', 'exists:divisions,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('positions', 'name')->where(
                    fn ($query) => $query->where('division_id', $request->integer('division_id'))
                ),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('positions', 'code')->where(
                    fn ($query) => $query->where('division_id', $request->integer('division_id'))
                ),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        Position::create($data);

        return redirect()
            ->route('positions.index')
            ->with('success', 'Должность успешно создана.');
    }

    public function update(Request $request, Position $position): RedirectResponse
    {
        $data = $request->validate([
            'division_id' => ['required', 'integer', 'exists:divisions,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('positions', 'name')
                    ->where(fn ($query) => $query->where('division_id', $request->integer('division_id')))
                    ->ignore($position->id),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('positions', 'code')
                    ->where(fn ($query) => $query->where('division_id', $request->integer('division_id')))
                    ->ignore($position->id),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $position->update($data);

        return redirect()
            ->route('positions.index')
            ->with('success', 'Должность успешно обновлена.');
    }

    public function destroy(Position $position): RedirectResponse
    {
        $position->delete();

        return redirect()
            ->route('positions.index')
            ->with('success', 'Должность удалена.');
    }
}

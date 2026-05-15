<?php

namespace App\Http\Controllers;

use App\Models\KpiStructuralUnit;
use Illuminate\Http\Request;
use Inertia\Inertia;

class KpiDivisionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $divisions = KpiStructuralUnit::withCount([
            'indicators as indicators_count' => fn($q) => $q->whereNotNull('checker_structural_unit_id'),
            'users as users_count'
        ])->get();

        return Inertia::render('Kpi/Divisions', [
            'divisions' => $divisions
        ]);
    }

    public function tables()
    {
        $divisions = KpiStructuralUnit::query()
            ->with(['indicators' => fn ($query) => $query
                ->orderBy('entity_type')
                ->orderBy('section')
                ->orderBy('code')])
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return Inertia::render('Kpi/DivisionTables', [
            'divisions' => $divisions,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'nullable|string|max:50|unique:kpi_structural_units,code',
            'name' => 'required|string|max:255|unique:kpi_structural_units,name',
        ]);

        KpiStructuralUnit::create($validated);

        return redirect()->back()->with('message', 'Подразделение создано');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, KpiStructuralUnit $division)
    {
        $validated = $request->validate([
            'code' => 'nullable|string|max:50|unique:kpi_structural_units,code,' . $division->id,
            'name' => 'required|string|max:255|unique:kpi_structural_units,name,' . $division->id,
        ]);

        $division->update($validated);

        return redirect()->back()->with('message', 'Подразделение обновлено');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(KpiStructuralUnit $division)
    {
        $division->delete();

        return redirect()->back()->with('message', 'Подразделение удалено');
    }

    /**
     * Show employees for a division
     */
    public function showEmployees(KpiStructuralUnit $division)
    {
        $employees = $division->users()->get();
        $allUsers = \App\Models\User::orderBy('name')->get();

        return Inertia::render('Kpi/DivisionEmployees', [
            'division' => $division,
            'employees' => $employees,
            'allUsers' => $allUsers
        ]);
    }

    /**
     * Add employee to division
     */
    public function addEmployee(Request $request, KpiStructuralUnit $division)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        $division->users()->attach($validated['user_id']);

        return redirect()->back()->with('message', 'Сотрудник добавлен в подразделение');
    }

    /**
     * Remove employee from division
     */
    public function removeEmployee(KpiStructuralUnit $division, $userId)
    {
        $division->users()->detach($userId);

        return redirect()->back()->with('message', 'Сотрудник удален из подразделения');
    }
}

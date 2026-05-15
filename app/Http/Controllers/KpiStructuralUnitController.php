<?php

namespace App\Http\Controllers;

use App\Models\KpiStructuralUnit;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class KpiStructuralUnitController extends Controller
{
    public function index()
    {
        $units = KpiStructuralUnit::query()
            ->orderBy('code')
            ->withCount('indicators')
            ->withCount('boundIndicators')
            ->withCount('users')
            ->with([
                'indicators:id,checker_structural_unit_id',
                'boundIndicators:id',
            ])
            ->get()
            ->map(function (KpiStructuralUnit $unit): array {
                $recordsCount = $unit->boundIndicators
                    ->concat($unit->indicators)
                    ->unique('id')
                    ->count();

                return [
                    'id' => $unit->id,
                    'code' => $unit->code,
                    'name' => $unit->name,
                    'description' => $unit->description,
                    'legacy_indicators_count' => (int) $unit->indicators_count,
                    'bound_indicators_count' => (int) $unit->bound_indicators_count,
                    'records_count' => $recordsCount,
                    'users_count' => (int) $unit->users_count,
                ];
            })
            ->values();

        return Inertia::render('Kpi/StructuralUnitsManager', [
            'units' => $units,
        ]);
    }

    public function show(KpiStructuralUnit $unit)
    {
        $unit->load([
            'users:id,name,display_name,email,role,role_id',
            'users.roleRef:id,slug,name',
            'indicators:id,code,name,entity_type,checker_structural_unit_id',
            'boundIndicators:id,code,name,entity_type',
        ]);

        $records = $unit->boundIndicators
            ->concat($unit->indicators)
            ->unique('id')
            ->sortBy(fn ($indicator): string => (string) ($indicator->code ?? ''))
            ->values();

        $alreadyAttachedIds = $unit->users->pluck('id')->all();

        $staffOptions = User::query()
            ->with('roleRef:id,slug,name')
            ->select([
                'id',
                'name',
                'display_name',
                'email',
                'role',
                'role_id',
            ])
            ->where(function ($query): void {
                $query->whereNull('is_hidden')->orWhere('is_hidden', 0);
            })
            ->orderBy('name')
            ->get()
            ->filter(function (User $user): bool {
                return $user->resolvedRoleSlug() !== 'student';
            })
            ->reject(fn (User $user): bool => in_array($user->id, $alreadyAttachedIds, true))
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->display_name ?: $user->name,
                'email' => $user->email,
                'role_label' => $user->resolveRoleLabel(),
            ])
            ->values()
            ->all();

        return Inertia::render('Kpi/StructuralUnitShow', [
            'unit' => [
                'id' => $unit->id,
                'code' => $unit->code,
                'name' => $unit->name,
                'description' => $unit->description,
                'users' => $unit->users
                    ->map(fn ($user): array => [
                        'id' => $user->id,
                        'name' => $user->display_name ?: $user->name,
                        'email' => $user->email,
                        'role_label' => $user->resolveRoleLabel(),
                    ])
                    ->sortBy('name')
                    ->values()
                    ->all(),
                'records' => $records
                    ->map(fn ($indicator): array => [
                        'id' => $indicator->id,
                        'code' => $indicator->code,
                        'name' => $indicator->name,
                        'entity_type' => $indicator->entity_type,
                    ])
                    ->values()
                    ->all(),
            ],
            'staffOptions' => $staffOptions,
        ]);
    }

    public function attachUser(Request $request, KpiStructuralUnit $unit): RedirectResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $unit->users()->syncWithoutDetaching([(int) $validated['user_id']]);

        return back()->with('success', 'Сотрудник добавлен в структурное подразделение.');
    }

    public function detachUser(KpiStructuralUnit $unit, User $user): RedirectResponse
    {
        $unit->users()->detach($user->id);

        return back()->with('success', 'Сотрудник удален из структурного подразделения.');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:50|unique:kpi_structural_units',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $unit = KpiStructuralUnit::create($validated);

        return response()->json([
            'success' => true,
            'unit' => $unit,
            'message' => 'Структурное подразделение добавлено',
        ]);
    }

    public function update(Request $request, KpiStructuralUnit $unit)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $unit->update($validated);

        return response()->json([
            'success' => true,
            'unit' => $unit,
            'message' => 'Структурное подразделение обновлено',
        ]);
    }

    public function destroy(KpiStructuralUnit $unit)
    {
        if ($unit->indicators()->count() > 0 || $unit->boundIndicators()->count() > 0 || $unit->users()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Невозможно удалить структурное подразделение, которое имеет привязанные индикаторы или пользователей',
            ], 422);
        }

        $unit->delete();

        return response()->json([
            'success' => true,
            'message' => 'Структурное подразделение удалено',
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\KpiIndicator;
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
            ->map(fn (KpiIndicator $indicator): array => [
                'id' => $indicator->id,
                'code' => $indicator->code,
                'name' => $indicator->name,
                'entity_type' => $indicator->entity_type,
                'source' => 'bound',
            ])
            ->concat($unit->indicators->map(fn (KpiIndicator $indicator): array => [
                'id' => $indicator->id,
                'code' => $indicator->code,
                'name' => $indicator->name,
                'entity_type' => $indicator->entity_type,
                'source' => 'direct',
            ]))
            ->unique('id')
            ->sortBy(fn (array $indicator): string => (string) ($indicator['code'] ?? ''))
            ->values();

        $availableRecords = KpiIndicator::query()
            ->with(['checkerStructuralUnit:id,code,name'])
            ->whereNull('checker_structural_unit_id')
            ->whereDoesntHave('structuralUnits')
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'entity_type', 'checker_structural_unit_id'])
            ->map(fn (KpiIndicator $indicator): array => [
                'id' => $indicator->id,
                'code' => $indicator->code,
                'name' => $indicator->name,
                'entity_type' => $indicator->entity_type,
                'source' => 'available',
            ])
            ->values()
            ->all();

        $alreadyAttachedIds = $unit->users->pluck('id')->map(fn ($id) => (int) $id)->all();

        $staffOptions = User::query()
            ->with([
                'roleRef:id,slug,name',
                'kpiStructuralUnits:id,code,name',
            ])
            ->select([
                'id',
                'name',
                'display_name',
                'email',
                'role',
                'role_id',
            ])
            ->orderBy('name')
            ->get()
            ->filter(function (User $user): bool {
                return $user->resolvedRoleSlug() !== 'student';
            })
            ->reject(fn (User $user): bool => in_array($user->id, $alreadyAttachedIds, true))
            ->map(function (User $user) use ($unit): array {
                $otherStructuralUnits = $user->kpiStructuralUnits
                    ->reject(fn (KpiStructuralUnit $attachedUnit): bool => (int) $attachedUnit->id === (int) $unit->id)
                    ->map(fn (KpiStructuralUnit $attachedUnit): array => [
                        'id' => $attachedUnit->id,
                        'code' => $attachedUnit->code,
                        'name' => $attachedUnit->name,
                    ])
                    ->sortBy(['code', 'name'])
                    ->values()
                    ->all();

                return [
                    'id' => $user->id,
                    'name' => $user->display_name ?: $user->name,
                    'email' => $user->email,
                    'role_label' => $user->resolveRoleLabel(),
                    'structural_units' => $otherStructuralUnits,
                ];
            })
            ->sortBy('name')
            ->values()
            ->all();

        $unassignedStaffOptions = collect($staffOptions)
            ->filter(function (array $user) use ($alreadyAttachedIds): bool {
                $isAlreadyAttached = in_array((int) $user['id'], $alreadyAttachedIds, true);
                $hasNoAttachedUnits = empty($user['structural_units'] ?? []);

                return ! $isAlreadyAttached && $hasNoAttachedUnits;
            })
            ->values()
            ->all();

        $assignedElsewhereStaffOptions = collect($staffOptions)
            ->filter(fn (array $user): bool => ! empty($user['structural_units'] ?? []))
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
                'records' => $records->values()->all(),
            ],
            'staffOptions' => $staffOptions,
            'unassignedStaffOptions' => $unassignedStaffOptions,
            'assignedElsewhereStaffOptions' => $assignedElsewhereStaffOptions,
            'availableRecords' => $availableRecords,
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

    public function detachRecord(KpiStructuralUnit $unit, KpiIndicator $indicator): RedirectResponse
    {
        if ((int) $indicator->checker_structural_unit_id === (int) $unit->id) {
            $indicator->update(['checker_structural_unit_id' => null]);

            return back()->with('success', 'Запись отвязана от структурного подразделения.');
        }

        $unit->boundIndicators()->detach($indicator->id);

        return back()->with('success', 'Запись отвязана от структурного подразделения.');
    }

    public function attachRecord(Request $request, KpiStructuralUnit $unit): RedirectResponse
    {
        $validated = $request->validate([
            'indicator_id' => ['required', 'integer', 'exists:kpi_indicators,id'],
        ]);

        $indicator = KpiIndicator::query()->findOrFail((int) $validated['indicator_id']);

        if ($indicator->checker_structural_unit_id !== null || $indicator->structuralUnits()->exists()) {
            return back()->with('warning', 'Запись уже привязана к структурному подразделению.');
        }

        $indicator->update(['checker_structural_unit_id' => $unit->id]);

        return back()->with('success', 'Запись привязана к структурному подразделению.');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:50|unique:kpi_structural_units',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $unit = KpiStructuralUnit::create($validated);

        if ($request->header('X-Inertia')) {
            return redirect()
                ->route('kpi.structural-units.index')
                ->with('success', 'Структурное подразделение добавлено');
        }

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

        if ($request->header('X-Inertia')) {
            return redirect()
                ->route('kpi.structural-units.index')
                ->with('success', 'Структурное подразделение обновлено');
        }

        return response()->json([
            'success' => true,
            'unit' => $unit,
            'message' => 'Структурное подразделение обновлено',
        ]);
    }

    public function destroy(KpiStructuralUnit $unit)
    {
        if ($unit->indicators()->count() > 0 || $unit->boundIndicators()->count() > 0 || $unit->users()->count() > 0) {
            if (request()->header('X-Inertia')) {
                return back()->with('error', 'Невозможно удалить структурное подразделение, которое имеет привязанные индикаторы или пользователей');
            }

            return response()->json([
                'success' => false,
                'message' => 'Невозможно удалить структурное подразделение, которое имеет привязанные индикаторы или пользователей',
            ], 422);
        }

        $unit->delete();

        if (request()->header('X-Inertia')) {
            return redirect()
                ->route('kpi.structural-units.index')
                ->with('success', 'Структурное подразделение удалено');
        }

        return response()->json([
            'success' => true,
            'message' => 'Структурное подразделение удалено',
        ]);
    }
}

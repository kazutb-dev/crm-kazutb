<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrEmployee;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Models\User;
use App\Services\Hr\HrNumberSuggester;
use App\Services\Hr\RussianInflector;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Search endpoints of the wizard comboboxes, the RU genitive suggestion and the next-number hint.
 */
class HiringLookupController extends Controller
{
    /** Org units that are not a place of work: the university itself, governing bodies, vice-rector branches. */
    private const NOT_HIRING_UNITS = [OrgUnit::TYPE_UNIVERSITY, OrgUnit::TYPE_GOVERNANCE, OrgUnit::TYPE_RECTORATE];

    private const LIMIT = 30;

    /**
     * Top level: any unit where people work. Lower level: units inside the chosen top-level unit.
     */
    public function units(Request $request): JsonResponse
    {
        $data = $request->validate([
            'parent' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $query = OrgUnit::query()->where('is_active', true)->whereNotIn('unit_type', self::NOT_HIRING_UNITS);

        if (! empty($data['parent'])) {
            $query->whereIn('id', $this->descendantIds((int) $data['parent']));
        }
        if (! empty($data['q'])) {
            $query->where('name', 'like', '%'.$this->escapeLike($data['q']).'%');
        }

        return response()->json(['items' => $query->orderBy('name')->limit(self::LIMIT)->get()->map(fn (OrgUnit $unit) => [
            'id' => $unit->id,
            'name_ru' => $unit->name,
            'name_ru_gen' => $unit->name_ru_gen,
            'name_kz_gen' => $unit->name_kz_gen,
            'type_label' => $unit->unitTypeLabel(),
            'verified' => $unit->case_forms_verified_at !== null,
        ])->values()]);
    }

    public function positions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => ['nullable', Rule::in(array_keys(Position::CATEGORY_LABELS))],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $query = Position::query();
        if (! empty($data['category'])) {
            $query->where(fn (Builder $q) => $q->where('staff_category', $data['category'])->orWhereNull('staff_category'));
        }
        if (! empty($data['q'])) {
            $query->where('name', 'like', '%'.$this->escapeLike($data['q']).'%');
        }

        return response()->json(['items' => $query->orderBy('name')->limit(self::LIMIT)->get()->map(fn (Position $position) => [
            'id' => $position->id,
            'name_ru' => $position->name,
            'name_ru_gen' => $position->name_ru_gen,
            'name_kz_poss' => $position->name_kz_poss,
            'staff_category' => $position->staff_category,
            'verified' => $position->case_forms_verified_at !== null,
        ])->values()]);
    }

    /**
     * The person replaced: any employee — system accounts and employees hired through the module.
     */
    public function staff(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);
        $like = '%'.$this->escapeLike($data['q']).'%';

        $users = User::query()
            ->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('display_name', 'like', $like))
            ->orderBy('name')->limit(15)
            ->get(['id', 'name', 'position_title'])
            ->map(fn (User $user) => [
                'kind' => 'user',
                'id' => $user->id,
                'full_name' => (string) $user->name,
                'note' => (string) ($user->position_title ?? ''),
            ]);

        $employees = HrEmployee::query()
            ->where(fn (Builder $q) => $q->where('last_name', 'like', $like)->orWhere('first_name', 'like', $like)->orWhere('middle_name', 'like', $like))
            ->orderBy('last_name')->limit(15)
            ->get(['id', 'last_name', 'first_name', 'middle_name'])
            ->filter(fn (HrEmployee $employee) => $employee->fullName() !== '')
            ->map(fn (HrEmployee $employee) => [
                'kind' => 'employee',
                'id' => $employee->id,
                'full_name' => $employee->fullName(),
                'note' => 'Принят через модуль',
            ]);

        return response()->json(['items' => $users->concat($employees)->values()]);
    }

    /** RU genitive suggestion for a typed-in unit or position (the user can correct it). */
    public function inflect(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['unit', 'position'])],
            'name' => ['required', 'string', 'max:255'],
        ]);

        return response()->json(['name_ru_gen' => $data['kind'] === 'position'
            ? RussianInflector::positionGenitive($data['name'])
            : RussianInflector::genitive($data['name'])]);
    }

    public function numbers(Request $request, HrNumberSuggester $numbers): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in([HrNumberSuggester::CONTRACT, HrNumberSuggester::ORDER])],
            'date' => ['nullable', 'date'],
            'value' => ['nullable', 'string', 'max:30'],
            'hiring' => ['nullable', 'integer'],
        ]);

        $year = ! empty($data['date']) ? CarbonImmutable::parse($data['date'])->year : CarbonImmutable::today()->year;
        $duplicate = ! empty($data['value']) ? $numbers->duplicateOf($data['kind'], $data['value'], $year, $data['hiring'] ?? null) : null;

        return response()->json([
            'next' => $numbers->next($data['kind'], $year, $data['hiring'] ?? null),
            'external_last' => $data['kind'] === HrNumberSuggester::ORDER ? $numbers->externalOrderNumber($year) : null,
            'year' => $year,
            'duplicate_hiring_id' => $duplicate,
        ]);
    }

    /**
     * @return list<int>
     */
    private function descendantIds(int $parentId): array
    {
        $ids = [];
        $level = [$parentId];
        for ($depth = 0; $depth < 10 && $level !== []; $depth++) {
            $level = OrgUnit::query()->whereIn('parent_id', $level)->pluck('id')->all();
            $ids = array_merge($ids, $level);
        }

        return $ids;
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], trim($value));
    }
}

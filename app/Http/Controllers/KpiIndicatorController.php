<?php

namespace App\Http\Controllers;

use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\Division;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class KpiIndicatorController extends Controller
{
    public function index(Request $request): Response
    {
        $this->abortUnlessCanView($request);

        $entityType = trim((string) $request->query('entity_type', ''));
        $isActive = trim((string) $request->query('is_active', ''));

        $query = KpiIndicator::query();

        if ($entityType !== '') {
            $query->where('entity_type', $entityType);
        }

        if ($isActive === '1' || $isActive === '0') {
            $query->where('is_active', $isActive === '1');
        }

        $indicators = $query
            ->ordered()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Kpi/Indicators', [
            'indicators' => $indicators,
            'filters' => [
                'entity_type' => $entityType !== '' ? $entityType : null,
                'is_active' => $isActive !== '' ? $isActive : null,
            ],
            'options' => [
                'entityTypes' => [
                    KpiIndicator::ENTITY_TYPE_TEACHER,
                    KpiIndicator::ENTITY_TYPE_DEPARTMENT_HEAD,
                    KpiIndicator::ENTITY_TYPE_DEAN,
                ],
                'sections' => [
                    KpiIndicator::SECTION_TEACHING,
                    KpiIndicator::SECTION_SCIENCE,
                    KpiIndicator::SECTION_SOCIAL,
                    KpiIndicator::SECTION_QUALIFICATION,
                    KpiIndicator::SECTION_SURVEY,
                ],
                'calculationTypes' => [
                    KpiIndicator::CALCULATION_TYPE_MANUAL,
                    KpiIndicator::CALCULATION_TYPE_AUTO,
                    KpiIndicator::CALCULATION_TYPE_FORMULA,
                ],
                // Передаем департаменты для селекта
                'divisions' => Division::query()->orderBy('name')->get(['id', 'name']),
            ],
            'permissions' => [
                'canManage' => $this->canManage($request),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->abortUnlessCanManage($request);

        $data = $request->validate($this->rules($request));

        KpiIndicator::query()->create($data);

        return redirect()->route('kpi.indicators.index')
            ->with('success', 'KPI-индикатор успешно создан.');
    }

    public function update(Request $request, KpiIndicator $indicator): RedirectResponse
    {
        $this->abortUnlessCanManage($request);

        $data = $request->validate($this->rules($request, $indicator));

        $indicator->update($data);

        return redirect()->route('kpi.indicators.index')
            ->with('success', 'KPI-индикатор успешно обновлен.');
    }

    public function destroy(Request $request, KpiIndicator $indicator): RedirectResponse
    {
        $this->abortUnlessCanManage($request);

        if (KpiEntry::withTrashed()->where('indicator_id', $indicator->id)->exists()) {
            return redirect()->route('kpi.indicators.index')
                ->with('error', 'Нельзя удалить индикатор, так как по нему уже есть KPI-записи.');
        }

        $indicator->delete();

        return redirect()->route('kpi.indicators.index')
            ->with('success', 'KPI-индикатор удален.');
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(Request $request, ?KpiIndicator $indicator = null): array
    {
        return [
            'entity_type' => ['required', 'string', Rule::in([
                KpiIndicator::ENTITY_TYPE_TEACHER,
                KpiIndicator::ENTITY_TYPE_DEPARTMENT_HEAD,
                KpiIndicator::ENTITY_TYPE_DEAN,
            ])],
            'section' => ['required', 'string', Rule::in([
                KpiIndicator::SECTION_TEACHING,
                KpiIndicator::SECTION_SCIENCE,
                KpiIndicator::SECTION_SOCIAL,
                KpiIndicator::SECTION_QUALIFICATION,
                KpiIndicator::SECTION_SURVEY,
            ])],
            'code' => [
                'required',
                'string',
                'max:100',
            ],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'unit' => ['nullable', 'string', 'max:50'],
            'base_points' => ['required', 'numeric', 'min:0'],
            'calculation_type' => ['required', 'string', Rule::in([
                KpiIndicator::CALCULATION_TYPE_MANUAL,
                KpiIndicator::CALCULATION_TYPE_AUTO,
                KpiIndicator::CALCULATION_TYPE_FORMULA,
            ])],
            'requires_file' => ['required', 'boolean'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0'],
            'checker_division_id' => ['nullable', 'integer', 'exists:divisions,id'],
        ];
    }

    private function abortUnlessCanView(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        if (!in_array($role, ['admin', 'superadmin'], true)) {
            abort(403);
        }
    }

    private function abortUnlessCanManage(Request $request): void
    {
        if (!$this->canManage($request)) {
            abort(403);
        }
    }

    private function canManage(Request $request): bool
    {
        return $request->user()?->resolvedRoleSlug() === 'admin';
    }
}
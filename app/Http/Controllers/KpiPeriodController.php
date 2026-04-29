<?php

namespace App\Http\Controllers;

use App\Exceptions\Kpi\KpiPeriodException;
use App\Http\Requests\Kpi\StoreKpiPeriodRequest;
use App\Http\Requests\Kpi\UpdateKpiPeriodRequest;
use App\Models\AcademicYear;
use App\Models\KpiPeriod;
use App\Services\KpiPeriodService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class KpiPeriodController extends Controller
{
    public function __construct(private readonly KpiPeriodService $service)
    {
    }

    public function index(Request $request): Response|JsonResponse
    {
        $this->authorize('viewAny', KpiPeriod::class);

        $query = KpiPeriod::query()->with(['academicYear:id,name,start_year,end_year', 'creator:id,name', 'updater:id,name']);

        // Example filter set: ?academic_year_id=1&stage=plan&status=active
        $academicYearId = $request->integer('academic_year_id');
        if ($academicYearId > 0) {
            $query->where('academic_year_id', $academicYearId);
        }

        $stage = trim((string) $request->query('stage', ''));
        if ($stage !== '') {
            $query->where('stage', $stage);
        }

        $status = trim((string) $request->query('status', ''));
        if ($status !== '') {
            $query->where('status', $status);
        }

        $periods = $query
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        $academicYears = AcademicYear::query()
            ->orderByDesc('start_year')
            ->get(['id', 'name', 'start_year', 'end_year']);

        $canManage = $request->user()?->can('create', KpiPeriod::class) ?? false;

        $payload = [
            'periods' => $periods,
            'academicYears' => $academicYears,
            'filters' => [
                'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
                'stage' => $stage !== '' ? $stage : null,
                'status' => $status !== '' ? $status : null,
            ],
            'stageOptions' => [
                KpiPeriod::STAGE_PLAN,
                KpiPeriod::STAGE_FACT,
                KpiPeriod::STAGE_REVIEW,
            ],
            'statusOptions' => [
                KpiPeriod::STATUS_DRAFT,
                KpiPeriod::STATUS_ACTIVE,
                KpiPeriod::STATUS_CLOSED,
            ],
            'permissions' => [
                'managePeriods' => $canManage,
            ],
        ];

        if ($request->expectsJson()) {
            return response()->json([
                'data' => $payload,
            ]);
        }

        return Inertia::render('Kpi/Index', $payload);
    }

    public function store(StoreKpiPeriodRequest $request): RedirectResponse|JsonResponse
    {
        $this->authorize('create', KpiPeriod::class);

        try {
            $period = $this->service->create([
                ...$request->validated(),
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-период успешно создан.',
                    'data' => $period,
                ], 201);
            }

            return redirect()->route('kpi.index')->with('success', 'KPI-период успешно создан.');
        } catch (KpiPeriodException $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage(),
                ], 422);
            }

            return back()->withErrors(['kpi_period' => $e->getMessage()])->withInput();
        }
    }

    public function show(Request $request, KpiPeriod $period): Response|JsonResponse
    {
        $this->authorize('view', $period);

        $period->load(['academicYear:id,name,start_year,end_year', 'creator:id,name', 'updater:id,name']);

        if ($request->expectsJson()) {
            return response()->json([
                'data' => [
                    'period' => $period,
                ],
            ]);
        }

        return Inertia::render('Kpi/Index', [
            'period' => $period,
        ]);
    }

    public function update(UpdateKpiPeriodRequest $request, KpiPeriod $period): RedirectResponse|JsonResponse
    {
        $this->authorize('update', $period);

        try {
            $updated = $this->service->update($period, [
                ...$request->validated(),
                'updated_by' => $request->user()?->id,
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-период успешно обновлен.',
                    'data' => $updated,
                ]);
            }

            return redirect()->route('kpi.index')->with('success', 'KPI-период успешно обновлен.');
        } catch (KpiPeriodException $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage(),
                ], 422);
            }

            return back()->withErrors(['kpi_period' => $e->getMessage()])->withInput();
        }
    }

    public function activate(Request $request, KpiPeriod $period): RedirectResponse|JsonResponse
    {
        $this->authorize('update', $period);

        try {
            $activated = $this->service->activate($period);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-период активирован.',
                    'data' => $activated,
                ]);
            }

            return redirect()->route('kpi.index')->with('success', 'KPI-период активирован.');
        } catch (KpiPeriodException $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage(),
                ], 422);
            }

            return back()->withErrors(['kpi_period' => $e->getMessage()]);
        }
    }

    public function close(Request $request, KpiPeriod $period): RedirectResponse|JsonResponse
    {
        $this->authorize('update', $period);

        try {
            $closed = $this->service->close($period);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'KPI-период закрыт.',
                    'data' => $closed,
                ]);
            }

            return redirect()->route('kpi.index')->with('success', 'KPI-период закрыт.');
        } catch (KpiPeriodException $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage(),
                ], 422);
            }

            return back()->withErrors(['kpi_period' => $e->getMessage()]);
        }
    }
}

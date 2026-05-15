<?php

namespace App\Http\Controllers;

use App\Models\KpiAccessGrant;
use App\Services\KpiAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class KpiAnalyticsController extends Controller
{
    public function __construct(private readonly KpiAnalyticsService $service)
    {
    }

    public function index(Request $request): Response|JsonResponse
    {
        $this->authorizeReadOnlySuperadmin($request);

        $filters = $this->resolveFilters($request);
        $payload = $this->service->buildDashboardPayload($filters);

        if ($request->expectsJson()) {
            return response()->json(['data' => $payload]);
        }

        return Inertia::render('Kpi/Analytics', $payload);
    }

    public function exportExcel(Request $request): RedirectResponse|JsonResponse
    {
        $this->authorizeReadOnlySuperadmin($request);

        $payload = $this->service->buildExportPayload('excel', $this->resolveFilters($request));

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Запрос на Excel-выгрузку принят. Реализацию генерации подключите через queue job.',
                'data' => $payload,
            ], 202);
        }

        return back()->with('success', 'Excel-выгрузка поставлена в очередь (архитектурная точка расширения).');
    }

    public function exportPdf(Request $request): RedirectResponse|JsonResponse
    {
        $this->authorizeReadOnlySuperadmin($request);

        $payload = $this->service->buildExportPayload('pdf', $this->resolveFilters($request));

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Запрос на PDF-выгрузку принят. Реализацию генерации подключите через queue job.',
                'data' => $payload,
            ], 202);
        }

        return back()->with('success', 'PDF-выгрузка поставлена в очередь (архитектурная точка расширения).');
    }

    /**
     * @return array{academic_year_id: int|null, period_id: int|null, entity_type: string|null}
     */
    private function resolveFilters(Request $request): array
    {
        $academicYearId = $request->integer('academic_year_id');
        $periodId = $request->integer('period_id');
        $entityType = trim((string) $request->query('entity_type', ''));

        return [
            'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
            'period_id' => $periodId > 0 ? $periodId : null,
            'entity_type' => $entityType !== '' ? $entityType : null,
        ];
    }

    private function authorizeReadOnlySuperadmin(Request $request): void
    {
        $roleSlug = $request->user()?->resolvedRoleSlug();
        $userId   = $request->user()?->id;

        // Суперадмин или пользователь с активным грантом аналитики
        if ($roleSlug === 'superadmin' || $roleSlug === 'admin') {
            return;
        }

        if ($userId !== null && KpiAccessGrant::userHas($userId, KpiAccessGrant::PERM_ANALYTICS)) {
            return;
        }

        abort(403, 'Нет доступа к аналитике KPI.');
    }
}
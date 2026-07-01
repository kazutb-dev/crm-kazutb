<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingStatisticsFiltersData;
use App\Modules\LanguageTestingModule\Models\LanguageTestingResult;
use App\Modules\LanguageTestingModule\Services\LanguageTestingExportService;
use App\Modules\LanguageTestingModule\Services\LanguageTestingService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class LanguageTestingStatisticsController extends Controller
{
    public function __construct(
        private readonly LanguageTestingService $languageTestingService,
        private readonly LanguageTestingExportService $languageTestingExportService,
    ) {
    }

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', LanguageTestingResult::class);

        $filters = LanguageTestingStatisticsFiltersData::fromRequest($request);
        $results = $this->languageTestingService->paginateStatistics($filters);

        return Inertia::render('LanguageTesting/Statistics/Index', [
            'results' => collect($results->items())->map(fn (LanguageTestingResult $result): array => $this->languageTestingService->serializeResult($result))->all(),
            'filters' => [
                'q' => $filters->q,
                'test_id' => $filters->testId,
                'language' => $filters->language,
                'status' => $filters->status,
                'from_date' => $filters->fromDate,
                'to_date' => $filters->toDate,
                'sort' => $filters->sort,
                'direction' => $filters->direction,
                'per_page' => $filters->perPage,
            ],
            'pagination' => [
                'current_page' => $results->currentPage(),
                'last_page' => $results->lastPage(),
                'per_page' => $results->perPage(),
                'total' => $results->total(),
            ],
            'options' => $this->languageTestingService->statisticsOptions(),
            'permissions' => [
                'canExport' => $request->user()?->can('export', LanguageTestingResult::class) ?? false,
            ],
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $this->authorize('export', LanguageTestingResult::class);

        $filters = LanguageTestingStatisticsFiltersData::fromRequest($request);
        $rows = $this->languageTestingExportService->rows($filters);
        $headings = $this->languageTestingExportService->headings();

        return response()->streamDownload(function () use ($headings, $rows): void {
            $handle = fopen('php://output', 'wb');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $headings, ';');

            foreach ($rows as $row) {
                fputcsv($handle, $row, ';');
            }

            fclose($handle);
        }, $this->languageTestingExportService->csvFilename(), [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function exportExcel(Request $request)
    {
        $this->authorize('export', LanguageTestingResult::class);

        $path = $this->languageTestingExportService->createExcelFile(LanguageTestingStatisticsFiltersData::fromRequest($request));

        return response()->download($path, basename($path))->deleteFileAfterSend(true);
    }
}
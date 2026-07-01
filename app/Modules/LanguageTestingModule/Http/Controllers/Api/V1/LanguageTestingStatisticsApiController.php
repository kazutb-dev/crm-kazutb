<?php

namespace App\Modules\LanguageTestingModule\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\LanguageTestingModule\DTO\LanguageTestingStatisticsFiltersData;
use App\Modules\LanguageTestingModule\Http\Controllers\Api\V1\Concerns\InteractsWithLanguageTestingApi;
use App\Modules\LanguageTestingModule\Models\LanguageTestingResult;
use App\Modules\LanguageTestingModule\Services\LanguageTestingExportService;
use App\Modules\LanguageTestingModule\Services\LanguageTestingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LanguageTestingStatisticsApiController extends Controller
{
    use InteractsWithLanguageTestingApi;

    public function __construct(
        private readonly LanguageTestingService $languageTestingService,
        private readonly LanguageTestingExportService $languageTestingExportService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureCrmConsumer($request);

        $filters = LanguageTestingStatisticsFiltersData::fromRequest($request);
        $results = $this->languageTestingService->paginateStatistics($filters);

        return $this->success([
            'data' => collect($results->items())->map(fn (LanguageTestingResult $result): array => $this->languageTestingService->serializeResult($result))->all(),
            'meta' => [
                'current_page' => $results->currentPage(),
                'last_page' => $results->lastPage(),
                'per_page' => $results->perPage(),
                'total' => $results->total(),
            ],
        ]);
    }

    public function show(Request $request, LanguageTestingResult $languageTestingResult): JsonResponse
    {
        $this->ensureCrmConsumer($request);

        return $this->success([
            'data' => $this->languageTestingService->serializeResult($languageTestingResult),
        ]);
    }

    public function exportExcel(Request $request)
    {
        $this->ensureCrmConsumer($request);

        $path = $this->languageTestingExportService->createExcelFile(LanguageTestingStatisticsFiltersData::fromRequest($request));

        return response()->download($path, basename($path))->deleteFileAfterSend(true);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $this->ensureCrmConsumer($request);

        $rows = $this->languageTestingExportService->rows(LanguageTestingStatisticsFiltersData::fromRequest($request));
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
}
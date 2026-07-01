<?php

namespace App\Modules\LanguageTestingModule\DTO;

use Illuminate\Http\Request;

class LanguageTestingStatisticsFiltersData
{
    public function __construct(
        public readonly string $q,
        public readonly ?int $testId,
        public readonly string $language,
        public readonly string $status,
        public readonly string $fromDate,
        public readonly string $toDate,
        public readonly string $sort,
        public readonly string $direction,
        public readonly int $perPage,
    ) {
    }

    public static function fromRequest(Request $request): self
    {
        $sort = (string) $request->query('sort', 'submitted_at');
        $direction = strtolower((string) $request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $testId = $request->query('test_id');

        return new self(
            q: trim((string) $request->query('q', '')),
            testId: is_numeric($testId) ? (int) $testId : null,
            language: trim((string) $request->query('language', '')),
            status: trim((string) $request->query('status', '')),
            fromDate: trim((string) $request->query('from_date', '')),
            toDate: trim((string) $request->query('to_date', '')),
            sort: $sort,
            direction: $direction,
            perPage: max(5, min(100, (int) $request->query('per_page', 15))),
        );
    }
}
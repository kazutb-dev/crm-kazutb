<?php

namespace App\Modules\LanguageTestingModule\DTO;

use Illuminate\Http\Request;

class LanguageTestingListFiltersData
{
    public function __construct(
        public readonly string $q,
        public readonly string $status,
        public readonly string $language,
        public readonly string $sort,
        public readonly string $direction,
        public readonly int $perPage,
    ) {
    }

    public static function fromRequest(Request $request): self
    {
        $sort = (string) $request->query('sort', 'name');
        $direction = strtolower((string) $request->query('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $perPage = max(5, min(100, (int) $request->query('per_page', 10)));

        return new self(
            q: trim((string) $request->query('q', '')),
            status: trim((string) $request->query('status', '')),
            language: trim((string) $request->query('language', '')),
            sort: $sort,
            direction: $direction,
            perPage: $perPage,
        );
    }
}
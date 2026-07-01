<?php

namespace App\Modules\LanguageTestingModule\DTO;

use Illuminate\Http\Request;

class LanguageTestingQuestionFiltersData
{
    public function __construct(
        public readonly string $q,
        public readonly string $sort,
        public readonly string $direction,
        public readonly int $perPage,
    ) {
    }

    public static function fromRequest(Request $request): self
    {
        $sort = (string) $request->query('sort', 'sort_order');
        $direction = strtolower((string) $request->query('direction', 'asc')) === 'desc' ? 'desc' : 'asc';

        return new self(
            q: trim((string) $request->query('q', '')),
            sort: $sort,
            direction: $direction,
            perPage: max(1, min(100, (int) $request->query('per_page', 10))),
        );
    }
}

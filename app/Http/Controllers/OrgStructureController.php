<?php

namespace App\Http\Controllers;

use App\Models\KpiAccessGrant;
use App\Models\OrgUnit;
use App\Services\ElevatedAuthorityService;
use App\Services\UniversityAuthorityCatalogService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class OrgStructureController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($this->canAccess($request), 403);

        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'unit_type' => trim((string) $request->query('unit_type', '')),
            'missing_leader' => trim((string) $request->query('missing_leader', '')),
            'transitional' => trim((string) $request->query('transitional', '')),
            'per_page' => (int) $request->integer('per_page', 25),
            'page' => max(1, (int) $request->integer('page', 1)),
        ];

        if (! in_array($filters['per_page'], [25, 50, 100], true)) {
            $filters['per_page'] = 25;
        }

        if (! Schema::hasTable('org_units')) {
            return Inertia::render('Governance/OrgStructure', [
                'catalog' => app(UniversityAuthorityCatalogService::class)->auditReport(),
                'summary' => [
                    'total_units' => 0,
                    'root_units' => 0,
                    'without_leader' => 0,
                    'transitional_mappings' => 0,
                    'type_breakdown' => [],
                ],
                'tree' => [],
                'units' => [],
                'pagination' => [
                    'total' => 0,
                    'per_page' => $filters['per_page'],
                    'current_page' => 1,
                    'last_page' => 1,
                    'from' => null,
                    'to' => null,
                ],
                'filters' => $filters,
                'options' => [
                    'unit_types' => collect(OrgUnit::TYPE_LABELS)
                        ->map(fn(string $label, string $value): array => [
                            'value' => $value,
                            'label' => $label,
                        ])
                        ->values(),
                    'per_page' => [25, 50, 100],
                    'setup_required' => true,
                ],
                'unknowns' => [
                    'without_leader' => [],
                    'transitional_mappings' => [],
                ],
                'permissions' => [
                    'canManageFoundation' => $this->canManageFoundation($request),
                ],
            ]);
        }

        $rows = OrgUnit::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn(OrgUnit $unit): array => $this->mapUnitRow($unit))
            ->values();

        $tree = $this->buildTree($rows);
        $summary = $this->buildSummary($rows);
        $filteredRows = $this->applyFilters($rows, $filters)->values();
        $pagination = $this->paginateCollection($filteredRows, $filters['per_page'], $filters['page'], $request);

        return Inertia::render('Governance/OrgStructure', [
            'catalog' => app(UniversityAuthorityCatalogService::class)->auditReport(),
            'summary' => $summary,
            'tree' => $tree,
            'units' => $pagination['data'],
            'pagination' => $pagination['meta'],
            'filters' => $filters,
            'options' => [
                'unit_types' => collect(OrgUnit::TYPE_LABELS)
                    ->map(fn(string $label, string $value): array => [
                        'value' => $value,
                        'label' => $label,
                    ])
                    ->values(),
                'per_page' => [25, 50, 100],
            ],
            'unknowns' => [
                'without_leader' => $rows
                    ->filter(function (array $row): bool {
                        return empty($row['leader_name']) && in_array($row['unit_type'], [
                            OrgUnit::TYPE_FACULTY,
                            OrgUnit::TYPE_ACADEMIC_CHAIR,
                            OrgUnit::TYPE_RECTORATE,
                            OrgUnit::TYPE_DEPARTMENT,
                            OrgUnit::TYPE_ADMINISTRATION,
                            OrgUnit::TYPE_OFFICE,
                            OrgUnit::TYPE_CENTER,
                            OrgUnit::TYPE_COLLEGE,
                            OrgUnit::TYPE_MILITARY,
                        ], true);
                    })
                    ->take(20)
                    ->values(),
                'transitional_mappings' => $rows
                    ->filter(function (array $row): bool {
                        $meta = $row['metadata'] ?? [];

                        return (bool) ($meta['transitional_mapping'] ?? false);
                    })
                    ->take(20)
                    ->values(),
            ],
            'permissions' => [
                'canManageFoundation' => $this->canManageFoundation($request),
            ],
        ]);
    }

    private function canAccess(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        $role = $user->resolvedRoleSlug();

        if (in_array($role, ['admin', 'superadmin'], true)) {
            return true;
        }

        if (app(ElevatedAuthorityService::class)->canAccessGovernanceSurface($user)) {
            return true;
        }

        return KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_KPI_ADMIN)
            || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_PERIODS);
    }

    private function canManageFoundation(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if ($user->resolvedRoleSlug() === 'superadmin') {
            return true;
        }

        $authority = app(ElevatedAuthorityService::class)->resolveForUser($user);

        return ($authority['source'] ?? null) === 'scoped_authority'
            && (
                (bool) ($authority['has_business'] ?? false)
                || (bool) ($authority['has_technical'] ?? false)
            );
    }

    private function mapUnitRow(OrgUnit $unit): array
    {
        $meta = is_array($unit->metadata) ? $unit->metadata : [];

        return [
            'id' => $unit->id,
            'code' => $unit->code,
            'name' => $unit->name,
            'unit_type' => $unit->unit_type,
            'unit_type_label' => $unit->unitTypeLabel(),
            'parent_id' => $unit->parent_id,
            'leader_name' => $unit->leader_name,
            'leader_title' => $unit->leader_title,
            'sort_order' => $unit->sort_order,
            'is_active' => $unit->is_active,
            'source' => $unit->source,
            'metadata' => $meta,
        ];
    }

    private function buildTree(Collection $rows): array
    {
        $grouped = $rows->groupBy(fn(array $row): int => (int) ($row['parent_id'] ?? 0));

        return $this->buildTreeNodes(0, $grouped);
    }

    /**
     * @param Collection<int, Collection<int, array<string, mixed>>> $grouped
     * @return array<int, array<string, mixed>>
     */
    private function buildTreeNodes(int $parentId, Collection $grouped): array
    {
        return $grouped
            ->get($parentId, collect())
            ->map(function (array $node) use ($grouped): array {
                $children = $this->buildTreeNodes((int) $node['id'], $grouped);

                return [
                    ...$node,
                    'children_count' => count($children),
                    'children' => $children,
                ];
            })
            ->values()
            ->all();
    }

    private function buildSummary(Collection $rows): array
    {
        return [
            'total_units' => $rows->count(),
            'root_units' => $rows->whereNull('parent_id')->count(),
            'without_leader' => $rows->filter(fn(array $row): bool => empty($row['leader_name']))->count(),
            'transitional_mappings' => $rows
                ->filter(fn(array $row): bool => (bool) (($row['metadata'] ?? [])['transitional_mapping'] ?? false))
                ->count(),
            'type_breakdown' => collect(OrgUnit::TYPE_LABELS)
                ->map(function (string $label, string $type) use ($rows): array {
                    return [
                        'type' => $type,
                        'label' => $label,
                        'count' => $rows->where('unit_type', $type)->count(),
                    ];
                })
                ->filter(fn(array $item): bool => $item['count'] > 0)
                ->values(),
        ];
    }

    private function applyFilters(Collection $rows, array $filters): Collection
    {
        return $rows->filter(function (array $row) use ($filters): bool {
            if ($filters['q'] !== '') {
                $needle = mb_strtolower($filters['q']);
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($row['name'] ?? ''),
                    (string) ($row['code'] ?? ''),
                    (string) ($row['leader_name'] ?? ''),
                    (string) ($row['leader_title'] ?? ''),
                ]));

                if (! str_contains($haystack, $needle)) {
                    return false;
                }
            }

            if ($filters['unit_type'] !== '' && (string) ($row['unit_type'] ?? '') !== $filters['unit_type']) {
                return false;
            }

            if ($filters['missing_leader'] === '1' && ! empty($row['leader_name'])) {
                return false;
            }

            if ($filters['transitional'] === '1' && ! (($row['metadata']['transitional_mapping'] ?? false) === true)) {
                return false;
            }

            return true;
        });
    }

    private function paginateCollection(Collection $rows, int $perPage, int $page, Request $request): array
    {
        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min($page, $lastPage);

        $items = $rows->forPage($currentPage, $perPage)->values();

        $paginator = new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $currentPage,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ]
        );

        return [
            'data' => $items,
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }
}

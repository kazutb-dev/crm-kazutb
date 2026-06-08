<?php

namespace App\Http\Controllers;

use App\Models\KpiAccessGrant;
use App\Models\ScopedGrant;
use App\Models\User;
use App\Services\ElevatedAuthorityService;
use App\Services\ScopedAuthorityLedgerService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class AuthorityLedgerController extends Controller
{
    private const STREAM_CHUNK_SIZE = 100;

    public function __construct(
        private readonly ScopedAuthorityLedgerService $authorityLedgerService,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($this->canAccess($request), 403);

        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'kind' => trim((string) $request->query('kind', 'all')),
            'status' => trim((string) $request->query('status', 'active')),
            'module' => trim((string) $request->query('module', '')),
            'scope_type' => trim((string) $request->query('scope_type', '')),
            'per_page' => max(10, min(50, (int) $request->integer('per_page', 20))),
            'page' => max(1, (int) $request->integer('page', 1)),
        ];

        $offset = max(0, ($filters['page'] - 1) * $filters['per_page']);
        $matchedRows = 0;
        $pageItems = collect();
        $grantCount = 0;
        $delegationCount = 0;
        $activeCount = 0;
        $expiredCount = 0;
        $legacyCount = 0;
        $modules = [];
        $scopeTypes = [];

        if ($filters['kind'] !== 'delegation') {
            $this->streamAuthorityRows(function (Collection $grantRows) use ($filters, $offset, &$matchedRows, &$pageItems, &$grantCount, &$activeCount, &$expiredCount, &$legacyCount, &$modules, &$scopeTypes): void {
                $this->accumulateLedgerState(
                    $grantRows,
                    'grant',
                    $filters,
                    $offset,
                    $matchedRows,
                    $pageItems,
                    $grantCount,
                    $activeCount,
                    $expiredCount,
                    $legacyCount,
                    $modules,
                    $scopeTypes,
                );
            }, 'grant');
        }

        if ($filters['kind'] !== 'grant') {
            $this->streamAuthorityRows(function (Collection $delegationRows) use ($filters, $offset, &$matchedRows, &$pageItems, &$delegationCount, &$activeCount, &$expiredCount, &$legacyCount, &$modules, &$scopeTypes): void {
                $this->accumulateLedgerState(
                    $delegationRows,
                    'delegation',
                    $filters,
                    $offset,
                    $matchedRows,
                    $pageItems,
                    $delegationCount,
                    $activeCount,
                    $expiredCount,
                    $legacyCount,
                    $modules,
                    $scopeTypes,
                );
            }, 'delegation');
        }

        $pagination = $this->paginateCollection($pageItems, $matchedRows, $filters['per_page'], $filters['page'], $request);

        return Inertia::render('Governance/AuthorityLedger', [
            'filters' => $filters,
            'summary' => [
                'scoped_grants' => $grantCount,
                'delegations' => $delegationCount,
                'active' => $activeCount,
                'expired' => $expiredCount,
                'legacy_sources' => $legacyCount,
            ],
            'entries' => $pagination['data'],
            'pagination' => $pagination['meta'],
            'options' => [
                'kinds' => [
                    ['value' => 'all', 'label' => 'Все источники полномочий'],
                    ['value' => 'grant', 'label' => 'Scoped grants'],
                    ['value' => 'delegation', 'label' => 'Делегирования'],
                ],
                'statuses' => [
                    ['value' => 'all', 'label' => 'Все статусы'],
                    ['value' => ScopedGrant::STATUS_ACTIVE, 'label' => 'Активно'],
                    ['value' => ScopedGrant::STATUS_PENDING, 'label' => 'Ожидает'],
                    ['value' => ScopedGrant::STATUS_EXPIRED, 'label' => 'Истекло'],
                    ['value' => ScopedGrant::STATUS_REVOKED, 'label' => 'Отозвано'],
                    ['value' => ScopedGrant::STATUS_SUPERSEDED, 'label' => 'Заменено'],
                ],
                'modules' => collect(array_keys($modules))
                    ->sort()
                    ->map(fn(string $module): array => ['value' => $module, 'label' => $module])
                    ->values(),
                'scope_types' => collect(array_keys($scopeTypes))
                    ->sort()
                    ->map(fn(string $scopeType): array => ['value' => $scopeType, 'label' => $scopeType])
                    ->values(),
            ],
            'permissions' => [
                'canManageFoundation' => $this->canManageFoundation($request),
            ],
        ]);
    }

    private function baseUsersQuery()
    {
        return User::query()
            ->with([
                'faculty:id,name',
                'department:id,name',
                'position:id,name',
                'roleRef:id,slug,name',
            ])
            ->select(['id', 'name', 'display_name', 'email', 'role', 'role_id', 'faculty_id', 'department_id', 'position_id', 'position_title', 'ad_title'])
            ->orderBy('name')
            ->orderBy('id');
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

        return KpiAccessGrant::userHasKpiAdmin((int) $user->id)
            || KpiAccessGrant::userHas((int) $user->id, KpiAccessGrant::PERM_PERIODS);
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

    /**
     * @param Collection<int, User> $users
     * @param array<int, array<string, mixed>> $snapshots
     * @return Collection<int, array<string, mixed>>
     */
    private function collectGrantRows(Collection $users, array $snapshots): Collection
    {
        return $users->flatMap(function (User $user) use ($snapshots): array {
            $snapshot = $snapshots[(int) $user->id] ?? [];

            return collect($snapshot['scoped_grants'] ?? [])->map(function (array $grant) use ($user): array {
                return [
                    'kind' => 'grant',
                    'source' => $grant['source'] ?? 'formal',
                    'id' => $grant['id'],
                    'subject' => $this->userSummaryFromUser($user),
                    'capability' => $grant['capability'] ?? null,
                    'capability_label' => $grant['capability_label'] ?? $grant['capability'] ?? null,
                    'grant_type' => $grant['grant_type'] ?? null,
                    'grant_type_label' => $grant['grant_type_label'] ?? $grant['grant_type'] ?? null,
                    'module' => $grant['module'] ?? null,
                    'scope_type' => $grant['scope_type'] ?? null,
                    'scope_label' => $grant['scope_label'] ?? null,
                    'status' => $grant['status'] ?? null,
                    'status_label' => $grant['status_label'] ?? null,
                    'starts_at' => $grant['starts_at'] ?? null,
                    'ends_at' => $grant['ends_at'] ?? null,
                    'is_effective_now' => (bool) ($grant['is_effective_now'] ?? false),
                    'grantor' => $grant['granted_by'] ?? null,
                    'approver' => $grant['approved_by'] ?? null,
                    'reason' => $grant['reason'] ?? null,
                    'risk_flags' => $grant['risk_flags'] ?? [],
                ];
            })->all();
        })->values();
    }

    /**
     * @param Collection<int, User> $users
     * @param array<int, array<string, mixed>> $snapshots
     * @return Collection<int, array<string, mixed>>
     */
    private function collectDelegationRows(Collection $users, array $snapshots): Collection
    {
        return $users->flatMap(function (User $user) use ($snapshots): array {
            $snapshot = $snapshots[(int) $user->id] ?? [];

            return collect($snapshot['delegations'] ?? [])->map(function (array $delegation) use ($user): array {
                return [
                    'kind' => 'delegation',
                    'source' => $delegation['source'] ?? 'formal',
                    'id' => $delegation['id'],
                    'subject' => $this->userSummaryFromArray($delegation['grantor'] ?? null),
                    'delegate' => $this->userSummaryFromUser($user),
                    'capability' => $delegation['capability'] ?? null,
                    'capability_label' => $delegation['capability_label'] ?? $delegation['capability'] ?? null,
                    'delegation_type' => $delegation['delegation_type'] ?? null,
                    'delegation_type_label' => $delegation['delegation_type_label'] ?? $delegation['delegation_type'] ?? null,
                    'module' => $delegation['module'] ?? null,
                    'scope_type' => $delegation['scope_type'] ?? null,
                    'scope_label' => $delegation['scope_label'] ?? null,
                    'status' => $delegation['status'] ?? null,
                    'status_label' => $delegation['status_label'] ?? null,
                    'starts_at' => $delegation['starts_at'] ?? null,
                    'ends_at' => $delegation['ends_at'] ?? null,
                    'is_effective_now' => (bool) ($delegation['is_effective_now'] ?? false),
                    'grantor' => $delegation['grantor'] ?? null,
                    'approver' => $delegation['approved_by'] ?? null,
                    'reason' => $delegation['reason'] ?? null,
                    'risk_flags' => $delegation['risk_flags'] ?? [],
                ];
            })->all();
        })->values();
    }

    private function matchesFilters(array $row, array $filters, string $kind): bool
    {
        if ($filters['kind'] !== 'all' && $filters['kind'] !== $kind) {
            return false;
        }

        if ($filters['module'] !== '' && ($row['module'] ?? null) !== $filters['module']) {
            return false;
        }

        if ($filters['scope_type'] !== '' && ($row['scope_type'] ?? null) !== $filters['scope_type']) {
            return false;
        }

        return true;
    }

    private function matchesSearchAndStatus(array $row, array $filters): bool
    {
        if ($filters['status'] !== 'all' && ($row['status'] ?? null) !== $filters['status']) {
            return false;
        }

        if ($filters['q'] === '') {
            return true;
        }

        $needle = mb_strtolower($filters['q']);
        $haystack = mb_strtolower(implode(' ', [
            (string) ($row['subject']['name'] ?? ''),
            (string) ($row['delegate']['name'] ?? ''),
            (string) ($row['grantor']['name'] ?? ''),
            (string) ($row['capability_label'] ?? $row['capability'] ?? ''),
            (string) ($row['scope_label'] ?? ''),
        ]));

        return str_contains($haystack, $needle);
    }

    private function userSummaryFromUser(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->display_name ?: $user->name,
            'email' => $user->email,
        ];
    }

    private function userSummaryFromArray(?array $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user['id'] ?? null,
            'name' => $user['name'] ?? null,
            'email' => $user['email'] ?? null,
        ];
    }

    private function streamAuthorityRows(callable $consumer, string $kind): void
    {
        $this->baseUsersQuery()->chunk(self::STREAM_CHUNK_SIZE, function (Collection $users) use ($consumer, $kind): void {
            $snapshots = $this->authorityLedgerService->resolveForUsers($users);
            $rows = $kind === 'grant'
                ? $this->collectGrantRows($users, $snapshots)
                : $this->collectDelegationRows($users, $snapshots);

            $consumer($rows);
        });
    }

    private function accumulateLedgerState(
        Collection $rows,
        string $kind,
        array $filters,
        int $offset,
        int &$matchedRows,
        Collection &$pageItems,
        int &$kindCount,
        int &$activeCount,
        int &$expiredCount,
        int &$legacyCount,
        array &$modules,
        array &$scopeTypes,
    ): void {
        $kindRows = $rows
            ->filter(fn(array $row): bool => $this->matchesFilters($row, $filters, $kind))
            ->values();

        $kindCount += $kindRows->count();
        $legacyCount += $kindRows->where('source', 'legacy')->count();

        foreach ($kindRows as $row) {
            if (! empty($row['module'])) {
                $modules[(string) $row['module']] = true;
            }

            if (! empty($row['scope_type'])) {
                $scopeTypes[(string) $row['scope_type']] = true;
            }

            if (! $this->matchesSearchAndStatus($row, $filters)) {
                continue;
            }

            $matchedRows++;

            if (($row['status'] ?? null) === 'active') {
                $activeCount++;
            }

            if (($row['status'] ?? null) === 'expired') {
                $expiredCount++;
            }

            if ($matchedRows <= $offset || $pageItems->count() >= $filters['per_page']) {
                continue;
            }

            $pageItems->push($row);
        }
    }

    private function paginateCollection(Collection $items, int $total, int $perPage, int $page, Request $request): array
    {
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min($page, $lastPage);
        $from = $total > 0 ? (($currentPage - 1) * $perPage) + 1 : null;
        $to = $total > 0 ? min($currentPage * $perPage, $total) : null;

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
                'from' => $from,
                'to' => $to,
            ],
        ];
    }
}

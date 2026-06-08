<?php

namespace App\Services;

use App\Models\KpiAccessGrant;
use App\Models\OrgUnit;
use App\Models\OrgUnitMapping;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class OrgScopeResolverService
{
    private bool $loaded = false;

    /** @var array<string, OrgUnitMapping> */
    private array $mappingsByTypeAndId = [];

    /** @var array<string, OrgUnitMapping> */
    private array $mappingsByTypeAndCode = [];

    /** @var array<int, OrgUnit> */
    private array $orgUnitsById = [];

    /**
     * @param Collection<int, User> $users
     * @return array<int, array<string, mixed>>
     */
    public function resolveForUsers(Collection $users): array
    {
        $this->bootCaches();

        if (method_exists($users, 'loadMissing')) {
            $users->loadMissing([
                'faculty:id,name,code',
                'department:id,name,code,faculty_id',
                'divisions:id,name,code',
                'kpiStructuralUnits:id,name,code',
                'kpiAccessGrants:id,user_id,permission,division_id,is_active',
            ]);
        }

        $result = [];

        foreach ($users as $user) {
            $result[(int) $user->id] = $this->resolveForUser($user);
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveForUser(User $user): array
    {
        $this->bootCaches();

        $user->loadMissing([
            'faculty:id,name,code',
            'department:id,name,code,faculty_id',
            'divisions:id,name,code',
            'kpiStructuralUnits:id,name,code',
            'kpiAccessGrants:id,user_id,permission,division_id,is_active',
        ]);

        $scopeSources = collect();
        $missingMappings = collect();
        $inconsistencies = collect();

        $faculty = $user->relationLoaded('faculty') ? $user->faculty : null;
        $department = $user->relationLoaded('department') ? $user->department : null;
        $divisions = $user->relationLoaded('divisions') ? $user->divisions : collect();
        $kpiStructuralUnits = $user->relationLoaded('kpiStructuralUnits') ? $user->kpiStructuralUnits : collect();
        $grants = $user->relationLoaded('kpiAccessGrants') ? $user->kpiAccessGrants : collect();

        if ($user->faculty_id !== null) {
            $sourceName = $faculty?->name;
            $sourceCode = is_string($faculty?->code ?? null) ? (string) $faculty->code : null;
            $scopeSources->push($this->resolveSource(
                OrgUnitMapping::SOURCE_FACULTY,
                (int) $user->faculty_id,
                $sourceCode,
                $sourceName,
                'user_binding'
            ));
        }

        if ($user->department_id !== null) {
            $sourceName = $department?->name;
            $sourceCode = is_string($department?->code ?? null) ? (string) $department->code : null;
            $scopeSources->push($this->resolveSource(
                OrgUnitMapping::SOURCE_DEPARTMENT,
                (int) $user->department_id,
                $sourceCode,
                $sourceName,
                'user_binding'
            ));
        }

        foreach ($divisions as $division) {
            $scopeSources->push($this->resolveSource(
                OrgUnitMapping::SOURCE_DIVISION,
                (int) $division->id,
                is_string($division->code ?? null) ? (string) $division->code : null,
                is_string($division->name ?? null) ? (string) $division->name : null,
                'legacy_division'
            ));
        }

        foreach ($kpiStructuralUnits as $unit) {
            $scopeSources->push($this->resolveSource(
                OrgUnitMapping::SOURCE_KPI_STRUCTURAL_UNIT,
                (int) $unit->id,
                is_string($unit->code ?? null) ? (string) $unit->code : null,
                is_string($unit->name ?? null) ? (string) $unit->name : null,
                'kpi_structural_assignment'
            ));
        }

        foreach ($grants as $grant) {
            if ($grant->permission === KpiAccessGrant::PERM_STRUCTURAL_QUEUE && $grant->division_id !== null) {
                $scopeSources->push($this->resolveSource(
                    OrgUnitMapping::SOURCE_DIVISION,
                    (int) $grant->division_id,
                    null,
                    null,
                    'grant_division_scope'
                ));
            }
        }

        $scopeSources = $scopeSources
            ->filter(fn(array $item): bool => ! empty($item['source_id']) || ! empty($item['source_code']))
            ->values();

        foreach ($scopeSources as $source) {
            if (! isset($source['mapping']) || $source['mapping'] === null) {
                $missingMappings->push([
                    'source_type' => $source['source_type'],
                    'source_type_label' => OrgUnitMapping::SOURCE_LABELS[$source['source_type']] ?? $source['source_type'],
                    'source_id' => $source['source_id'],
                    'source_code' => $source['source_code'],
                    'source_name' => $source['source_name'],
                    'origin' => $source['origin'],
                ]);
            }
        }

        $resolvedUnits = $scopeSources
            ->filter(fn(array $source): bool => isset($source['mapping']['org_unit']) && is_array($source['mapping']['org_unit']))
            ->map(function (array $source): array {
                $mapping = $source['mapping'];

                return [
                    'source_type' => $source['source_type'],
                    'source_type_label' => OrgUnitMapping::SOURCE_LABELS[$source['source_type']] ?? $source['source_type'],
                    'source_id' => $source['source_id'],
                    'source_code' => $source['source_code'],
                    'source_name' => $source['source_name'],
                    'origin' => $source['origin'],
                    'org_unit' => $mapping['org_unit'],
                    'mapping_kind' => $mapping['mapping_kind'],
                    'mapping_kind_label' => OrgUnitMapping::KIND_LABELS[$mapping['mapping_kind']] ?? $mapping['mapping_kind'],
                    'confidence' => $mapping['confidence'],
                    'transitional' => in_array($mapping['mapping_kind'], [OrgUnitMapping::KIND_TRANSITIONAL, OrgUnitMapping::KIND_APPROXIMATE], true),
                    'notes' => $mapping['notes'],
                    'mapping_id' => $mapping['mapping_id'],
                ];
            })
            ->unique(fn(array $item): string => ($item['org_unit']['id'] ?? '0') . ':' . ($item['source_type'] ?? ''))
            ->values();

        if (
            $user->faculty_id !== null
            && $user->department_id !== null
            && $department !== null
            && $department->faculty_id !== null
            && (int) $department->faculty_id !== (int) $user->faculty_id
        ) {
            $inconsistencies->push([
                'code' => 'legacy_faculty_department_mismatch',
                'label' => 'Legacy binding conflict: department.faculty_id не совпадает с users.faculty_id',
                'severity' => 'high',
            ]);
        }

        if ($resolvedUnits->pluck('org_unit.id')->unique()->count() > 1 && $user->resolvedRoleSlug() === 'dean') {
            $inconsistencies->push([
                'code' => 'dean_multi_scope',
                'label' => 'Для dean найдено несколько орг-веток scope',
                'severity' => 'medium',
            ]);
        }

        $status = 'ok';

        if ($resolvedUnits->isEmpty()) {
            $status = 'missing';
        } elseif ($missingMappings->isNotEmpty() || $inconsistencies->isNotEmpty()) {
            $status = 'partial';
        }

        $primary = $resolvedUnits
            ->sortByDesc('confidence')
            ->sortBy(function (array $item): int {
                return match ($item['origin']) {
                    'user_binding' => 1,
                    'kpi_structural_assignment' => 2,
                    'grant_division_scope' => 3,
                    'legacy_division' => 4,
                    default => 9,
                };
            })
            ->first();

        return [
            'status' => $status,
            'status_label' => match ($status) {
                'ok' => 'Scope resolved',
                'partial' => 'Scope partially resolved',
                default => 'Scope missing',
            },
            'primary_scope' => $primary ? [
                'org_unit' => $primary['org_unit'],
                'source_type' => $primary['source_type'],
                'source_type_label' => $primary['source_type_label'],
                'origin' => $primary['origin'],
                'mapping_kind' => $primary['mapping_kind'],
                'confidence' => $primary['confidence'],
            ] : null,
            'resolved_units' => $resolvedUnits->values()->all(),
            'missing_mappings' => $missingMappings->values()->all(),
            'inconsistencies' => $inconsistencies->values()->all(),
            'sources_total' => $scopeSources->count(),
            'resolved_total' => $resolvedUnits->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveSource(
        string $sourceType,
        ?int $sourceId,
        ?string $sourceCode,
        ?string $sourceName,
        string $origin
    ): array {
        $mapping = null;

        if ($sourceId !== null) {
            $idKey = $this->mapIdKey($sourceType, $sourceId);
            if (isset($this->mappingsByTypeAndId[$idKey])) {
                $mapping = $this->normalizeMapping($this->mappingsByTypeAndId[$idKey]);
            }
        }

        if ($mapping === null && is_string($sourceCode) && trim($sourceCode) !== '') {
            $codeKey = $this->mapCodeKey($sourceType, $sourceCode);
            if (isset($this->mappingsByTypeAndCode[$codeKey])) {
                $mapping = $this->normalizeMapping($this->mappingsByTypeAndCode[$codeKey]);
            }
        }

        return [
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'source_code' => $sourceCode,
            'source_name' => $sourceName,
            'origin' => $origin,
            'mapping' => $mapping,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizeMapping(OrgUnitMapping $mapping): array
    {
        $orgUnit = null;

        if ($mapping->org_unit_id !== null && isset($this->orgUnitsById[(int) $mapping->org_unit_id])) {
            $unit = $this->orgUnitsById[(int) $mapping->org_unit_id];
            $orgUnit = [
                'id' => $unit->id,
                'code' => $unit->code,
                'name' => $unit->name,
                'unit_type' => $unit->unit_type,
                'unit_type_label' => $unit->unitTypeLabel(),
                'parent_id' => $unit->parent_id,
            ];
        }

        return [
            'mapping_id' => $mapping->id,
            'mapping_kind' => $mapping->mapping_kind,
            'confidence' => (int) $mapping->confidence,
            'notes' => $mapping->notes,
            'org_unit' => $orgUnit,
        ];
    }

    private function mapIdKey(string $type, int $id): string
    {
        return $type . '#' . $id;
    }

    private function mapCodeKey(string $type, string $code): string
    {
        return $type . '@' . mb_strtolower(trim($code));
    }

    private function bootCaches(): void
    {
        if ($this->loaded) {
            return;
        }

        if (! Schema::hasTable('org_unit_mappings') || ! Schema::hasTable('org_units')) {
            $this->loaded = true;

            return;
        }

        $mappings = OrgUnitMapping::query()
            ->where('is_active', true)
            ->orderByDesc('confidence')
            ->get();

        $orgUnitIds = $mappings
            ->pluck('org_unit_id')
            ->filter()
            ->map(fn($id): int => (int) $id)
            ->unique()
            ->values();

        $orgUnits = OrgUnit::query()
            ->whereIn('id', $orgUnitIds)
            ->get()
            ->keyBy('id');

        foreach ($orgUnits as $id => $unit) {
            $this->orgUnitsById[(int) $id] = $unit;
        }

        foreach ($mappings as $mapping) {
            if ($mapping->source_id !== null) {
                $idKey = $this->mapIdKey($mapping->source_type, (int) $mapping->source_id);
                if (! isset($this->mappingsByTypeAndId[$idKey])) {
                    $this->mappingsByTypeAndId[$idKey] = $mapping;
                }
            }

            if (is_string($mapping->source_code) && trim($mapping->source_code) !== '') {
                $codeKey = $this->mapCodeKey($mapping->source_type, $mapping->source_code);
                if (! isset($this->mappingsByTypeAndCode[$codeKey])) {
                    $this->mappingsByTypeAndCode[$codeKey] = $mapping;
                }
            }
        }

        $this->loaded = true;
    }
}

<?php

namespace App\Services;

use App\Models\Delegation;
use App\Models\KpiAccessGrant;
use App\Models\OrgUnit;
use App\Models\ScopedGrant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class ScopedAuthorityLedgerService
{
    public function __construct(
        private readonly OrgScopeResolverService $orgScopeResolver,
    ) {}

    /**
     * @param Collection<int, User> $users
     * @return array<int, array<string, mixed>>
     */
    public function resolveForUsers(Collection $users): array
    {
        $this->boot();

        $userIds = $users->pluck('id')->map(fn($id): int => (int) $id)->values();
        $scopedGrantGroups = $this->loadScopedGrantGroups($userIds);
        $delegationGroups = $this->loadDelegationGroups($userIds);
        $legacyGrantGroups = $this->loadLegacyGrantGroups($userIds);
        $legacyDelegationGroups = $this->loadLegacyDelegationGroups($userIds);
        $orgScopes = $this->orgScopeResolver->resolveForUsers($users);

        $result = [];

        foreach ($users as $user) {
            $userId = (int) $user->id;

            $result[$userId] = $this->resolveForUser(
                $user,
                $orgScopes[$userId] ?? null,
                $scopedGrantGroups->get($userId, collect()),
                $delegationGroups->get($userId, collect()),
                $legacyGrantGroups->get($userId, collect()),
                $legacyDelegationGroups->get($userId, collect()),
            );
        }

        return $result;
    }

    /**
     * @param Collection<int, ScopedGrant>|null $scopedGrants
     * @param Collection<int, Delegation>|null $delegations
     * @param Collection<int, KpiAccessGrant>|null $legacyGrants
     * @param Collection<int, object>|null $legacyDelegations
     * @return array<string, mixed>
     */
    public function resolveForUser(
        User $user,
        ?array $orgScope = null,
        ?Collection $scopedGrants = null,
        ?Collection $delegations = null,
        ?Collection $legacyGrants = null,
        ?Collection $legacyDelegations = null,
    ): array {
        $this->boot();

        $scopedGrants ??= collect();
        $delegations ??= collect();
        $legacyGrants ??= collect();
        $legacyDelegations ??= collect();

        $scopedGrantRows = $scopedGrants->map(fn(ScopedGrant $grant): array => $this->transformScopedGrant($grant))->values();
        $delegationRows = $delegations->map(fn(Delegation $delegation): array => $this->transformDelegation($delegation))->values();
        $legacyGrantRows = $legacyGrants->map(fn(KpiAccessGrant $grant): array => $this->transformLegacyGrant($grant))->values();
        $legacyDelegationRows = $legacyDelegations->map(fn($delegation): array => $this->transformLegacyDelegation($delegation))->values();

        $riskFlags = $this->riskFlags($user, $scopedGrantRows->all(), $delegationRows->all(), $legacyGrantRows->all(), $legacyDelegationRows->all(), $orgScope);

        return [
            'status' => $this->ledgerStatus($scopedGrantRows->all(), $delegationRows->all(), $legacyGrantRows->all(), $legacyDelegationRows->all(), $orgScope),
            'primary_role' => [
                'slug' => $user->resolvedRoleSlug(),
                'label' => $user->resolveRoleLabel(),
                'source' => 'primary_role',
            ],
            'org_scope' => $orgScope ?? [
                'status' => 'missing',
                'status_label' => 'Scope missing',
                'primary_scope' => null,
                'resolved_units' => [],
                'missing_mappings' => [],
                'inconsistencies' => [],
                'sources_total' => 0,
                'resolved_total' => 0,
            ],
            'scoped_grants' => $scopedGrantRows->all(),
            'delegations' => $delegationRows->all(),
            'legacy_sources' => [
                'grants' => $legacyGrantRows->all(),
                'delegations' => $legacyDelegationRows->all(),
            ],
            'effective_authority' => $this->effectiveAuthorityReasons($user, $orgScope, $scopedGrantRows->all(), $delegationRows->all(), $legacyGrantRows->all(), $legacyDelegationRows->all()),
            'risk_flags' => $riskFlags->values()->all(),
            'summary' => [
                'scoped_grants_active' => $scopedGrantRows->where('is_effective_now', true)->count(),
                'delegations_active' => $delegationRows->where('is_effective_now', true)->count(),
                'legacy_grants_active' => $legacyGrantRows->where('is_effective_now', true)->count(),
                'legacy_delegations_active' => $legacyDelegationRows->where('is_effective_now', true)->count(),
            ],
        ];
    }

    /**
     * @param Collection<int> $userIds
     * @return Collection<int, Collection<int, ScopedGrant>>
     */
    private function loadScopedGrantGroups(Collection $userIds): Collection
    {
        if (! Schema::hasTable('scoped_grants') || $userIds->isEmpty()) {
            return collect();
        }

        return ScopedGrant::query()
            ->with(['grantedBy:id,name,display_name,email', 'approvedBy:id,name,display_name,email', 'orgUnit:id,name,code,parent_id,unit_type'])
            ->whereIn('subject_user_id', $userIds->all())
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('subject_user_id');
    }

    /**
     * @param Collection<int> $userIds
     * @return Collection<int, Collection<int, Delegation>>
     */
    private function loadDelegationGroups(Collection $userIds): Collection
    {
        if (! Schema::hasTable('delegations') || $userIds->isEmpty()) {
            return collect();
        }

        return Delegation::query()
            ->with(['grantor:id,name,display_name,email', 'delegate:id,name,display_name,email', 'approvedBy:id,name,display_name,email', 'orgUnit:id,name,code,parent_id,unit_type'])
            ->whereIn('delegate_user_id', $userIds->all())
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('delegate_user_id');
    }

    /**
     * @param Collection<int> $userIds
     * @return Collection<int, Collection<int, KpiAccessGrant>>
     */
    private function loadLegacyGrantGroups(Collection $userIds): Collection
    {
        if (! Schema::hasTable('kpi_access_grants') || $userIds->isEmpty()) {
            return collect();
        }

        return KpiAccessGrant::query()
            ->with(['grantedBy:id,name,display_name,email', 'division:id,name,code'])
            ->whereIn('user_id', $userIds->all())
            ->where('is_active', true)
            ->orderBy('permission')
            ->orderByDesc('granted_at')
            ->get()
            ->groupBy('user_id');
    }

    /**
     * @param Collection<int> $userIds
     * @return Collection<int, Collection<int, object>>
     */
    private function loadLegacyDelegationGroups(Collection $userIds): Collection
    {
        if (! Schema::hasTable('calendar_secretary_access') || $userIds->isEmpty()) {
            return collect();
        }

        return \App\Models\CalendarSecretaryAccess::query()
            ->with(['manager:id,name,display_name,email', 'secretary:id,name,display_name,email'])
            ->whereIn('secretary_id', $userIds->all())
            ->orderByDesc('granted_at')
            ->get()
            ->groupBy('secretary_id');
    }

    private function boot(): void
    {
        if (! Schema::hasTable('org_units')) {
            return;
        }
    }

    private function transformScopedGrant(ScopedGrant $grant): array
    {
        return [
            'id' => $grant->id,
            'source' => 'formal',
            'grant_type' => $grant->grant_type,
            'grant_type_label' => $grant->grantTypeLabel(),
            'capability' => $grant->capability,
            'capability_label' => $this->capabilityLabel($grant->capability),
            'module' => $grant->module,
            'scope_type' => $grant->scope_type,
            'scope_source_type' => $grant->scope_source_type,
            'scope_source_id' => $grant->scope_source_id,
            'scope_label' => $this->scopeLabel($grant->scope_type, $grant->orgUnit, $grant->scope_source_type, $grant->scope_source_id),
            'org_unit' => $grant->orgUnit ? [
                'id' => $grant->orgUnit->id,
                'code' => $grant->orgUnit->code,
                'name' => $grant->orgUnit->name,
                'unit_type' => $grant->orgUnit->unit_type,
            ] : null,
            'status' => $grant->status,
            'status_label' => $grant->status,
            'starts_at' => $grant->starts_at?->toIso8601String(),
            'ends_at' => $grant->ends_at?->toIso8601String(),
            'is_effective_now' => $grant->isActiveNow(),
            'granted_by' => $this->actorSummary($grant->grantedBy),
            'approved_by' => $this->actorSummary($grant->approvedBy),
            'reason' => $grant->reason,
            'metadata' => $grant->metadata ?? [],
            'risk_flags' => $this->grantRisks($grant),
        ];
    }

    private function transformDelegation(Delegation $delegation): array
    {
        return [
            'id' => $delegation->id,
            'source' => 'formal',
            'delegation_type' => $delegation->delegation_type,
            'delegation_type_label' => $delegation->delegationTypeLabel(),
            'capability' => $delegation->capability,
            'capability_label' => $this->capabilityLabel($delegation->capability),
            'module' => $delegation->module,
            'scope_type' => $delegation->scope_type,
            'scope_source_type' => $delegation->scope_source_type,
            'scope_source_id' => $delegation->scope_source_id,
            'scope_label' => $this->scopeLabel($delegation->scope_type, $delegation->orgUnit, $delegation->scope_source_type, $delegation->scope_source_id),
            'org_unit' => $delegation->orgUnit ? [
                'id' => $delegation->orgUnit->id,
                'code' => $delegation->orgUnit->code,
                'name' => $delegation->orgUnit->name,
                'unit_type' => $delegation->orgUnit->unit_type,
            ] : null,
            'status' => $delegation->status,
            'status_label' => $delegation->status,
            'starts_at' => $delegation->starts_at?->toIso8601String(),
            'ends_at' => $delegation->ends_at?->toIso8601String(),
            'is_effective_now' => $delegation->isActiveNow(),
            'grantor' => $this->actorSummary($delegation->grantor),
            'delegate' => $this->actorSummary($delegation->delegate),
            'approved_by' => $this->actorSummary($delegation->approvedBy),
            'reason' => $delegation->reason,
            'metadata' => $delegation->metadata ?? [],
            'risk_flags' => $this->delegationRisks($delegation),
        ];
    }

    private function transformLegacyGrant(KpiAccessGrant $grant): array
    {
        return [
            'id' => $grant->id,
            'source' => 'legacy',
            'grant_type' => 'legacy_kpi',
            'grant_type_label' => 'Legacy KPI grant',
            'capability' => $grant->permission,
            'capability_label' => KpiAccessGrant::PERMISSION_LABELS[$grant->permission] ?? $grant->permission,
            'module' => 'kpi',
            'scope_type' => $grant->division_id !== null ? 'division' : 'global',
            'scope_label' => $grant->division?->name ?: ($grant->division_id !== null ? 'Division #' . $grant->division_id : 'Global legacy grant'),
            'org_unit' => null,
            'status' => $grant->is_active ? 'active' : 'inactive',
            'status_label' => $grant->is_active ? 'active' : 'inactive',
            'starts_at' => $grant->granted_at?->toIso8601String(),
            'ends_at' => null,
            'is_effective_now' => (bool) $grant->is_active,
            'granted_by' => $this->actorSummary($grant->grantedBy),
            'approved_by' => null,
            'reason' => null,
            'metadata' => [
                'legacy_permission' => $grant->permission,
            ],
            'risk_flags' => [],
        ];
    }

    private function transformLegacyDelegation(object $access): array
    {
        return [
            'id' => $access->id,
            'source' => 'legacy',
            'delegation_type' => 'legacy_secretary',
            'delegation_type_label' => 'Legacy secretary delegation',
            'capability' => 'calendar.secretary',
            'capability_label' => 'Calendar secretary access',
            'module' => 'calendar',
            'scope_type' => 'coverage',
            'scope_label' => $access->manager?->name ? 'Coverage for ' . $access->manager->name : 'Secretary coverage',
            'org_unit' => null,
            'status' => ($access->is_active ?? false) && empty($access->revoked_at) ? 'active' : 'inactive',
            'status_label' => ($access->is_active ?? false) && empty($access->revoked_at) ? 'active' : 'inactive',
            'starts_at' => $access->granted_at?->toIso8601String(),
            'ends_at' => $access->revoked_at?->toIso8601String(),
            'is_effective_now' => (bool) ($access->is_active ?? false) && empty($access->revoked_at),
            'grantor' => $this->actorSummary($access->manager ?? null),
            'delegate' => $this->actorSummary($access->secretary ?? null),
            'approved_by' => null,
            'reason' => null,
            'metadata' => [],
            'risk_flags' => [],
        ];
    }

    private function actorSummary(?User $user): ?array
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

    private function capabilityLabel(string $capability): string
    {
        return match ($capability) {
            KpiAccessGrant::PERM_REVIEW_QUEUE => 'KPI review queue',
            KpiAccessGrant::PERM_APPROVAL_QUEUE => 'KPI approval queue',
            KpiAccessGrant::PERM_STRUCTURAL_QUEUE => 'Structural queue',
            KpiAccessGrant::PERM_INDICATORS => 'KPI indicators',
            KpiAccessGrant::PERM_ANALYTICS => 'KPI analytics',
            KpiAccessGrant::PERM_PERIODS => 'Period administration',
            default => $capability,
        };
    }

    private function scopeLabel(?string $scopeType, ?OrgUnit $orgUnit, ?string $scopeSourceType, mixed $scopeSourceId): string
    {
        if ($orgUnit) {
            return $orgUnit->name . ($scopeType ? ' [' . $scopeType . ']' : '');
        }

        if ($scopeType !== null && $scopeType !== '') {
            return $scopeType . ($scopeSourceType ? ' via ' . $scopeSourceType : '') . ($scopeSourceId !== null ? ' #' . $scopeSourceId : '');
        }

        if ($scopeSourceType !== null && $scopeSourceType !== '') {
            return $scopeSourceType . ($scopeSourceId !== null ? ' #' . $scopeSourceId : '');
        }

        return 'Global';
    }

    private function grantRisks(ScopedGrant $grant): array
    {
        $risks = [];

        if ($grant->status === ScopedGrant::STATUS_ACTIVE && $grant->ends_at !== null && $grant->ends_at->lt(now())) {
            $risks[] = [
                'code' => 'expired_but_active',
                'label' => 'Grant expired but is still active',
                'severity' => 'high',
            ];
        }

        if ($grant->status === ScopedGrant::STATUS_ACTIVE && $grant->org_unit_id === null && $grant->scope_type !== 'global') {
            $risks[] = [
                'code' => 'grant_without_scope',
                'label' => 'Grant lacks org scope binding',
                'severity' => 'medium',
            ];
        }

        return $risks;
    }

    private function delegationRisks(Delegation $delegation): array
    {
        $risks = [];

        if ($delegation->status === Delegation::STATUS_ACTIVE && $delegation->ends_at !== null && $delegation->ends_at->lt(now())) {
            $risks[] = [
                'code' => 'expired_but_active',
                'label' => 'Delegation expired but is still active',
                'severity' => 'high',
            ];
        }

        if ($delegation->status === Delegation::STATUS_ACTIVE && $delegation->delegate_user_id === $delegation->grantor_user_id) {
            $risks[] = [
                'code' => 'self_delegation',
                'label' => 'Delegation is self-referential',
                'severity' => 'medium',
            ];
        }

        return $risks;
    }

    /**
     * @param array<int, array<string, mixed>> $scopedGrants
     * @param array<int, array<string, mixed>> $delegations
     * @param array<int, array<string, mixed>> $legacyGrants
     * @param array<int, array<string, mixed>> $legacyDelegations
     */
    private function riskFlags(User $user, array $scopedGrants, array $delegations, array $legacyGrants, array $legacyDelegations, ?array $orgScope): Collection
    {
        $flags = collect();

        if ($user->resolvedRoleSlug() === 'superadmin') {
            $flags->push($this->flag('superadmin_primary_role', 'Primary superadmin authority', 'low'));
        }

        if (collect($scopedGrants)->contains(fn(array $item): bool => ! empty($item['risk_flags']))) {
            $flags->push($this->flag('scoped_grant_risk', 'At least one scoped grant has a risk flag', 'medium'));
        }

        if (collect($delegations)->contains(fn(array $item): bool => ! empty($item['risk_flags']))) {
            $flags->push($this->flag('delegation_risk', 'At least one delegation has a risk flag', 'medium'));
        }

        if (! empty($legacyGrants)) {
            $flags->push($this->flag('legacy_grants_present', 'Legacy grant source still present', 'low'));
        }

        if (! empty($legacyDelegations)) {
            $flags->push($this->flag('legacy_delegations_present', 'Legacy delegation source still present', 'low'));
        }

        if (is_array($orgScope) && ! empty($orgScope['missing_mappings'] ?? [])) {
            $flags->push($this->flag('missing_org_mappings', 'Authority scope has unmapped org sources', 'high'));
        }

        return $flags;
    }

    /**
     * @param array<int, array<string, mixed>> $scopedGrants
     * @param array<int, array<string, mixed>> $delegations
     * @param array<int, array<string, mixed>> $legacyGrants
     * @param array<int, array<string, mixed>> $legacyDelegations
     * @return array<int, string>
     */
    private function effectiveAuthorityReasons(User $user, ?array $orgScope, array $scopedGrants, array $delegations, array $legacyGrants, array $legacyDelegations): array
    {
        $reasons = [];

        if (in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true)) {
            $reasons[] = 'Primary role: ' . $user->resolveRoleLabel();
        }

        foreach ($scopedGrants as $grant) {
            if (! ($grant['is_effective_now'] ?? false)) {
                continue;
            }

            $reasons[] = 'Scoped grant: ' . ($grant['grant_type_label'] ?? $grant['grant_type'] ?? 'grant')
                . ' / ' . ($grant['capability_label'] ?? $grant['capability'] ?? 'capability')
                . ' / ' . ($grant['scope_label'] ?? 'scope');
        }

        foreach ($delegations as $delegation) {
            if (! ($delegation['is_effective_now'] ?? false)) {
                continue;
            }

            $reasons[] = 'Delegation: ' . ($delegation['delegation_type_label'] ?? $delegation['delegation_type'] ?? 'delegation')
                . ' / ' . ($delegation['capability_label'] ?? $delegation['capability'] ?? 'capability')
                . ' / ' . ($delegation['scope_label'] ?? 'scope');
        }

        foreach ($legacyGrants as $grant) {
            if (! ($grant['is_effective_now'] ?? false)) {
                continue;
            }

            $reasons[] = 'Legacy grant: ' . ($grant['capability_label'] ?? $grant['capability'] ?? 'grant');
        }

        foreach ($legacyDelegations as $delegation) {
            if (! ($delegation['is_effective_now'] ?? false)) {
                continue;
            }

            $reasons[] = 'Legacy delegation: ' . ($delegation['capability_label'] ?? $delegation['capability'] ?? 'delegation');
        }

        if (is_array($orgScope) && ! empty($orgScope['primary_scope']['org_unit']['name'])) {
            $reasons[] = 'Resolved org scope: ' . (string) $orgScope['primary_scope']['org_unit']['name'];
        }

        return array_values(array_unique($reasons));
    }

    /**
     * @param array<int, array<string, mixed>> $scopedGrants
     * @param array<int, array<string, mixed>> $delegations
     * @param array<int, array<string, mixed>> $legacyGrants
     * @param array<int, array<string, mixed>> $legacyDelegations
     */
    private function ledgerStatus(array $scopedGrants, array $delegations, array $legacyGrants, array $legacyDelegations, ?array $orgScope): string
    {
        if (empty($scopedGrants) && empty($delegations) && empty($legacyGrants) && empty($legacyDelegations) && empty($orgScope)) {
            return 'missing';
        }

        if ($this->hasAnyRisk($scopedGrants, $delegations, $legacyGrants, $legacyDelegations, $orgScope)) {
            return 'partial';
        }

        return 'ok';
    }

    /**
     * @param array<int, array<string, mixed>> $scopedGrants
     * @param array<int, array<string, mixed>> $delegations
     * @param array<int, array<string, mixed>> $legacyGrants
     * @param array<int, array<string, mixed>> $legacyDelegations
     */
    private function hasAnyRisk(array $scopedGrants, array $delegations, array $legacyGrants, array $legacyDelegations, ?array $orgScope): bool
    {
        if (collect($scopedGrants)->contains(fn(array $item): bool => ! empty($item['risk_flags']))) {
            return true;
        }

        if (collect($delegations)->contains(fn(array $item): bool => ! empty($item['risk_flags']))) {
            return true;
        }

        if (! empty($legacyGrants) || ! empty($legacyDelegations)) {
            return true;
        }

        return is_array($orgScope) && (! empty($orgScope['missing_mappings'] ?? []) || ! empty($orgScope['inconsistencies'] ?? []));
    }

    private function flag(string $code, string $label, string $severity): array
    {
        return [
            'code' => $code,
            'label' => $label,
            'severity' => $severity,
        ];
    }
}

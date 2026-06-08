<?php

namespace App\Services;

use App\Models\KpiAccessGrant;
use App\Models\User;

class KpiAccessEvaluatorService
{
    public const MODE_LEGACY_WITH_DIAGNOSTICS = 'legacy_with_diagnostics';
    public const MODE_STRICT_GOVERNANCE = 'strict_governance';

    public function __construct(
        private readonly OrgScopeResolverService $orgScopeResolver,
        private readonly ScopedAuthorityLedgerService $authorityLedger,
        private readonly AcademicScopeResolverService $academicScopeResolver,
        private readonly KpiParticipantEligibilityService $participantEligibility,
    ) {}

    /**
     * @param array<string, mixed>|null $resolvedOrgScope
     * @param array<string, mixed>|null $authoritySnapshot
     * @return array<string, mixed>
     */
    public function evaluateQueueAccess(
        User $user,
        string $permission,
        ?array $resolvedOrgScope = null,
        ?array $authoritySnapshot = null,
        bool $hasPendingPositionRequest = false,
    ): array {
        $role = $user->resolvedRoleSlug();
        $resolvedOrgScope ??= $this->orgScopeResolver->resolveForUser($user);
        $authoritySnapshot ??= $this->authorityLedger->resolveForUser($user, $resolvedOrgScope);

        $legacyAllow = KpiAccessGrant::userHas((int) $user->id, $permission)
            || $role !== 'teacher';

        $isSuperAdmin = in_array($role, ['admin', 'superadmin'], true);
        $roleEligible = $this->roleEligible($role, $permission) || $isSuperAdmin;
        $positionConfirmed = ! $hasPendingPositionRequest || $isSuperAdmin;
        $inOrgScope = $this->inOrgScope($user, $role, $permission, $resolvedOrgScope) || $isSuperAdmin;

        $authority = $this->authoritySources($role, $permission, $authoritySnapshot);
        $assignmentActive = ($authority['assignment_active'] ?? false) || $isSuperAdmin;

        $governanceAllow = $roleEligible
            && $positionConfirmed
            && $inOrgScope
            && $assignmentActive;

        $mode = config('kpi.governance_migration.queue_gate_mode', self::MODE_LEGACY_WITH_DIAGNOSTICS);
        $allow = match ($mode) {
            self::MODE_STRICT_GOVERNANCE => $governanceAllow,
            default => $legacyAllow,
        };

        $missingRequirements = [];

        if (! $roleEligible) {
            $missingRequirements[] = 'RoleEligible';
        }

        if (! $positionConfirmed) {
            $missingRequirements[] = 'PositionConfirmed';
        }

        if (! $inOrgScope) {
            $missingRequirements[] = 'InOrgScope';
        }

        if (! $assignmentActive) {
            $missingRequirements[] = 'AssignmentActive';
        }

        $transitionalRisks = [];

        if ($legacyAllow !== $governanceAllow) {
            $transitionalRisks[] = [
                'code' => 'legacy_governance_mismatch',
                'label' => $legacyAllow
                    ? 'Legacy allows while governance denies'
                    : 'Governance allows while legacy denies',
                'severity' => $legacyAllow ? 'high' : 'medium',
            ];
        }

        if (($resolvedOrgScope['status'] ?? 'missing') === 'missing') {
            $transitionalRisks[] = [
                'code' => 'org_scope_missing',
                'label' => 'Org scope resolver has missing scope for this user',
                'severity' => 'high',
            ];
        }

        return [
            'permission' => $permission,
            'mode' => $mode,
            'allow' => $allow,
            'legacy_allow' => $legacyAllow,
            'governance_allow' => $governanceAllow,
            'role_eligible' => $roleEligible,
            'position_confirmed' => $positionConfirmed,
            'in_org_scope' => $inOrgScope,
            'assignment_active' => $assignmentActive,
            'authority_source' => $authority['source'] ?? 'none',
            'authority_details' => $authority,
            'missing_requirements' => $missingRequirements,
            'fallback_used' => $mode === self::MODE_LEGACY_WITH_DIAGNOSTICS,
            'transitional_risks' => $transitionalRisks,
            'reason' => $allow
                ? 'Allowed by ' . ($mode === self::MODE_STRICT_GOVERNANCE ? 'governance model' : 'legacy-compatible hybrid mode')
            : 'Denied by deny-by-default evaluation',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function evaluateModuleAccess(User $user): array
    {
        $role = $user->resolvedRoleSlug();
        $resolvedOrgScope = $this->orgScopeResolver->resolveForUser($user);
        $authoritySnapshot = $this->authorityLedger->resolveForUser($user, $resolvedOrgScope);
        $academicSnapshot = $this->academicScopeResolver->resolveForUser($user);
        $participantSnapshot = $this->participantEligibility->evaluateUser($user);

        $isSuperAdmin = in_array($role, ['admin', 'superadmin'], true);
        $hasKpiAdminGrant = KpiAccessGrant::userHasKpiAdmin((int) $user->id);
        $roleEligible = $isSuperAdmin || in_array($role, ['teacher', 'hod', 'dean', 'structural', 'department'], true);
        $positionConfirmed = $isSuperAdmin || (bool) $user->position_confirmed;
        $inOrgScope = $isSuperAdmin || (($resolvedOrgScope['status'] ?? 'missing') !== 'missing');
        $assignmentActive = $isSuperAdmin || $this->hasActiveAcademicAssignment($academicSnapshot);
        $participantEligible = $isSuperAdmin || (bool) ($participantSnapshot['eligible'] ?? false);
        $allow = $isSuperAdmin
            || (
                $roleEligible
                && $positionConfirmed
                && $inOrgScope
                && $assignmentActive
                && $participantEligible
            );
        $authorityActive = $isSuperAdmin
            || $hasKpiAdminGrant
            || (bool) ($authoritySnapshot['summary']['scoped_grants_active'] ?? 0)
            || (bool) ($authoritySnapshot['summary']['delegations_active'] ?? 0)
            || (bool) ($authoritySnapshot['summary']['legacy_grants_active'] ?? 0)
            || (bool) ($authoritySnapshot['summary']['legacy_delegations_active'] ?? 0);

        $missingRequirements = [];

        if (! $roleEligible) {
            $missingRequirements[] = 'RoleEligible';
        }

        if (! $positionConfirmed) {
            $missingRequirements[] = 'PositionConfirmed';
        }

        if (! $inOrgScope) {
            $missingRequirements[] = 'InOrgScope';
        }

        if (! $assignmentActive) {
            $missingRequirements[] = 'AssignmentActive';
        }

        if (! $participantEligible) {
            $missingRequirements[] = 'ParticipantEligible';
        }

        return [
            'allow' => $allow,
            'role_eligible' => $roleEligible,
            'position_confirmed' => $positionConfirmed,
            'in_org_scope' => $inOrgScope,
            'assignment_active' => $assignmentActive,
            'participant_eligible' => $participantEligible,
            'authority_active' => $authorityActive,
            'missing_requirements' => $missingRequirements,
            'resolved_org_scope' => $resolvedOrgScope,
            'authority_snapshot' => $authoritySnapshot,
            'academic_snapshot' => $academicSnapshot,
            'participant_snapshot' => $participantSnapshot,
        ];
    }

    private function roleEligible(string $role, string $permission): bool
    {
        if (in_array($role, ['admin', 'superadmin'], true)) {
            return true;
        }

        return match ($permission) {
            KpiAccessGrant::PERM_REVIEW_QUEUE => in_array($role, ['hod', 'department_head'], true),
            KpiAccessGrant::PERM_APPROVAL_QUEUE => $role === 'dean',
            KpiAccessGrant::PERM_STRUCTURAL_QUEUE => in_array($role, ['structural', 'department'], true),
            default => false,
        };
    }

    /**
     * @param array<string, mixed> $resolvedOrgScope
     */
    private function inOrgScope(User $user, string $role, string $permission, array $resolvedOrgScope): bool
    {
        if (in_array($role, ['admin', 'superadmin'], true)) {
            return true;
        }

        if (($resolvedOrgScope['status'] ?? null) === 'missing') {
            return false;
        }

        return match ($permission) {
            KpiAccessGrant::PERM_REVIEW_QUEUE => $user->department_id !== null
                || $this->scopeContainsSource($resolvedOrgScope, 'department'),
            KpiAccessGrant::PERM_APPROVAL_QUEUE => $user->faculty_id !== null
                || $this->scopeContainsSource($resolvedOrgScope, 'faculty'),
            KpiAccessGrant::PERM_STRUCTURAL_QUEUE => $this->scopeContainsAnySource(
                $resolvedOrgScope,
                ['kpi_structural_unit', 'division']
            ),
            default => false,
        };
    }

    /**
     * @param array<string, mixed> $resolvedOrgScope
     */
    private function scopeContainsSource(array $resolvedOrgScope, string $sourceType): bool
    {
        $resolvedUnits = collect($resolvedOrgScope['resolved_units'] ?? []);

        return $resolvedUnits->contains(fn(array $entry): bool => ($entry['source_type'] ?? null) === $sourceType);
    }

    /**
     * @param array<string, mixed> $resolvedOrgScope
     * @param array<int, string> $sourceTypes
     */
    private function scopeContainsAnySource(array $resolvedOrgScope, array $sourceTypes): bool
    {
        $resolvedUnits = collect($resolvedOrgScope['resolved_units'] ?? []);

        return $resolvedUnits->contains(fn(array $entry): bool => in_array((string) ($entry['source_type'] ?? ''), $sourceTypes, true));
    }

    /**
     * @param array<string, mixed> $authoritySnapshot
     * @return array<string, mixed>
     */
    private function authoritySources(string $role, string $permission, array $authoritySnapshot): array
    {
        $scopedGrants = collect($authoritySnapshot['scoped_grants'] ?? [])
            ->filter(function (array $grant) use ($permission): bool {
                if (! ($grant['is_effective_now'] ?? false)) {
                    return false;
                }

                $module = (string) ($grant['module'] ?? '');
                $capability = (string) ($grant['capability'] ?? '');

                return ($module === '' || $module === 'kpi') && $capability === $permission;
            })
            ->values();

        $delegations = collect($authoritySnapshot['delegations'] ?? [])
            ->filter(function (array $delegation) use ($permission): bool {
                if (! ($delegation['is_effective_now'] ?? false)) {
                    return false;
                }

                $module = (string) ($delegation['module'] ?? '');
                $capability = (string) ($delegation['capability'] ?? '');

                return ($module === '' || $module === 'kpi') && $capability === $permission;
            })
            ->values();

        $legacyGrants = collect($authoritySnapshot['legacy_sources']['grants'] ?? [])
            ->filter(fn(array $grant): bool => ($grant['is_effective_now'] ?? false) && ($grant['capability'] ?? null) === $permission)
            ->values();

        $primaryRoleAssignment = $this->roleEligible($role, $permission)
            || in_array($role, ['admin', 'superadmin'], true);

        $source = 'none';

        if ($scopedGrants->isNotEmpty()) {
            $source = 'scoped_grant';
        } elseif ($delegations->isNotEmpty()) {
            $source = 'delegation';
        } elseif ($legacyGrants->isNotEmpty()) {
            $source = 'legacy_grant';
        } elseif ($primaryRoleAssignment) {
            $source = 'primary_role';
        }

        return [
            'source' => $source,
            'primary_role_assignment' => $primaryRoleAssignment,
            'scoped_grants' => $scopedGrants->all(),
            'delegations' => $delegations->all(),
            'legacy_grants' => $legacyGrants->all(),
            'assignment_active' => $primaryRoleAssignment
                || $scopedGrants->isNotEmpty()
                || $delegations->isNotEmpty()
                || $legacyGrants->isNotEmpty(),
        ];
    }

    /**
     * @param array<string, mixed> $academicSnapshot
     */
    private function hasActiveAcademicAssignment(array $academicSnapshot): bool
    {
        if (($academicSnapshot['status'] ?? null) === 'ready') {
            return true;
        }

        return ! empty($academicSnapshot['active_scope_assignments']);
    }
}

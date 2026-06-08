<?php

namespace App\Services;

use App\Models\KpiAccessGrant;
use App\Models\User;

class ElevatedAuthorityService
{
    public const CATEGORY_BUSINESS = 'business_super_admin';
    public const CATEGORY_TECHNICAL = 'technical_super_admin';
    public const CATEGORY_OPERATOR = 'platform_operator';

    /**
     * @param array<string, mixed>|null $authoritySnapshot
     * @return array<string, mixed>
     */
    public function resolveForUser(User $user, ?array $authoritySnapshot = null): array
    {
        $authoritySnapshot ??= app(ScopedAuthorityLedgerService::class)->resolveForUser($user);

        $capabilities = config('governance.capabilities', []);
        $businessCapability = (string) ($capabilities['business_super_admin'] ?? 'governance.business_super_admin');
        $technicalCapability = (string) ($capabilities['technical_super_admin'] ?? 'governance.technical_super_admin');
        $operatorCapability = (string) ($capabilities['platform_operator'] ?? 'governance.platform_operator');

        $activeCapabilities = collect($authoritySnapshot['scoped_grants'] ?? [])
            ->where('is_effective_now', true)
            ->pluck('capability')
            ->filter()
            ->map(fn($v): string => (string) $v)
            ->unique()
            ->values();

        $role = $user->resolvedRoleSlug();

        $hasBusiness = $activeCapabilities->contains($businessCapability)
            || in_array($role, ['admin', 'superadmin'], true)
            || KpiAccessGrant::userHasKpiAdmin((int) $user->id);

        $hasTechnical = $activeCapabilities->contains($technicalCapability)
            || $role === 'superadmin';

        $hasOperator = $activeCapabilities->contains($operatorCapability);

        $categories = collect();
        if ($hasBusiness) {
            $categories->push(self::CATEGORY_BUSINESS);
        }
        if ($hasTechnical) {
            $categories->push(self::CATEGORY_TECHNICAL);
        }
        if ($hasOperator) {
            $categories->push(self::CATEGORY_OPERATOR);
        }

        $legacyBroad = in_array($role, ['admin', 'superadmin'], true) || KpiAccessGrant::userHasKpiAdmin((int) $user->id);

        return [
            'categories' => $categories->values()->all(),
            'has_business' => $hasBusiness,
            'has_technical' => $hasTechnical,
            'has_operator' => $hasOperator,
            'mixed_elevated' => $categories->count() > 1,
            'legacy_broad' => $legacyBroad,
            'source' => $this->sourceLabel($categories->all(), $activeCapabilities->all(), $role),
        ];
    }

    /**
     * @param array<string, mixed>|null $authorityProfile
     */
    public function canAccessGovernanceSurface(User $user, ?array $authorityProfile = null): bool
    {
        $authorityProfile ??= $this->resolveForUser($user);

        return (bool) ($authorityProfile['has_business'] ?? false)
            || (bool) ($authorityProfile['has_technical'] ?? false);
    }

    /**
     * @param array<string, mixed>|null $authorityProfile
     * @return array<string, mixed>
     */
    public function evaluateDangerousAction(User $user, string $action, ?array $authorityProfile = null): array
    {
        $authorityProfile ??= $this->resolveForUser($user);
        $policy = config('governance.dangerous_actions.' . $action, []);

        $requiredCategory = (string) ($policy['category'] ?? 'business');
        $allowTechnicalOverride = (bool) ($policy['allow_technical_override'] ?? true);

        $hasBusiness = (bool) ($authorityProfile['has_business'] ?? false);
        $hasTechnical = (bool) ($authorityProfile['has_technical'] ?? false);

        $allowedByCategory = match ($requiredCategory) {
            'technical' => $hasTechnical,
            'operator' => (bool) ($authorityProfile['has_operator'] ?? false),
            default => $hasBusiness,
        };

        $technicalOverride = ! $allowedByCategory && $allowTechnicalOverride && $hasTechnical;

        $mode = (string) config('governance.elevated_mode', 'legacy_with_diagnostics');
        $legacyFallback = (bool) ($authorityProfile['legacy_broad'] ?? false);

        $allow = match ($mode) {
            'strict_categories' => $allowedByCategory || $technicalOverride,
            default => ($allowedByCategory || $technicalOverride || $legacyFallback),
        };

        $reasonRequired = $technicalOverride
            ? (bool) ($policy['technical_reason_required'] ?? true)
            : (bool) ($policy['business_reason_required'] ?? false);

        return [
            'action' => $action,
            'mode' => $mode,
            'allow' => $allow,
            'required_category' => $requiredCategory,
            'allowed_by_category' => $allowedByCategory,
            'technical_override' => $technicalOverride,
            'legacy_fallback_used' => $allow && ! ($allowedByCategory || $technicalOverride),
            'reason_required' => $reasonRequired,
            'reason_min' => $reasonRequired ? 8 : 0,
            'transitional_risk' => ($allowedByCategory || $technicalOverride) ? null : 'legacy_broad_elevation',
        ];
    }

    /**
     * @param array<int, string> $categories
     * @param array<int, string> $capabilities
     */
    private function sourceLabel(array $categories, array $capabilities, string $role): string
    {
        if (! empty($capabilities)) {
            return 'scoped_authority';
        }

        if ($role === 'superadmin') {
            return 'legacy_superadmin';
        }

        if ($role === 'admin') {
            return 'legacy_admin';
        }

        if (in_array(self::CATEGORY_BUSINESS, $categories, true)) {
            return 'legacy_kpi_admin';
        }

        return 'none';
    }
}

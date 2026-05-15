<?php

namespace App\Policies;

use App\Models\KpiAccessGrant;
use App\Models\KpiPeriod;
use App\Models\User;

class KpiPeriodPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isAdmin($user)
            || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_PERIODS);
    }

    public function view(User $user, KpiPeriod $period): bool
    {
        return $this->isAdmin($user)
            || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_PERIODS);
    }

    public function create(User $user): bool
    {
        return $this->canManagePeriods($user);
    }

    public function update(User $user, KpiPeriod $period): bool
    {
        if ($period->status === KpiPeriod::STATUS_CLOSED) {
            return false;
        }

        return $this->canManagePeriods($user);
    }

    public function submit(User $user, KpiPeriod $period): bool
    {
        return $this->canManagePeriods($user);
    }

    public function approve(User $user, KpiPeriod $period): bool
    {
        return $this->canManagePeriods($user);
    }

    public function reject(User $user, KpiPeriod $period): bool
    {
        return $this->canManagePeriods($user);
    }

    public function delete(User $user, KpiPeriod $period): bool
    {
        return $this->canManagePeriods($user);
    }

    private function canManagePeriods(User $user): bool
    {
        return $this->isAdmin($user)
            || KpiAccessGrant::userHas($user->id, KpiAccessGrant::PERM_PERIODS);
    }

    private function isAdmin(User $user): bool
    {
        return in_array($this->role($user), ['admin', 'superadmin'], true)
            || KpiAccessGrant::userHasKpiAdmin($user->id);
    }

    private function role(User $user): string
    {
        return $user->resolvedRoleSlug();
    }
}

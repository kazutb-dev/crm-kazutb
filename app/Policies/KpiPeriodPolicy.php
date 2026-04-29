<?php

namespace App\Policies;

use App\Models\KpiPeriod;
use App\Models\User;

class KpiPeriodPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isAdmin($user) || $this->isReadOnlySuperadmin($user);
    }

    public function view(User $user, KpiPeriod $period): bool
    {
        return $this->isAdmin($user) || $this->isReadOnlySuperadmin($user);
    }

    public function create(User $user): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        return $this->isAdmin($user);
    }

    public function update(User $user, KpiPeriod $period): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        if ($period->status === KpiPeriod::STATUS_CLOSED) {
            return false;
        }

        return $this->isAdmin($user);
    }

    public function submit(User $user, KpiPeriod $period): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        return $this->isAdmin($user);
    }

    public function approve(User $user, KpiPeriod $period): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        return $this->isAdmin($user);
    }

    public function reject(User $user, KpiPeriod $period): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        return $this->isAdmin($user);
    }

    private function isReadOnlySuperadmin(User $user): bool
    {
        return $this->role($user) === 'superadmin';
    }

    private function isAdmin(User $user): bool
    {
        return $this->role($user) === 'admin';
    }

    private function role(User $user): string
    {
        return $user->resolvedRoleSlug();
    }
}

<?php

namespace App\Policies;

use App\Models\Announcement;
use App\Models\User;

class AnnouncementPolicy
{
    public function create(User $user): bool
    {
        return $this->canManageAnnouncements($user);
    }

    public function update(User $user, Announcement $announcement): bool
    {
        return $this->canManageAnnouncements($user);
    }

    public function delete(User $user, Announcement $announcement): bool
    {
        return $this->canManageAnnouncements($user);
    }

    private function canManageAnnouncements(User $user): bool
    {
        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true);
    }
}

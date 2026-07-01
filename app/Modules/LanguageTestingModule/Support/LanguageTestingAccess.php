<?php

namespace App\Modules\LanguageTestingModule\Support;

use App\Models\User;

class LanguageTestingAccess
{
    public static function canView(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return in_array($user->resolvedRoleSlug(), ['teacher', 'admin', 'superadmin', 'certificates'], true);
    }

    public static function canManage(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return in_array($user->resolvedRoleSlug(), ['admin', 'superadmin', 'certificates'], true);
    }
}
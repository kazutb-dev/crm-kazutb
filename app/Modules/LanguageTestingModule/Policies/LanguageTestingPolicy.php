<?php

namespace App\Modules\LanguageTestingModule\Policies;

use App\Models\User;
use App\Modules\LanguageTestingModule\Support\LanguageTestingAccess;

class LanguageTestingPolicy
{
    public function viewAny(User $user): bool
    {
        return LanguageTestingAccess::canView($user);
    }

    public function view(User $user): bool
    {
        return LanguageTestingAccess::canView($user);
    }

    public function create(User $user): bool
    {
        return LanguageTestingAccess::canManage($user);
    }

    public function update(User $user): bool
    {
        return LanguageTestingAccess::canManage($user);
    }

    public function delete(User $user): bool
    {
        return LanguageTestingAccess::canManage($user);
    }

    public function export(User $user): bool
    {
        return LanguageTestingAccess::canView($user);
    }
}
<?php

namespace App\Http\Controllers\Testing\Concerns;

use App\Models\Testing\TestingBinding;
use App\Models\Testing\TestingTest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

trait AuthorizesTestingAccess
{
    protected function ensureTestingUser(?User $user): void
    {
        if (! $user) {
            throw new AuthorizationException('Пользователь не авторизован.');
        }

        if (! in_array($user->resolvedRoleSlug(), ['teacher', 'admin', 'superadmin'], true)) {
            throw new AuthorizationException('Недостаточно прав для работы с модулем "Тестирование".');
        }
    }

    protected function ensureBindingAccess(User $user, TestingBinding $binding): void
    {
        $this->ensureTestingUser($user);

        if (in_array($user->resolvedRoleSlug(), ['admin', 'superadmin'], true)) {
            return;
        }

        if ((int) $binding->teacher_id !== (int) $user->id) {
            throw new AuthorizationException('Привязка предмета вам не принадлежит.');
        }
    }

    protected function ensureTestAccess(User $user, TestingTest $test): void
    {
        $this->ensureBindingAccess($user, $test->binding);
    }
}

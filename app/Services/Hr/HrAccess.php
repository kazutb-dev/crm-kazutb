<?php

namespace App\Services\Hr;

use App\Models\ScopedGrant;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Who may use the hiring module. The module is open to the `hr` role and administrators; rights are granted
 * per person (scoped_grants, grant_type `hr`, module `hr_hiring`):
 *  - hr.access — the module itself for a user of any other role (the role stays as it is);
 *  - hr.sensitive — open PDF scans (attachments, signed copies) and see the social status
 *    (pensioner, disability, student, large family);
 *  - hr.catalog — add units/positions to the catalog and confirm their case forms.
 * Administrators have all of them. Only administrators grant and revoke them. hr.sensitive and hr.catalog
 * work only for someone who can use the module (by role or by hr.access).
 */
class HrAccess
{
    public const MODULE = 'hr_hiring';

    public const SENSITIVE = 'hr.sensitive';

    public const CATALOG = 'hr.catalog';

    public const ACCESS = 'hr.access';

    public const CAPABILITIES = [
        self::ACCESS => 'Доступ к модулю',
        self::SENSITIVE => 'Сканы документов и социальный статус',
        self::CATALOG => 'Пополнение справочника и подтверждение падежных форм',
    ];

    private const MODULE_ROLES = ['hr', 'admin', 'superadmin'];

    private const ADMIN_ROLES = ['admin', 'superadmin'];

    public function canUseModule(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $this->hasModuleRole($user) || $this->hasGrant($user, self::ACCESS);
    }

    /** The role alone opens the module (hr, administrators); others need the hr.access right. */
    public function hasModuleRole(?User $user): bool
    {
        return $user !== null && in_array($user->resolvedRoleSlug(), self::MODULE_ROLES, true);
    }

    public function isAdmin(?User $user): bool
    {
        return $user !== null && in_array($user->resolvedRoleSlug(), self::ADMIN_ROLES, true);
    }

    public function canViewSensitive(?User $user): bool
    {
        return $this->has($user, self::SENSITIVE);
    }

    public function canManageCatalog(?User $user): bool
    {
        return $this->has($user, self::CATALOG);
    }

    /**
     * @return array{sensitive: bool, catalog: bool, rights: bool}
     */
    public function abilities(?User $user): array
    {
        return [
            'sensitive' => $this->canViewSensitive($user),
            'catalog' => $this->canManageCatalog($user),
            'rights' => $this->isAdmin($user),
        ];
    }

    public function grant(User $subject, string $capability, User $grantedBy): ScopedGrant
    {
        $existing = $this->activeGrants()->where('subject_user_id', $subject->id)->where('capability', $capability)->first();

        return $existing ?? ScopedGrant::query()->create([
            'subject_user_id' => $subject->id,
            'grant_type' => ScopedGrant::GRANT_TYPE_HR,
            'module' => self::MODULE,
            'capability' => $capability,
            'scope_type' => 'university',
            'starts_at' => now(),
            'status' => ScopedGrant::STATUS_ACTIVE,
            'granted_by' => $grantedBy->id,
            'approved_by' => $grantedBy->id,
            'reason' => 'Модуль «Приём на работу»',
        ]);
    }

    public function revoke(User $subject, string $capability): int
    {
        return $this->activeGrants()
            ->where('subject_user_id', $subject->id)
            ->where('capability', $capability)
            ->update(['status' => ScopedGrant::STATUS_REVOKED, 'revoked_at' => now(), 'updated_at' => now()]);
    }

    /**
     * Module users (role hr) and everyone holding a module right, with their rights.
     *
     * @return Collection<int, array{id: int, name: string, email: ?string, role: string, role_access: bool, rights: list<string>}>
     */
    public function members(): Collection
    {
        $grants = $this->activeGrants()->get(['subject_user_id', 'capability'])->groupBy('subject_user_id');

        return User::query()
            ->where(fn ($query) => $query->where('role', 'hr')->orWhereIn('id', $grants->keys()))
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'role_id'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => (string) $user->name,
                'email' => $user->email,
                'role' => $user->resolvedRoleSlug(),
                'role_access' => $this->hasModuleRole($user),
                'rights' => $grants->get($user->id, collect())->pluck('capability')->unique()->values()->all(),
            ]);
    }

    private function has(?User $user, string $capability): bool
    {
        if ($user === null || ! $this->canUseModule($user)) {
            return false;
        }
        if ($this->isAdmin($user)) {
            return true;
        }

        return $this->hasGrant($user, $capability);
    }

    private function hasGrant(User $user, string $capability): bool
    {
        return $this->activeGrants()
            ->where('subject_user_id', $user->id)
            ->where('capability', $capability)
            ->exists();
    }

    private function activeGrants()
    {
        return ScopedGrant::query()
            ->where('grant_type', ScopedGrant::GRANT_TYPE_HR)
            ->where('module', self::MODULE)
            ->where('status', ScopedGrant::STATUS_ACTIVE)
            ->whereNull('revoked_at')
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }
}

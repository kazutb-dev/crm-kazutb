<?php

namespace App\Policies;

use App\Models\KpiAccessGrant;
use App\Models\KpiEntry;
use App\Models\KpiPeriod;
use App\Models\User;
use App\Services\KpiAccessEvaluatorService;

class KpiEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return app(KpiAccessEvaluatorService::class)->evaluateModuleAccess($user)['allow'] ?? false;
    }

    public function view(User $user, KpiEntry $entry): bool
    {
        if (! ($this->canAccessModule($user) || $this->isAdmin($user))) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id;
        }

        if ($this->isDepartmentHead($user)) {
            $userDepartmentId = $this->userDepartmentId($user);
            $entryDepartmentId = $this->entryDepartmentId($entry);

            if ($entryDepartmentId === null && $this->isUnlinkedEntry($entry)) {
                return true;
            }

            return $userDepartmentId !== null
                && $entryDepartmentId !== null
                && $entryDepartmentId === $userDepartmentId;
        }

        if ($this->isDean($user)) {
            $userFacultyId = $this->userFacultyId($user);
            $entryFacultyId = $this->entryFacultyId($entry);

            if ($entryFacultyId === null && $this->isUnlinkedEntry($entry)) {
                return true;
            }

            return $userFacultyId !== null
                && $entryFacultyId !== null
                && $entryFacultyId === $userFacultyId;
        }

        if ($this->isStructuralDivisionUser($user)) {
            // Свои записи (entity_type=structural_division) + энтри ^ППС на финальной проверке
            if ((int) $entry->user_id === (int) $user->id) {
                return true;
            }

            return in_array($entry->status, [
                KpiEntry::STATUS_PENDING_STRUCTURAL,
                KpiEntry::STATUS_APPROVED,
                KpiEntry::STATUS_REJECTED,
            ], true);
        }

        return false;
    }

    public function create(User $user): bool
    {
        return $this->canAccessModule($user);
    }

    public function update(User $user, KpiEntry $entry): bool
    {
        if (! $this->canAccessModule($user) && ! $this->isAdmin($user)) {
            return false;
        }

        if (!$entry->canBeEdited()) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isEntryInClosedPeriod($entry)) {
            return false;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriodForUser($user, $entry);
        }

        if ($this->isDepartmentHead($user) || $this->isDean($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriodForUser($user, $entry);
        }

        if ($this->isStructuralDivisionUser($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriodForUser($user, $entry);
        }

        return false;
    }

    public function delete(User $user, KpiEntry $entry): bool
    {
        if (! $this->canAccessModule($user) && ! $this->isAdmin($user)) {
            return false;
        }

        if ($entry->isLocked()) {
            return false;
        }

        if ($entry->status === KpiEntry::STATUS_APPROVED) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isEntryInClosedPeriod($entry)) {
            return false;
        }

        if (
            $this->isTeacher($user)
            || $this->isDepartmentHead($user)
            || $this->isDean($user)
            || $this->isStructuralDivisionUser($user)
        ) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriodForUser($user, $entry);
        }

        return false;
    }

    public function submit(User $user, KpiEntry $entry): bool
    {
        if (! $this->canAccessModule($user) && ! $this->isAdmin($user)) {
            return false;
        }

        if (!$entry->canBeSubmitted()) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isEntryInClosedPeriod($entry)) {
            return false;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriodForUser($user, $entry);
        }

        if ($this->isDepartmentHead($user) || $this->isDean($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriodForUser($user, $entry);
        }

        if ($this->isStructuralDivisionUser($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriodForUser($user, $entry);
        }

        return false;
    }

    public function approve(User $user, KpiEntry $entry): bool
    {
        if ($entry->isLocked()) {
            return false;
        }

        if (!$this->isAdmin($user) && $this->isEntryInClosedPeriod($entry)) {
            return false;
        }

        // Остальная логика для других ролей без изменений
        if (
            ($this->hasQueueGrant($user, KpiAccessGrant::PERM_REVIEW_QUEUE)
                && $entry->status === KpiEntry::STATUS_SUBMITTED)
            || ($this->hasQueueGrant($user, KpiAccessGrant::PERM_APPROVAL_QUEUE)
                && in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true))
            || ($this->hasQueueGrant($user, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
                && $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL)
        ) {
            return $this->isEntryInScope($entry, $this->scopeForQueueAction($user, $entry));
        }

        if ($this->isAdmin($user)) {
            return in_array($entry->status, [
                KpiEntry::STATUS_SUBMITTED,
                KpiEntry::STATUS_REVIEWED,
                KpiEntry::STATUS_PENDING_DEAN,
                KpiEntry::STATUS_PENDING_STRUCTURAL,
            ], true);
        }

        // Зав. кафедрой: одобряет submitted → pending_dean
        if ($this->isDepartmentHead($user)) {
            if ($entry->status !== KpiEntry::STATUS_SUBMITTED) {
                return false;
            }

            $userDepartmentId = $this->userDepartmentId($user);
            $entryDepartmentId = $this->entryDepartmentId($entry);

            if ($entryDepartmentId === null && $this->isUnlinkedEntry($entry)) {
                return $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_HOD);
            }

            return $userDepartmentId !== null
                && $entryDepartmentId !== null
                && $entryDepartmentId === $userDepartmentId
                && $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_HOD);
        }

        // Декан: одобряет pending_dean → pending_structural
        if ($this->isDean($user)) {
            if (!in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
                return false;
            }

            $userFacultyId = $this->userFacultyId($user);
            $entryFacultyId = $this->entryFacultyId($entry);

            if ($entryFacultyId === null && $this->isUnlinkedEntry($entry)) {
                return $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_DEAN);
            }

            return $userFacultyId !== null
                && $entryFacultyId !== null
                && $entryFacultyId === $userFacultyId
                && $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_DEAN);
        }

        // Стр. подразделения: финально утверждают из pending_structural
        if ($this->isStructuralDivisionUser($user)) {
            return $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL
                && $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_STRUCTURAL);
        }

        return false;
    }

    public function review(User $user, KpiEntry $entry): bool
    {
        if ($entry->status !== KpiEntry::STATUS_SUBMITTED) {
            return false;
        }

        if (!$this->isAdmin($user) && $this->isEntryInClosedPeriod($entry)) {
            return false;
        }

        return $this->approve($user, $entry);
    }

    public function return(User $user, KpiEntry $entry): bool
    {
        $returnableStatuses = [
            KpiEntry::STATUS_SUBMITTED,
            KpiEntry::STATUS_REVIEWED,
            KpiEntry::STATUS_PENDING_DEAN,
        ];

        if (!$this->isAdmin($user) && $this->isEntryInClosedPeriod($entry)) {
            return false;
        }

        if (
            ($this->hasQueueGrant($user, KpiAccessGrant::PERM_REVIEW_QUEUE)
                && $entry->status === KpiEntry::STATUS_SUBMITTED)
            || ($this->hasQueueGrant($user, KpiAccessGrant::PERM_APPROVAL_QUEUE)
                && in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true))
        ) {
            return $this->isEntryInScope($entry, $this->scopeForQueueAction($user, $entry));
        }

        if ($this->isAdmin($user)) {
            return in_array($entry->status, $returnableStatuses, true);
        }

        // Зав. кафедрой: возвращает СП в submitted статусе
        if ($this->isDepartmentHead($user)) {
            if ($entry->status !== KpiEntry::STATUS_SUBMITTED) {
                return false;
            }

            $userDepartmentId = $this->userDepartmentId($user);
            $entryDepartmentId = $this->entryDepartmentId($entry);

            if ($entryDepartmentId === null && $this->isUnlinkedEntry($entry)) {
                return $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_HOD);
            }

            return $userDepartmentId !== null
                && $entryDepartmentId !== null
                && $entryDepartmentId === $userDepartmentId
                && $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_HOD);
        }

        // Декан: возвращает из pending_dean
        if ($this->isDean($user)) {
            if (!in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
                return false;
            }

            $userFacultyId = $this->userFacultyId($user);
            $entryFacultyId = $this->entryFacultyId($entry);

            if ($entryFacultyId === null && $this->isUnlinkedEntry($entry)) {
                return $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_DEAN);
            }

            return $userFacultyId !== null
                && $entryFacultyId !== null
                && $entryFacultyId === $userFacultyId
                && $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_DEAN);
        }

        // Стр. подразделения не возвращают, только approve/reject
        return false;
    }

    public function reject(User $user, KpiEntry $entry): bool
    {
        if ($entry->isLocked()) {
            return false;
        }

        if (!$this->isAdmin($user) && $this->isEntryInClosedPeriod($entry)) {
            return false;
        }

        if ($this->hasQueueGrant($user, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)) {
            return $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL
                && $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_STRUCTURAL);
        }

        if ($this->isAdmin($user)) {
            return in_array($entry->status, [
                KpiEntry::STATUS_SUBMITTED,
                KpiEntry::STATUS_REVIEWED,
                KpiEntry::STATUS_PENDING_DEAN,
                KpiEntry::STATUS_PENDING_STRUCTURAL,
            ], true);
        }

        // Только стр. подразделения могут финально отклонить
        if ($this->isStructuralDivisionUser($user)) {
            return $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL
                && $this->isEntryInScope($entry, KpiPeriod::ACCESS_SCOPE_STRUCTURAL);
        }

        return false;
    }

    public function structuralConfirm(User $user, KpiEntry $entry): bool
    {
        return $this->approve($user, $entry);
    }

    public function structuralReject(User $user, KpiEntry $entry): bool
    {
        return $this->reject($user, $entry);
    }

    private function hasAnyKpiGrant(User $user): bool
    {
        return KpiAccessGrant::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->exists();
    }

    private function canAccessModule(User $user): bool
    {
        return (bool) (app(KpiAccessEvaluatorService::class)->evaluateModuleAccess($user)['allow'] ?? false);
    }

    private function hasQueueGrant(User $user, string $permission): bool
    {
        return KpiAccessGrant::userHas($user->id, $permission);
    }

    private function isAdmin(User $user): bool
    {
        return in_array($this->role($user), ['admin', 'superadmin'], true)
            || KpiAccessGrant::userHasKpiAdmin($user->id);
    }

    private function isTeacher(User $user): bool
    {
        return $this->role($user) === 'teacher';
    }

    private function isDepartmentHead(User $user): bool
    {
        $role = $this->role($user);

        return $role === 'department_head' || $role === 'hod';
    }

    private function isDean(User $user): bool
    {
        return $this->role($user) === 'dean';
    }

    private function isStructuralDivisionUser(User $user): bool
    {
        return in_array($this->role($user), ['department', 'structural'], true);
    }

    private function role(User $user): string
    {
        return $user->resolvedRoleSlug();
    }

    private function isEntryInAccessiblePeriodForUser(User $user, KpiEntry $entry): bool
    {
        $entry->loadMissing('period');

        if ($entry->period?->status !== KpiPeriod::STATUS_ACTIVE) {
            return false;
        }

        $scope = KpiPeriod::scopeFromRoleSlug($this->role($user));

        if ($scope === null) {
            return false;
        }

        return $entry->period->isScopeActive($scope);
    }

    private function isEntryInScope(KpiEntry $entry, ?string $scope): bool
    {
        if ($scope === null) {
            return false;
        }

        $entry->loadMissing('period');

        if ($entry->period?->status !== KpiPeriod::STATUS_ACTIVE) {
            return false;
        }

        return $entry->period->isScopeActive($scope);
    }

    private function isEntryInClosedPeriod(KpiEntry $entry): bool
    {
        $entry->loadMissing('period');

        return $entry->period?->status === KpiPeriod::STATUS_CLOSED;
    }

    private function scopeForQueueAction(User $user, KpiEntry $entry): ?string
    {
        if (
            $this->hasQueueGrant($user, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)
            && $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL
        ) {
            return KpiPeriod::ACCESS_SCOPE_STRUCTURAL;
        }

        if (
            $this->hasQueueGrant($user, KpiAccessGrant::PERM_APPROVAL_QUEUE)
            && in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)
        ) {
            return KpiPeriod::ACCESS_SCOPE_DEAN;
        }

        if (
            $this->hasQueueGrant($user, KpiAccessGrant::PERM_REVIEW_QUEUE)
            && $entry->status === KpiEntry::STATUS_SUBMITTED
        ) {
            return KpiPeriod::ACCESS_SCOPE_HOD;
        }

        return null;
    }

    private function userDepartmentId(User $user): ?int
    {
        $departmentId = $user->department_id ?? null;

        if ($departmentId === null || $departmentId === '') {
            return null;
        }

        return (int) $departmentId;
    }

    private function userFacultyId(User $user): ?int
    {
        $facultyId = $user->faculty_id ?? null;

        if ($facultyId === null || $facultyId === '') {
            return null;
        }

        return (int) $facultyId;
    }

    private function entryDepartmentId(KpiEntry $entry): ?int
    {
        if ($entry->department_id !== null && $entry->department_id !== '') {
            return (int) $entry->department_id;
        }

        $entry->loadMissing('user:id,department_id');

        $userDepartmentId = $entry->user?->department_id;

        if ($userDepartmentId === null || $userDepartmentId === '') {
            return null;
        }

        return (int) $userDepartmentId;
    }

    private function entryFacultyId(KpiEntry $entry): ?int
    {
        if ($entry->faculty_id !== null && $entry->faculty_id !== '') {
            return (int) $entry->faculty_id;
        }

        $entry->loadMissing('user:id,faculty_id');

        $userFacultyId = $entry->user?->faculty_id;

        if ($userFacultyId === null || $userFacultyId === '') {
            return null;
        }

        return (int) $userFacultyId;
    }

    private function isUnlinkedEntry(KpiEntry $entry): bool
    {
        return $this->entryDepartmentId($entry) === null && $this->entryFacultyId($entry) === null;
    }
}

<?php

namespace App\Policies;

use App\Models\KpiAccessGrant;
use App\Models\KpiEntry;
use App\Models\User;

class KpiEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->isAdmin($user)
            || $this->isTeacher($user)
            || $this->isDepartmentHead($user)
            || $this->isDean($user)
            || $this->isStructuralDivisionUser($user)
            || $this->hasAnyKpiGrant($user);
    }

    public function view(User $user, KpiEntry $entry): bool
    {
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
        return $this->isAdmin($user)
            || $this->isTeacher($user)
            || $this->isDepartmentHead($user)
            || $this->isDean($user)
            || $this->isStructuralDivisionUser($user);
    }

    public function update(User $user, KpiEntry $entry): bool
    {
        if (!$entry->canBeEdited()) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id
                && ($this->isEntryInAccessiblePeriod($entry) || $this->canEditInClosedPeriod($entry));
        }

        if ($this->isDepartmentHead($user) || $this->isDean($user)) {
            return (int) $entry->user_id === (int) $user->id
                && ($this->isEntryInAccessiblePeriod($entry) || $this->canEditInClosedPeriod($entry));
        }

        if ($this->isStructuralDivisionUser($user)) {
            return (int) $entry->user_id === (int) $user->id
                && ($this->isEntryInAccessiblePeriod($entry) || $this->canEditInClosedPeriod($entry));
        }

        return false;
    }

    public function delete(User $user, KpiEntry $entry): bool
    {
        if ($entry->isLocked()) {
            return false;
        }

        if ($entry->status === KpiEntry::STATUS_APPROVED) {
            return false;
        }

        if (!$this->isEntryInAccessiblePeriod($entry)) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isTeacher($user)
            || $this->isDepartmentHead($user)
            || $this->isDean($user)
            || $this->isStructuralDivisionUser($user)) {
            return (int) $entry->user_id === (int) $user->id;
        }

        return false;
    }

    public function submit(User $user, KpiEntry $entry): bool
    {
        if (!$entry->canBeSubmitted()) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id
                && ($this->isEntryInAccessiblePeriod($entry) || $this->canEditInClosedPeriod($entry));
        }

        if ($this->isDepartmentHead($user) || $this->isDean($user)) {
            return (int) $entry->user_id === (int) $user->id
                && ($this->isEntryInAccessiblePeriod($entry) || $this->canEditInClosedPeriod($entry));
        }

        if ($this->isStructuralDivisionUser($user)) {
            return (int) $entry->user_id === (int) $user->id
                && ($this->isEntryInAccessiblePeriod($entry) || $this->canEditInClosedPeriod($entry));
        }

        return false;
    }

    public function approve(User $user, KpiEntry $entry): bool
    {
        if ($entry->isLocked()) {
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
            return true;
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
                return true;
            }

            return $userDepartmentId !== null
                && $entryDepartmentId !== null
                && $entryDepartmentId === $userDepartmentId;
        }

        // Декан: одобряет pending_dean → pending_structural
        if ($this->isDean($user)) {
            if (!in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
                return false;
            }

            $userFacultyId = $this->userFacultyId($user);
            $entryFacultyId = $this->entryFacultyId($entry);

            if ($entryFacultyId === null && $this->isUnlinkedEntry($entry)) {
                return true;
            }

            return $userFacultyId !== null
                && $entryFacultyId !== null
                && $entryFacultyId === $userFacultyId;
        }

        // Стр. подразделения: финально утверждают из pending_structural
        if ($this->isStructuralDivisionUser($user)) {
            return $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL;
        }

        return false;
    }

    public function review(User $user, KpiEntry $entry): bool
    {
        if ($entry->status !== KpiEntry::STATUS_SUBMITTED) {
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

        if (
            ($this->hasQueueGrant($user, KpiAccessGrant::PERM_REVIEW_QUEUE)
                && $entry->status === KpiEntry::STATUS_SUBMITTED)
            || ($this->hasQueueGrant($user, KpiAccessGrant::PERM_APPROVAL_QUEUE)
                && in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true))
        ) {
            return true;
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
                return true;
            }

            return $userDepartmentId !== null
                && $entryDepartmentId !== null
                && $entryDepartmentId === $userDepartmentId;
        }

        // Декан: возвращает из pending_dean
        if ($this->isDean($user)) {
            if (!in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
                return false;
            }

            $userFacultyId = $this->userFacultyId($user);
            $entryFacultyId = $this->entryFacultyId($entry);

            if ($entryFacultyId === null && $this->isUnlinkedEntry($entry)) {
                return true;
            }

            return $userFacultyId !== null
                && $entryFacultyId !== null
                && $entryFacultyId === $userFacultyId;
        }

        // Стр. подразделения не возвращают, только approve/reject
        return false;
    }

    public function reject(User $user, KpiEntry $entry): bool
    {
        if ($entry->isLocked()) {
            return false;
        }

        if ($this->hasQueueGrant($user, KpiAccessGrant::PERM_STRUCTURAL_QUEUE)) {
            return $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL;
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
            return $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL;
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

    private function isEntryInAccessiblePeriod(KpiEntry $entry): bool
    {
        $entry->loadMissing('period');

        return $entry->period?->isCurrentlyOpen() === true;
    }

    private function canEditInClosedPeriod(KpiEntry $entry): bool
    {
        return in_array($entry->status, [
            KpiEntry::STATUS_RETURNED,
            KpiEntry::STATUS_REJECTED,
        ], true);
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

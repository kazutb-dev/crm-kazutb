<?php

namespace App\Policies;

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
            || $this->isReadOnlySuperadmin($user);
    }

    public function view(User $user, KpiEntry $entry): bool
    {
        if ($this->isAdmin($user) || $this->isReadOnlySuperadmin($user)) {
            return true;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id;
        }

        if ($this->isDepartmentHead($user)) {
            $userDepartmentId = $this->userDepartmentId($user);

            return $userDepartmentId !== null
                && (int) $entry->department_id === $userDepartmentId;
        }

        if ($this->isDean($user)) {
            $userFacultyId = $this->userFacultyId($user);

            return $userFacultyId !== null
                && (int) $entry->faculty_id === $userFacultyId;
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
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        return $this->isAdmin($user) || $this->isTeacher($user) || $this->isStructuralDivisionUser($user);
    }

    public function update(User $user, KpiEntry $entry): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        if (!$entry->canBeEdited()) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriod($entry);
        }

        if ($this->isStructuralDivisionUser($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriod($entry);
        }

        return false;
    }

    public function submit(User $user, KpiEntry $entry): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        if (!$entry->canBeSubmitted()) {
            return false;
        }

        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isTeacher($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriod($entry);
        }

        if ($this->isStructuralDivisionUser($user)) {
            return (int) $entry->user_id === (int) $user->id
                && $this->isEntryInAccessiblePeriod($entry);
        }

        return false;
    }

    public function approve(User $user, KpiEntry $entry): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        if ($entry->isLocked()) {
            return false;
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

            return $userDepartmentId !== null
                && (int) $entry->department_id === $userDepartmentId;
        }

        // Декан: одобряет pending_dean → pending_structural
        if ($this->isDean($user)) {
            if (!in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
                return false;
            }

            $userFacultyId = $this->userFacultyId($user);

            return $userFacultyId !== null
                && (int) $entry->faculty_id === $userFacultyId;
        }

        // Стр. подразделения: финальное утверждение pending_structural → approved
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
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        $returnableStatuses = [
            KpiEntry::STATUS_SUBMITTED,
            KpiEntry::STATUS_REVIEWED,
            KpiEntry::STATUS_PENDING_DEAN,
        ];

        if ($this->isAdmin($user)) {
            return in_array($entry->status, $returnableStatuses, true);
        }

        // Зав. кафедрой: возвращает СП в submitted статусе
        if ($this->isDepartmentHead($user)) {
            if ($entry->status !== KpiEntry::STATUS_SUBMITTED) {
                return false;
            }

            $userDepartmentId = $this->userDepartmentId($user);

            return $userDepartmentId !== null
                && (int) $entry->department_id === $userDepartmentId;
        }

        // Декан: возвращает из pending_dean
        if ($this->isDean($user)) {
            if (!in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
                return false;
            }

            $userFacultyId = $this->userFacultyId($user);

            return $userFacultyId !== null
                && (int) $entry->faculty_id === $userFacultyId;
        }

        // Стр. подразделения не возвращают, только approve/reject
        return false;
    }

    public function reject(User $user, KpiEntry $entry): bool
    {
        if ($this->isReadOnlySuperadmin($user)) {
            return false;
        }

        if ($entry->isLocked()) {
            return false;
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

    private function isReadOnlySuperadmin(User $user): bool
    {
        return $this->role($user) === 'superadmin';
    }

    private function isAdmin(User $user): bool
    {
        return $this->role($user) === 'admin';
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
        return $this->role($user) === 'department';
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
}

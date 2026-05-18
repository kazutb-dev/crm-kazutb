<?php

namespace App\Services;

use App\Models\KpiEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class KpiEntryStructureHydrationService
{
    /**
     * @return array{updated:int, skipped_conflicts:int}
     */
    public function hydrateForUser(User $user, bool $dryRun = false, bool $rebindAll = false): array
    {
        $facultyId = $user->faculty_id !== null ? (int) $user->faculty_id : null;
        $departmentId = $user->department_id !== null ? (int) $user->department_id : null;

        if ($facultyId === null && $departmentId === null) {
            return ['updated' => 0, 'skipped_conflicts' => 0];
        }

        $updated = 0;
        $skippedConflicts = 0;

        KpiEntry::query()
            ->where('user_id', $user->id)
            ->when(
                ! $rebindAll,
                fn (Builder $q) => $q->where(function (Builder $inner): void {
                    $inner->whereNull('faculty_id')
                        ->orWhereNull('department_id');
                })
            )
            ->orderBy('id')
            ->chunkById(200, function ($entries) use ($facultyId, $departmentId, $dryRun, $rebindAll, &$updated, &$skippedConflicts): void {
                foreach ($entries as $entry) {
                    $targetFaculty = $rebindAll ? $facultyId : ($entry->faculty_id ?? $facultyId);
                    $targetDepartment = $rebindAll ? $departmentId : ($entry->department_id ?? $departmentId);

                    if ($targetFaculty === $entry->faculty_id && $targetDepartment === $entry->department_id) {
                        continue;
                    }

                    if ($this->hasBusinessKeyConflict($entry, $targetFaculty, $targetDepartment)) {
                        $skippedConflicts++;
                        continue;
                    }

                    if ($dryRun) {
                        $updated++;
                        continue;
                    }

                    $changes = [];

                    if ($rebindAll) {
                        $changes['faculty_id'] = $targetFaculty;
                        $changes['department_id'] = $targetDepartment;
                    } else {
                        if ($entry->faculty_id === null && $targetFaculty !== null) {
                            $changes['faculty_id'] = $targetFaculty;
                        }
                        if ($entry->department_id === null && $targetDepartment !== null) {
                            $changes['department_id'] = $targetDepartment;
                        }
                    }

                    if ($changes === []) {
                        continue;
                    }

                    KpiEntry::query()->whereKey($entry->id)->update($changes);
                    $updated++;
                }
            });

        return ['updated' => $updated, 'skipped_conflicts' => $skippedConflicts];
    }

    private function hasBusinessKeyConflict(KpiEntry $entry, ?int $facultyId, ?int $departmentId): bool
    {
        return KpiEntry::query()
            ->where('id', '!=', $entry->id)
            ->where('kpi_period_id', $entry->kpi_period_id)
            ->where('entity_type', $entry->entity_type)
            ->where('user_id', $entry->user_id)
            ->where('indicator_id', $entry->indicator_id)
            ->where(function (Builder $q) use ($facultyId): void {
                if ($facultyId === null) {
                    $q->whereNull('faculty_id');
                    return;
                }

                $q->where('faculty_id', $facultyId);
            })
            ->where(function (Builder $q) use ($departmentId): void {
                if ($departmentId === null) {
                    $q->whereNull('department_id');
                    return;
                }

                $q->where('department_id', $departmentId);
            })
            ->exists();
    }
}

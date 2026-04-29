<?php

namespace App\Services;

use App\Exceptions\Kpi\KpiEntryFileRequiredException;
use App\Exceptions\Kpi\KpiEntryStageException;
use App\Exceptions\Kpi\KpiEntryStatusException;
use App\Models\KpiEntry;
use App\Models\KpiIndicator;
use App\Models\KpiPeriod;
use App\Models\KpiStatusLog;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class KpiEntryService
{
    public function __construct(
        private readonly KpiCalculationService $calculationService,
    ) {
    }

    /**
     * @param array<int, array<string, mixed>> $entries
     */
    public function savePlan(User $user, KpiPeriod $period, array $entries): void
    {
        if ($period->stage !== KpiPeriod::STAGE_PLAN) {
            throw new KpiEntryStageException('Сохранять plan можно только в периоде со стадией plan.');
        }

        DB::transaction(function () use ($user, $period, $entries): void {
            $this->persistEntries($user, $period, $entries, 'plan');
        });
    }

    /**
     * @param array<int, array<string, mixed>> $entries
     */
    public function saveFact(User $user, KpiPeriod $period, array $entries): void
    {
        if ($period->stage !== KpiPeriod::STAGE_FACT) {
            throw new KpiEntryStageException('Сохранять fact можно только в периоде со стадией fact.');
        }

        DB::transaction(function () use ($user, $period, $entries): void {
            $this->persistEntries($user, $period, $entries, 'fact');
        });
    }

    public function submitEntries(User $user, KpiPeriod $period, string $entityType): void
    {
        DB::transaction(function () use ($user, $period, $entityType): void {
            $entries = KpiEntry::query()
                ->where('kpi_period_id', $period->id)
                ->where('academic_year_id', $period->academic_year_id)
                ->where('entity_type', $entityType)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->get();

            if ($entries->isEmpty()) {
                throw new KpiEntryStatusException('Не найдено записей для отправки.');
            }

            $now = Carbon::now();

            foreach ($entries as $entry) {
                if (!$entry->canBeSubmitted()) {
                    throw new KpiEntryStatusException("Запись #{$entry->id} нельзя отправить в текущем статусе.");
                }

                $fromStatus = $entry->status;

                if ($entry->entity_type === KpiEntry::ENTITY_TYPE_TEACHER) {
                    [$resolvedFacultyId, $resolvedDepartmentId] = $this->resolveOrgScopeForEntity(
                        $user,
                        (string) $entry->entity_type,
                        $entry->faculty_id !== null ? (int) $entry->faculty_id : null,
                        $entry->department_id !== null ? (int) $entry->department_id : null,
                    );

                    $entry->faculty_id = $resolvedFacultyId;
                    $entry->department_id = $resolvedDepartmentId;
                }

                $entry->status = KpiEntry::STATUS_SUBMITTED;
                $entry->submitted_at = $now;
                $entry->save();

                $this->logStatusChange(
                    $entry,
                    $fromStatus,
                    KpiEntry::STATUS_SUBMITTED,
                    KpiStatusLog::ACTION_SUBMIT,
                    null,
                    $user->id,
                );
            }
        });
    }

    public function returnEntry(KpiEntry $entry, User $actor, ?string $comment = null): KpiEntry
    {
        return DB::transaction(function () use ($entry, $actor, $comment): KpiEntry {
            /** @var KpiEntry $lockedEntry */
            $lockedEntry = KpiEntry::query()->lockForUpdate()->findOrFail($entry->id);

            if ($lockedEntry->isLocked() || $lockedEntry->status === KpiEntry::STATUS_APPROVED) {
                throw new KpiEntryStatusException('Нельзя вернуть locked/approved запись.');
            }

            $returnableStatuses = [
                KpiEntry::STATUS_SUBMITTED,
                KpiEntry::STATUS_REVIEWED,
                KpiEntry::STATUS_PENDING_DEAN,
            ];

            if (!in_array($lockedEntry->status, $returnableStatuses, true)) {
                throw new KpiEntryStatusException('Вернуть можно только запись со статусом submitted, reviewed или pending_dean.');
            }

            $fromStatus = $lockedEntry->status;

            $lockedEntry->status = KpiEntry::STATUS_RETURNED;
            $lockedEntry->save();

            $this->logStatusChange(
                $lockedEntry,
                $fromStatus,
                KpiEntry::STATUS_RETURNED,
                KpiStatusLog::ACTION_RETURN,
                $comment,
                $actor->id,
            );

            return $lockedEntry->refresh();
        });
    }

    public function reviewEntry(KpiEntry $entry, User $actor, ?string $comment = null): KpiEntry
    {
        return DB::transaction(function () use ($entry, $actor, $comment): KpiEntry {
            /** @var KpiEntry $lockedEntry */
            $lockedEntry = KpiEntry::query()
                ->with(['period', 'indicator'])
                ->lockForUpdate()
                ->findOrFail($entry->id);

            if ($lockedEntry->isLocked() || $lockedEntry->status === KpiEntry::STATUS_APPROVED) {
                throw new KpiEntryStatusException('Нельзя отправить в review locked/approved запись.');
            }

            if ($lockedEntry->status !== KpiEntry::STATUS_SUBMITTED) {
                throw new KpiEntryStatusException('В review можно перевести только запись со статусом submitted.');
            }

            $this->assertFactFileAttachedForConfirmation($lockedEntry);

            $fromStatus = $lockedEntry->status;

            $lockedEntry->status = KpiEntry::STATUS_REVIEWED;
            $lockedEntry->reviewed_at = Carbon::now();
            $lockedEntry->save();

            $this->logStatusChange(
                $lockedEntry,
                $fromStatus,
                KpiEntry::STATUS_REVIEWED,
                KpiStatusLog::ACTION_REVIEW,
                $comment,
                $actor->id,
            );

            return $lockedEntry->refresh();
        });
    }

    public function approveEntry(KpiEntry $entry, User $actor, ?string $comment = null): KpiEntry
    {
        return DB::transaction(function () use ($entry, $actor, $comment): KpiEntry {
            /** @var KpiEntry $lockedEntry */
            $lockedEntry = KpiEntry::query()
                ->with(['period', 'indicator'])
                ->lockForUpdate()
                ->findOrFail($entry->id);

            if ($lockedEntry->isLocked()) {
                throw new KpiEntryStatusException('Нельзя утвердить запись со статусом locked.');
            }

            if (!$lockedEntry->canBeApproved()) {
                throw new KpiEntryStatusException('Утвердить можно только запись в промежуточном статусе.');
            }

            $this->assertFactFileAttachedForConfirmation($lockedEntry);

            $fromStatus = $lockedEntry->status;
            $role = $actor->resolvedRoleSlug();
            $nextStatus = $this->resolveNextApprovalStatus($lockedEntry, $role);

            $lockedEntry->status = $nextStatus;
            if ($nextStatus === KpiEntry::STATUS_APPROVED) {
                $lockedEntry->approved_at = Carbon::now();
                $this->applyCalculatedPointsOnFinalApproval($lockedEntry);
            } elseif (in_array($fromStatus, [KpiEntry::STATUS_SUBMITTED], true)) {
                $lockedEntry->reviewed_at = Carbon::now();
            }
            $lockedEntry->save();

            if ($nextStatus === KpiEntry::STATUS_APPROVED) {
                $this->calculationService->calculateForUser(
                    (int) $lockedEntry->user_id,
                    (int) $lockedEntry->kpi_period_id,
                    [
                        'entity_type' => (string) $lockedEntry->entity_type,
                        'faculty_id' => $lockedEntry->faculty_id,
                        'department_id' => $lockedEntry->department_id,
                        'metadata' => [
                            'trigger' => 'final_approval',
                            'entry_id' => $lockedEntry->id,
                        ],
                    ],
                );
            }

            $this->logStatusChange(
                $lockedEntry,
                $fromStatus,
                $nextStatus,
                KpiStatusLog::ACTION_APPROVE,
                $comment,
                $actor->id,
            );

            return $lockedEntry->refresh();
        });
    }

    private function resolveNextApprovalStatus(KpiEntry $entry, string $role): string
    {
        // Admin follows the same chain based on current entry status
        if ($role === 'admin') {
            if ($entry->status === KpiEntry::STATUS_SUBMITTED) {
                return KpiEntry::STATUS_PENDING_DEAN;
            }
            if (in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
                return KpiEntry::STATUS_PENDING_STRUCTURAL;
            }
            if ($entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL) {
                return KpiEntry::STATUS_APPROVED;
            }
        }

        if (in_array($role, ['department_head', 'hod'], true) && $entry->status === KpiEntry::STATUS_SUBMITTED) {
            return KpiEntry::STATUS_PENDING_DEAN;
        }

        if ($role === 'dean' && in_array($entry->status, [KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_REVIEWED], true)) {
            return KpiEntry::STATUS_PENDING_STRUCTURAL;
        }

        if ($role === 'department' && $entry->status === KpiEntry::STATUS_PENDING_STRUCTURAL) {
            return KpiEntry::STATUS_APPROVED;
        }

        throw new KpiEntryStatusException(
            "Невозможно утвердить запись со статусом {$entry->status} для роли {$role}."
        );
    }

    public function rejectEntry(KpiEntry $entry, User $actor, ?string $comment = null): KpiEntry
    {
        return DB::transaction(function () use ($entry, $actor, $comment): KpiEntry {
            /** @var KpiEntry $lockedEntry */
            $lockedEntry = KpiEntry::query()->lockForUpdate()->findOrFail($entry->id);

            if ($lockedEntry->isLocked()) {
                throw new KpiEntryStatusException('Нельзя отклонить запись со статусом locked.');
            }

            $role = $actor->resolvedRoleSlug();

            if ($role === 'admin') {
                $validStatuses = [
                    KpiEntry::STATUS_SUBMITTED, KpiEntry::STATUS_REVIEWED,
                    KpiEntry::STATUS_PENDING_DEAN, KpiEntry::STATUS_PENDING_STRUCTURAL,
                ];
                if (!in_array($lockedEntry->status, $validStatuses, true)) {
                    throw new KpiEntryStatusException('Отклонить можно только запись в промежуточном статусе.');
                }
            } elseif ($role === 'department') {
                // Структурные подразделения могут окончательно отклонить только из pending_structural
                if ($lockedEntry->status !== KpiEntry::STATUS_PENDING_STRUCTURAL) {
                    throw new KpiEntryStatusException('Можно отклонить только запись со статусом pending_structural.');
                }
            } else {
                throw new KpiEntryStatusException('Для возврата записи на доработку используйте действие «Вернуть».');
            }

            $fromStatus = $lockedEntry->status;
            $lockedEntry->status = KpiEntry::STATUS_REJECTED;
            $lockedEntry->save();

            $this->logStatusChange(
                $lockedEntry,
                $fromStatus,
                KpiEntry::STATUS_REJECTED,
                KpiStatusLog::ACTION_REJECT,
                $comment,
                $actor->id,
            );

            return $lockedEntry->refresh();
        });
    }

    /**
     * @param array<int, array<string, mixed>> $entries
     */
    private function persistEntries(User $user, KpiPeriod $period, array $entries, string $mode): void
    {
        if ($entries === []) {
            return;
        }

        $indicatorIds = collect($entries)
            ->pluck('indicator_id')
            ->filter()
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        /** @var Collection<int, KpiIndicator> $indicators */
        $indicators = KpiIndicator::query()
            ->whereIn('id', $indicatorIds)
            ->get()
            ->keyBy('id');

        $existingEntries = KpiEntry::query()
            ->where('kpi_period_id', $period->id)
            ->where('academic_year_id', $period->academic_year_id)
            ->where('user_id', $user->id)
            ->whereIn('indicator_id', $indicatorIds)
            ->lockForUpdate()
            ->get()
            ->keyBy(fn (KpiEntry $entry) => $this->entryBusinessKey(
                (string) $entry->entity_type,
                (int) $entry->indicator_id,
                $entry->faculty_id !== null ? (int) $entry->faculty_id : null,
                $entry->department_id !== null ? (int) $entry->department_id : null,
            ));

        foreach ($entries as $row) {
            $indicatorId = (int) ($row['indicator_id'] ?? 0);
            $entityType = (string) ($row['entity_type'] ?? '');
            $facultyId = isset($row['faculty_id']) && $row['faculty_id'] !== '' ? (int) $row['faculty_id'] : null;
            $departmentId = isset($row['department_id']) && $row['department_id'] !== '' ? (int) $row['department_id'] : null;

            [$facultyId, $departmentId] = $this->resolveOrgScopeForEntity($user, $entityType, $facultyId, $departmentId);

            /** @var KpiIndicator|null $indicator */
            $indicator = $indicators->get($indicatorId);

            if (!$indicator) {
                throw new KpiEntryStatusException("Индикатор #{$indicatorId} не найден.");
            }

            if ($indicator->entity_type !== $entityType) {
                throw new KpiEntryStatusException("Индикатор #{$indicatorId} не соответствует entity_type {$entityType}.");
            }

            $businessKey = $this->entryBusinessKey($entityType, $indicatorId, $facultyId, $departmentId);
            $existing = $existingEntries->get($businessKey);

            if ($existing && !$existing->canBeEdited()) {
                throw new KpiEntryStatusException("Запись #{$existing->id} со статусом {$existing->status} нельзя редактировать.");
            }

            $basePayload = [
                'kpi_period_id' => $period->id,
                'academic_year_id' => $period->academic_year_id,
                'entity_type' => $entityType,
                'user_id' => $user->id,
                'faculty_id' => $facultyId,
                'department_id' => $departmentId,
                'indicator_id' => $indicatorId,
                'manual_points' => $this->nullableDecimal($row['manual_points'] ?? null),
                'comment' => $row['comment'] ?? null,
            ];

            if ($mode === 'plan') {
                $basePayload['plan_value'] = $this->nullableDecimal($row['plan_value'] ?? null);
            }

            if ($mode === 'fact') {
                $basePayload['fact_value'] = $this->nullableDecimal($row['fact_value'] ?? null);
            }

            if ($existing) {
                $existing->fill($basePayload);
                $existing->save();
                continue;
            }

            KpiEntry::query()->create([
                ...$basePayload,
                'status' => KpiEntry::STATUS_DRAFT,
            ]);
        }
    }

    private function assertFactFileAttachedForConfirmation(KpiEntry $entry): void
    {
        $entry->loadMissing(['period', 'indicator']);

        if ($entry->period?->stage !== KpiPeriod::STAGE_FACT) {
            return;
        }

        if ($entry->indicator?->requiresFile() !== true) {
            return;
        }

        $hasFiles = $entry->files()->exists();

        if (!$hasFiles) {
            throw new KpiEntryFileRequiredException(
                "Для записи #{$entry->id} требуется подтверждающий файл перед review/approve."
            );
        }
    }

    private function logStatusChange(
        KpiEntry $entry,
        ?string $fromStatus,
        string $toStatus,
        string $action,
        ?string $comment,
        int $actorId,
    ): void {
        KpiStatusLog::query()->create([
            'kpi_entry_id' => $entry->id,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'action' => $action,
            'comment' => $comment,
            'acted_by' => $actorId,
        ]);
    }

    private function applyCalculatedPointsOnFinalApproval(KpiEntry $entry): void
    {
        if ($entry->manual_points !== null) {
            return;
        }

        $entry->loadMissing('indicator:id,base_points');

        $basePoints = (float) ($entry->indicator?->base_points ?? 0);
        $factValue = (float) ($entry->fact_value ?? 0);

        $entry->calculated_points = number_format($basePoints * $factValue, 2, '.', '');
    }

    private function entryBusinessKey(string $entityType, int $indicatorId, ?int $facultyId, ?int $departmentId): string
    {
        return implode('|', [
            $entityType,
            $indicatorId,
            $facultyId ?? 0,
            $departmentId ?? 0,
        ]);
    }

    private function nullableDecimal(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }

    /**
     * @return array{0: ?int, 1: ?int}
     */
    private function resolveOrgScopeForEntity(User $user, string $entityType, ?int $facultyId, ?int $departmentId): array
    {
        if ($entityType !== KpiEntry::ENTITY_TYPE_TEACHER) {
            return [$facultyId, $departmentId];
        }

        $resolvedFacultyId = $facultyId;
        $resolvedDepartmentId = $departmentId;

        if ($resolvedDepartmentId === null && $user->department_id !== null && $user->department_id !== '') {
            $resolvedDepartmentId = (int) $user->department_id;
        }

        if ($resolvedFacultyId === null && $user->faculty_id !== null && $user->faculty_id !== '') {
            $resolvedFacultyId = (int) $user->faculty_id;
        }

        // Если faculty_id всё ещё не задан — берём из кафедры пользователя
        if ($resolvedFacultyId === null && $resolvedDepartmentId !== null) {
            $dept = \App\Models\Department::find($resolvedDepartmentId, ['id', 'faculty_id']);
            if ($dept?->faculty_id !== null) {
                $resolvedFacultyId = (int) $dept->faculty_id;
            }
        }

        return [$resolvedFacultyId, $resolvedDepartmentId];
    }
}

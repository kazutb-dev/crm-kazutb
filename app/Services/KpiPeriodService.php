<?php

namespace App\Services;

use App\Exceptions\Kpi\KpiPeriodClosedException;
use App\Exceptions\Kpi\KpiPeriodConflictException;
use App\Exceptions\Kpi\KpiPeriodDateRangeException;
use App\Models\AcademicYear;
use App\Models\KpiPeriod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class KpiPeriodService
{
    public function create(array $data): KpiPeriod
    {
        return DB::transaction(function () use ($data): KpiPeriod {
            $payload = $this->normalizePayload($data);

            $this->assertDatesWithinAcademicYear(
                (int) $payload['academic_year_id'],
                (string) $payload['start_date'],
                (string) $payload['end_date'],
            );

            if (($payload['status'] ?? KpiPeriod::STATUS_DRAFT) === KpiPeriod::STATUS_ACTIVE) {
                $this->assertNoActiveConflict(
                    (int) $payload['academic_year_id'],
                    (string) $payload['stage'],
                );
            }

            $this->assertUniquePeriodNameInAcademicYear(
                (int) $payload['academic_year_id'],
                (string) $payload['name'],
            );

            return KpiPeriod::query()->create($payload);
        });
    }

    public function update(KpiPeriod $period, array $data): KpiPeriod
    {
        return DB::transaction(function () use ($period, $data): KpiPeriod {
            /** @var KpiPeriod $lockedPeriod */
            $lockedPeriod = KpiPeriod::query()->lockForUpdate()->findOrFail($period->id);

            if ($lockedPeriod->status === KpiPeriod::STATUS_CLOSED) {
                throw new KpiPeriodClosedException('Закрытый KPI-период нельзя редактировать.');
            }

            $payload = $this->normalizePayload($data, $lockedPeriod);

            $this->assertDatesWithinAcademicYear(
                (int) $payload['academic_year_id'],
                (string) $payload['start_date'],
                (string) $payload['end_date'],
            );

            if (($payload['status'] ?? $lockedPeriod->status) === KpiPeriod::STATUS_ACTIVE) {
                $this->assertNoActiveConflict(
                    (int) $payload['academic_year_id'],
                    (string) $payload['stage'],
                    $lockedPeriod->id,
                );
            }

            $this->assertUniquePeriodNameInAcademicYear(
                (int) $payload['academic_year_id'],
                (string) $payload['name'],
                $lockedPeriod->id,
            );

            $lockedPeriod->fill($payload);
            $lockedPeriod->save();

            return $lockedPeriod->refresh();
        });
    }

    public function activate(KpiPeriod $period): KpiPeriod
    {
        return DB::transaction(function () use ($period): KpiPeriod {
            /** @var KpiPeriod $lockedPeriod */
            $lockedPeriod = KpiPeriod::query()->lockForUpdate()->findOrFail($period->id);

            if ($lockedPeriod->status === KpiPeriod::STATUS_CLOSED) {
                throw new KpiPeriodClosedException('Закрытый KPI-период нельзя активировать повторно.');
            }

            $this->assertDatesWithinAcademicYear(
                (int) $lockedPeriod->academic_year_id,
                (string) $lockedPeriod->start_date,
                (string) $lockedPeriod->end_date,
            );

            // Safer strategy: block activation if another active period exists for same stage/year.
            $this->assertNoActiveConflict(
                (int) $lockedPeriod->academic_year_id,
                (string) $lockedPeriod->stage,
                $lockedPeriod->id,
            );

            $lockedPeriod->status = KpiPeriod::STATUS_ACTIVE;
            $lockedPeriod->save();

            return $lockedPeriod->refresh();
        });
    }

    public function close(KpiPeriod $period): KpiPeriod
    {
        return DB::transaction(function () use ($period): KpiPeriod {
            /** @var KpiPeriod $lockedPeriod */
            $lockedPeriod = KpiPeriod::query()->lockForUpdate()->findOrFail($period->id);

            if ($lockedPeriod->status === KpiPeriod::STATUS_CLOSED) {
                return $lockedPeriod;
            }

            $lockedPeriod->status = KpiPeriod::STATUS_CLOSED;
            $lockedPeriod->save();

            return $lockedPeriod->refresh();
        });
    }

    public function deactivate(KpiPeriod $period): KpiPeriod
    {
        return DB::transaction(function () use ($period): KpiPeriod {
            /** @var KpiPeriod $lockedPeriod */
            $lockedPeriod = KpiPeriod::query()->lockForUpdate()->findOrFail($period->id);

            if ($lockedPeriod->status === KpiPeriod::STATUS_CLOSED) {
                throw new KpiPeriodClosedException('Закрытый KPI-период нельзя деактивировать.');
            }

            $lockedPeriod->status = KpiPeriod::STATUS_DRAFT;
            $lockedPeriod->save();

            return $lockedPeriod->refresh();
        });
    }

    public function getCurrentOpenPeriod(string $stage, ?int $academicYearId = null): ?KpiPeriod
    {
        // Date range is no longer a gate — active status alone opens the period for entries.
        $query = KpiPeriod::query()
            ->where('stage', $stage)
            ->where('status', KpiPeriod::STATUS_ACTIVE)
            ->orderByDesc('academic_year_id');

        if ($academicYearId !== null) {
            $query->where('academic_year_id', $academicYearId);
        }

        return $query->first();
    }

    private function assertNoActiveConflict(int $academicYearId, string $stage, ?int $ignorePeriodId = null): void
    {
        $query = KpiPeriod::query()
            ->lockForUpdate()
            ->where('academic_year_id', $academicYearId)
            ->where('stage', $stage)
            ->where('status', KpiPeriod::STATUS_ACTIVE);

        if ($ignorePeriodId !== null) {
            $query->whereKeyNot($ignorePeriodId);
        }

        if ($query->exists()) {
            throw new KpiPeriodConflictException(
                'Нельзя активировать период: уже существует активный период этого этапа в выбранном учебном году.'
            );
        }
    }

    private function assertDatesWithinAcademicYear(int $academicYearId, string $startDate, string $endDate): void
    {
        $academicYear = AcademicYear::query()->find($academicYearId);

        if (!$academicYear) {
            throw new KpiPeriodDateRangeException('Учебный год для KPI-периода не найден.');
        }

        $periodStart = Carbon::parse($startDate)->startOfDay();
        $periodEnd = Carbon::parse($endDate)->endOfDay();

        if ($periodEnd->lt($periodStart)) {
            throw new KpiPeriodDateRangeException('Дата окончания KPI-периода не может быть раньше даты начала.');
        }

        // Project stores academic year as numeric year bounds.
        $yearStart = Carbon::create((int) $academicYear->start_year, 1, 1)->startOfDay();
        $yearEnd = Carbon::create((int) $academicYear->end_year, 12, 31)->endOfDay();

        if ($periodStart->lt($yearStart) || $periodEnd->gt($yearEnd)) {
            throw new KpiPeriodDateRangeException(
                sprintf(
                    'Даты KPI-периода должны быть в диапазоне учебного года (%s - %s).',
                    $yearStart->format('d.m.Y'),
                    $yearEnd->format('d.m.Y')
                )
            );
        }
    }

    private function assertUniquePeriodNameInAcademicYear(
        int $academicYearId,
        string $name,
        ?int $ignorePeriodId = null,
    ): void {
        $query = KpiPeriod::query()
            ->lockForUpdate()
            ->where('academic_year_id', $academicYearId)
            ->where('name', trim($name));

        if ($ignorePeriodId !== null) {
            $query->whereKeyNot($ignorePeriodId);
        }

        if ($query->exists()) {
            throw new KpiPeriodConflictException(
                'Период с таким названием уже существует в выбранном учебном году.'
            );
        }
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function normalizePayload(array $data, ?KpiPeriod $period = null): array
    {
        $status = $data['status'] ?? $period?->status ?? KpiPeriod::STATUS_DRAFT;
        $academicYearId = (int) ($data['academic_year_id'] ?? $period?->academic_year_id);
        $stage = (string) ($data['stage'] ?? $period?->stage);

        $rawName = trim((string) ($data['name'] ?? $period?->name ?? ''));
        $name = $rawName !== '' ? $rawName : $this->generateSeasonName($academicYearId, $stage);

        return [
            'academic_year_id' => $academicYearId,
            'name' => $name,
            'stage' => $stage,
            'start_date' => (string) ($data['start_date'] ?? $period?->start_date),
            'end_date' => (string) ($data['end_date'] ?? $period?->end_date),
            'status' => (string) $status,
            'description' => $data['description'] ?? $period?->description,
            'created_by' => $data['created_by'] ?? $period?->created_by,
            'updated_by' => $data['updated_by'] ?? $period?->updated_by,
        ];
    }

    private function generateSeasonName(int $academicYearId, string $stage): string
    {
        $year = AcademicYear::query()->find($academicYearId, ['name', 'start_year', 'end_year']);
        $yearLabel = $year?->name ?? ($year ? ($year->start_year . '/' . $year->end_year) : (string) $academicYearId);

        $stageLabels = [
            KpiPeriod::STAGE_PLAN => 'План',
            KpiPeriod::STAGE_FACT => 'Факт',
            KpiPeriod::STAGE_REVIEW => 'Рассмотрение',
        ];

        return $yearLabel . ' · ' . ($stageLabels[$stage] ?? $stage);
    }
}

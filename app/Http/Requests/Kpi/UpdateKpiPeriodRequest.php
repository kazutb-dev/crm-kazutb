<?php

namespace App\Http\Requests\Kpi;

use App\Models\AcademicYear;
use App\Models\KpiPeriod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateKpiPeriodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'stage' => ['required', 'string', Rule::in([
                KpiPeriod::STAGE_PLAN,
                KpiPeriod::STAGE_FACT,
                KpiPeriod::STAGE_REVIEW,
            ])],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'status' => ['required', 'string', Rule::in([
                KpiPeriod::STATUS_DRAFT,
                KpiPeriod::STATUS_ACTIVE,
                KpiPeriod::STATUS_CLOSED,
            ])],
            'description' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $academicYearId = (int) $this->input('academic_year_id');
            $stage = (string) $this->input('stage');
            $status = (string) $this->input('status');
            $startDate = (string) $this->input('start_date');
            $endDate = (string) $this->input('end_date');

            /** @var KpiPeriod|null $period */
            $period = $this->route('period') ?? $this->route('kpi_period') ?? $this->route('kpiPeriod');

            $academicYear = AcademicYear::query()->find($academicYearId);

            if (!$academicYear) {
                return;
            }

            $yearStart = Carbon::create((int) $academicYear->start_year, 1, 1)->startOfDay();
            $yearEnd = Carbon::create((int) $academicYear->end_year, 12, 31)->endOfDay();

            $periodStart = Carbon::parse($startDate)->startOfDay();
            $periodEnd = Carbon::parse($endDate)->endOfDay();

            if ($periodStart->lt($yearStart) || $periodEnd->gt($yearEnd)) {
                $validator->errors()->add(
                    'start_date',
                    sprintf(
                        'Даты KPI-периода должны быть в рамках учебного года (%s - %s).',
                        $yearStart->format('d.m.Y'),
                        $yearEnd->format('d.m.Y')
                    )
                );
            }

            if ($status === KpiPeriod::STATUS_ACTIVE) {
                $conflictQuery = KpiPeriod::query()
                    ->where('academic_year_id', $academicYearId)
                    ->where('stage', $stage)
                    ->where('status', KpiPeriod::STATUS_ACTIVE);

                if ($period instanceof KpiPeriod) {
                    $conflictQuery->whereKeyNot($period->id);
                }

                if ($conflictQuery->exists()) {
                    $validator->errors()->add(
                        'status',
                        'В выбранном учебном году уже есть активный период для этого этапа.'
                    );
                }
            }

            $periodName = trim((string) $this->input('name', ''));
            if ($periodName !== '') {
                $duplicateNameQuery = KpiPeriod::query()
                    ->where('academic_year_id', $academicYearId)
                    ->where('name', $periodName);

                if ($period instanceof KpiPeriod) {
                    $duplicateNameQuery->whereKeyNot($period->id);
                }

                if ($duplicateNameQuery->exists()) {
                    $validator->errors()->add(
                        'name',
                        'Период с таким названием уже существует в выбранном учебном году.'
                    );
                }
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'academic_year_id.required' => 'Выберите учебный год.',
            'academic_year_id.integer' => 'Некорректный идентификатор учебного года.',
            'academic_year_id.exists' => 'Выбранный учебный год не найден.',

            'name.required' => 'Введите название периода.',
            'name.string' => 'Название периода должно быть строкой.',
            'name.max' => 'Название периода не должно превышать 255 символов.',

            'stage.required' => 'Выберите этап KPI-периода.',
            'stage.string' => 'Этап KPI-периода указан некорректно.',
            'stage.in' => 'Допустимые этапы: plan, fact, review.',

            'start_date.required' => 'Укажите дату начала периода.',
            'start_date.date' => 'Дата начала периода указана некорректно.',

            'end_date.required' => 'Укажите дату окончания периода.',
            'end_date.date' => 'Дата окончания периода указана некорректно.',
            'end_date.after_or_equal' => 'Дата окончания не может быть раньше даты начала.',

            'status.required' => 'Укажите статус периода.',
            'status.string' => 'Статус периода указан некорректно.',
            'status.in' => 'Допустимые статусы: draft, active, closed.',

            'description.string' => 'Описание должно быть строкой.',
        ];
    }
}

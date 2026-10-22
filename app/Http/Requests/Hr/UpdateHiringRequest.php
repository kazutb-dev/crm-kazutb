<?php

namespace App\Http\Requests\Hr;

use App\Models\HrEmployee;
use App\Models\HrEmployeeEducation;
use App\Models\HrEmploymentContract;
use App\Models\HrHiring;
use App\Models\Position;
use App\Services\Hr\HrDates;
use App\Services\Hr\Iin;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Wizard save. Every field is optional (a draft may be incomplete); what is filled must be well-formed.
 */
class UpdateHiringRequest extends FormRequest
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
        /** @var HrHiring $hiring */
        $hiring = $this->route('hiring');
        $text = fn (int $max) => ['nullable', 'string', 'max:'.$max];
        $form = ['nullable', 'string', 'max:255'];

        return [
            'employee' => ['sometimes', 'array'],
            'employee.last_name' => $text(100),
            'employee.first_name' => $text(100),
            'employee.middle_name' => $text(100),
            'employee.iin' => ['nullable', 'string', function (string $attribute, mixed $value, Closure $fail) use ($hiring): void {
                $iin = Iin::parse((string) $value);
                if (! $iin->valid) {
                    $fail($iin->error);

                    return;
                }
                $other = HrEmployee::query()->where('iin_hash', HrEmployee::hashIin($value))->whereKeyNot($hiring->employee_id)->first();
                if ($other !== null) {
                    $hiringId = $other->hirings()->orderByDesc('id')->value('id');
                    $fail('Сотрудник с этим ИИН уже есть в модуле'.($hiringId ? " (приём #{$hiringId})" : '').'. Новый приём оформляется из его карточки.');
                }
            }],
            'employee.birth_date' => ['nullable', 'date'],
            'employee.gender' => ['nullable', Rule::in([Iin::GENDER_MALE, Iin::GENDER_FEMALE])],
            'employee.citizenship' => ['nullable', Rule::in([HrEmployee::CITIZENSHIP_KZ, HrEmployee::CITIZENSHIP_OTHER])],
            'employee.citizenship_ru' => $form,
            'employee.citizenship_kz' => $form,
            'employee.id_card_number' => $text(20),
            'employee.id_card_issued_at' => ['nullable', 'date'],
            'employee.id_card_issuer' => ['nullable', Rule::in(array_keys(HrEmployee::ISSUERS))],
            'employee.city' => $text(100),
            'employee.street' => $text(150),
            'employee.house' => $text(20),
            'employee.apartment' => $text(20),
            'employee.phone' => $text(30),
            'employee.marital_status' => ['nullable', Rule::in(array_keys(HrEmployee::MARITAL_STATUSES))],
            'employee.military_status' => ['nullable', Rule::in(array_keys(HrEmployee::MILITARY_STATUSES))],
            'employee.is_pensioner' => ['nullable', 'boolean'],
            'employee.disability' => ['nullable', Rule::in(array_keys(HrEmployee::DISABILITIES))],
            'employee.is_student' => ['nullable', 'boolean'],
            'employee.is_large_family' => ['nullable', 'boolean'],
            'employee.children' => ['nullable', 'array', 'max:20'],
            'employee.children.*.id' => ['nullable', 'integer'],
            'employee.children.*.full_name' => $text(255),
            'employee.children.*.birth_date' => ['nullable', 'date'],
            'employee.educations' => ['nullable', 'array', 'max:10'],
            'employee.educations.*.id' => ['nullable', 'integer'],
            'employee.educations.*.level' => ['nullable', Rule::in(array_keys(HrEmployeeEducation::LEVELS))],
            'employee.educations.*.institution' => $text(255),
            'employee.educations.*.graduation_year' => ['nullable', 'integer', 'between:1950,2100'],
            'employee.educations.*.specialty' => $text(255),
            'employee.educations.*.diploma_number' => $text(100),

            'hiring' => ['sometimes', 'array'],
            'hiring.staff_category' => ['nullable', Rule::in(array_keys(Position::CATEGORY_LABELS))],
            'hiring.top_unit' => ['nullable', 'array'],
            'hiring.top_unit.id' => ['nullable', 'integer', 'exists:org_units,id'],
            'hiring.top_unit.name_ru' => $form,
            'hiring.top_unit.name_ru_gen' => $form,
            'hiring.top_unit.name_kz_gen' => $form,
            'hiring.top_unit.add_to_catalog' => ['nullable', 'boolean'],
            'hiring.sub_unit' => ['nullable', 'array'],
            'hiring.sub_unit.id' => ['nullable', 'integer', 'exists:org_units,id'],
            'hiring.sub_unit.name_ru' => $form,
            'hiring.sub_unit.name_ru_gen' => $form,
            'hiring.sub_unit.name_kz_gen' => $form,
            'hiring.sub_unit.add_to_catalog' => ['nullable', 'boolean'],
            'hiring.position' => ['nullable', 'array'],
            'hiring.position.id' => ['nullable', 'integer', 'exists:positions,id'],
            'hiring.position.name_ru' => $form,
            'hiring.position.name_ru_gen' => $form,
            'hiring.position.name_kz_poss' => $form,
            'hiring.position.add_to_catalog' => ['nullable', 'boolean'],
            'hiring.start_date' => ['nullable', 'date'],
            'hiring.probation_months' => ['nullable', 'integer', 'between:0,3'],
            'hiring.replaces' => ['nullable', 'array'],
            'hiring.replaces.user_id' => ['nullable', 'integer', 'exists:users,id'],
            'hiring.replaces.employee_id' => ['nullable', 'integer', 'exists:hr_employees,id'],
            'hiring.replaces.full_name' => $form,
            'hiring.order_number' => $text(30),
            'hiring.order_date' => ['nullable', 'date'],
            'hiring.fio_accusative' => $form,
            'hiring.fio_accusative_manual' => ['nullable', 'boolean'],

            'contract' => ['sometimes', 'array'],
            'contract.number' => $text(30),
            'contract.date' => ['nullable', 'date'],
            'contract.term' => ['nullable', Rule::in(array_keys(HrEmploymentContract::TERM_LABELS))],
            'contract.salary' => ['nullable', 'integer', 'between:0,100000000'],
            'contract.schedule' => ['nullable', Rule::in(array_keys(HrEmploymentContract::SCHEDULE_LABELS))],
            'contract.employment' => ['nullable', Rule::in(array_keys(HrEmploymentContract::EMPLOYMENT_LABELS))],
            'contract.vacation_days' => ['nullable', 'integer', 'between:0,365'],
            'contract.break_start' => ['nullable', 'string', $this->timeRule()],
            'contract.break_end' => ['nullable', 'string', $this->timeRule()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date' => 'Укажите дату.',
            'integer' => 'Укажите число.',
            'max' => 'Слишком длинное значение.',
            'in' => 'Выберите значение из списка.',
            'exists' => 'Запись не найдена в справочнике.',
            'hiring.probation_months.between' => 'Испытательный срок — от 0 до 3 месяцев.',
            'contract.salary.between' => 'Проверьте сумму оклада.',
            'contract.vacation_days.between' => 'Дней отпуска — от 0 до 365.',
            'employee.educations.*.graduation_year.between' => 'Год окончания — от 1950 до 2100.',
        ];
    }

    private function timeRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (trim((string) $value) !== '' && HrDates::normalizeTime((string) $value) === null) {
                $fail('Время в формате ЧЧ.ММ, например 12.30.');
            }
        };
    }
}

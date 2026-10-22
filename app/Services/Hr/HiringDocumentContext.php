<?php

namespace App\Services\Hr;

use App\Models\HrDocumentTemplate;
use App\Models\HrEmployee;
use App\Models\HrEmployeeAttachment;
use App\Models\HrEmployeeChild;
use App\Models\HrEmployeeEducation;
use App\Models\HrEmploymentContract;
use App\Models\HrHiring;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Services\Hr\Docx\HrTemplateCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;

/**
 * Builds the template values of a hiring document from one hiring record (the server-side counterpart of
 * the prototype's ctx() and REQ). Empty data is printed as a blank line so an incomplete document can still
 * be downloaded; the missing list tells the UI which fields to fill.
 */
class HiringDocumentContext
{
    public const BLANK = '__________';

    /** Step of the hiring form a missing field belongs to; 0 = module settings (employer). */
    public const STEP_SETTINGS = 0;

    public const STEP_EMPLOYEE = 1;

    public const STEP_APPOINTMENT = 2;

    public const STEP_CONTRACT = 3;

    /** Employer settings each document prints. */
    private const EMPLOYER_FIELDS = [
        HrDocumentTemplate::TYPE_CONTRACT => [
            'bin', 'basis_ru', 'basis_kz', 'signatory_ru_gen', 'signatory_kz', 'signatory_title_ru', 'signatory_title_kz',
            'signatory_short', 'bank', 'iik', 'bik', 'legal_address_kz', 'phone', 'visa_title_ru', 'visa_title_kz', 'visa_name',
        ],
        HrDocumentTemplate::TYPE_ORDER => ['signatory_title_ru', 'signatory_title_kz', 'signatory_short'],
        HrDocumentTemplate::TYPE_CARD => [],
    ];

    public function __construct(private readonly EmployerSettings $employerSettings) {}

    /**
     * Options: executor — the HR executor printed in the contract; sensitive — the viewer may see the social
     * status (pensioner, disability, student, large family), otherwise the card prints «нет доступа».
     *
     * @param  array{executor?: ?string, sensitive?: bool, today?: CarbonImmutable}  $options
     */
    public function build(HrHiring $hiring, string $type, array $options = []): HiringDocumentData
    {
        $hiring->loadMissing(['employee.children', 'employee.educations', 'employee.attachments', 'contract', 'topUnit', 'subUnit', 'position']);

        /** @var HrEmployee $employee */
        $employee = $hiring->employee;
        $contract = $hiring->contract ?? new HrEmploymentContract;
        $employer = $this->employerSettings->all();
        $sensitive = (bool) ($options['sensitive'] ?? false);

        $values = array_fill_keys(array_keys(HrTemplateCatalog::VALUES), self::BLANK);
        $values = array_merge($values, $this->employeeValues($employee, $sensitive));
        $values = array_merge($values, $this->appointmentValues($hiring));
        $values = array_merge($values, $this->contractValues($hiring, $contract));
        $values = array_merge($values, $this->orderValues($hiring, $contract, $employee));
        $values = array_merge($values, $this->employerValues($employer));
        $values['oup_executor'] = self::text($options['executor'] ?? null);
        $values['fill_date'] = HrDates::short($options['today'] ?? CarbonImmutable::today());

        $schedule = $contract->schedule ?: HrEmploymentContract::SCHEDULE_PPS;
        $flags = [
            'if_main' => $contract->employment !== HrEmploymentContract::EMPLOYMENT_SECONDARY,
            'if_sovm' => $contract->employment === HrEmploymentContract::EMPLOYMENT_SECONDARY,
            'if_has_end' => $contract->term !== HrEmploymentContract::TERM_INDEFINITE,
            'if_prob' => $hiring->probation_months > 0,
            'if_week' => $schedule !== HrEmploymentContract::SCHEDULE_SHIFT,
            'if_sched_pps' => $schedule === HrEmploymentContract::SCHEDULE_PPS,
            'if_sched_aup' => $schedule === HrEmploymentContract::SCHEDULE_AUP,
            'if_sched_shift' => $schedule === HrEmploymentContract::SCHEDULE_SHIFT,
            'if_has_edu' => $employee->educations->isNotEmpty(),
            'if_no_edu' => $employee->educations->isEmpty(),
            'if_has_children' => $employee->children->isNotEmpty(),
            'if_no_children' => $employee->children->isEmpty(),
            'if_has_attachments' => $employee->attachments->isNotEmpty(),
            'if_no_attachments' => $employee->attachments->isEmpty(),
        ];

        $rows = [
            'edu_level' => $employee->educations->map(fn (HrEmployeeEducation $education): array => [
                'edu_level' => $education->levelLabel(),
                'edu_institution' => self::orDash($education->institution),
                'edu_year' => self::orDash($education->graduation_year ? (string) $education->graduation_year : null),
                'edu_specialty' => self::orDash($education->specialty),
                'edu_diploma' => self::orDash($education->diploma_number),
            ])->values()->all(),
            'child_name' => $employee->children->map(fn (HrEmployeeChild $child): array => [
                'child_name' => $child->full_name,
                'child_birth' => self::orDash(HrDates::short($child->birth_date)),
            ])->values()->all(),
            'att_no' => $employee->attachments->values()->map(fn (HrEmployeeAttachment $attachment, int $index): array => [
                'att_no' => (string) ($index + 1),
                'att_type' => $attachment->docTypeLabel(),
                'att_name' => $attachment->original_name,
            ])->all(),
        ];

        $disk = Storage::disk(config('hr.disk'));
        $photoPath = $employee->photo_path && $disk->exists($employee->photo_path) ? $disk->path($employee->photo_path) : null;

        return new HiringDocumentData(
            $values,
            $flags,
            $rows,
            $photoPath,
            $this->missing($hiring, $employee, $contract, $employer, $type, $photoPath !== null),
            $this->warnings($hiring, $employee, $type),
        );
    }

    /**
     * @return array<string, string>
     */
    private function employeeValues(HrEmployee $employee, bool $sensitive): array
    {
        $iin = Iin::parse($employee->iin);
        $isForeign = $employee->citizenship === HrEmployee::CITIZENSHIP_OTHER;
        $countryRu = $isForeign ? trim((string) $employee->citizenship_ru) : 'Республики Казахстан';
        $countryKz = $isForeign ? trim((string) $employee->citizenship_kz) : 'Қазақстан Республикасының';
        $citizenWord = match ($employee->gender) {
            Iin::GENDER_MALE => 'гражданин',
            Iin::GENDER_FEMALE => 'гражданка',
            default => 'гражданин (ка)',
        };
        $issuer = HrEmployee::ISSUERS[$employee->id_card_issuer ?: HrEmployee::ISSUER_MVD] ?? HrEmployee::ISSUERS[HrEmployee::ISSUER_MVD];
        $apartment = trim((string) $employee->apartment);
        $hidden = 'нет доступа';
        $yesNo = static fn (bool $value): string => $value ? 'Да' : 'Нет';

        $addressParts = array_filter([
            $employee->city ? 'г. '.trim($employee->city) : null,
            $employee->street ? trim($employee->street) : null,
            $employee->house ? 'д. '.trim($employee->house) : null,
            $apartment !== '' ? 'кв. '.$apartment : null,
        ]);

        return [
            'fio' => self::text($employee->fullName()),
            'fio_short' => self::text($employee->shortName()),
            'last_name' => self::text($employee->last_name),
            'first_name' => self::text($employee->first_name),
            'middle_name' => self::orDash($employee->middle_name),
            'birth_date' => self::text(HrDates::short($employee->birth_date)),
            'gender_label' => match ($employee->gender) {
                Iin::GENDER_MALE => 'Мужской',
                Iin::GENDER_FEMALE => 'Женский',
                default => self::BLANK,
            },
            'iin' => $iin->valid ? $employee->iin : self::BLANK,
            'citizen_ru' => $citizenWord.' '.self::text($countryRu),
            'citizen_kz' => self::text($countryKz).' азаматы',
            'citizenship_label' => $isForeign ? self::text($countryRu) : 'Республика Казахстан',
            'id_doc_kind' => 'Удостоверение личности',
            'id_num' => self::text($employee->id_card_number),
            'id_date' => self::text(HrDates::short($employee->id_card_issued_at)),
            'id_issuer_label' => $issuer[0],
            'id_issuer_ru' => $issuer[1],
            'id_issuer_kz' => $issuer[2],
            'addr_city' => self::text($employee->city),
            'addr_street' => self::text($employee->street),
            'addr_house' => self::text($employee->house),
            'addr_apt_ru' => $apartment !== '' ? ', кв.'.$apartment : '',
            'addr_apt_kz' => $apartment !== '' ? ', '.$apartment.' пәтер' : '',
            'address_line' => $employee->street && $employee->house ? implode(', ', $addressParts) : self::BLANK,
            'phone' => self::text($employee->phone),
            'marital_label' => self::text($employee->maritalStatusLabel()),
            'military_label' => self::text(HrEmployee::MILITARY_STATUSES[$employee->military_status] ?? null),
            'pensioner_label' => $sensitive ? $yesNo($employee->is_pensioner) : $hidden,
            'disability_label' => $sensitive ? (HrEmployee::DISABILITIES[$employee->disability] ?? 'Нет') : $hidden,
            'student_label' => $sensitive ? $yesNo($employee->is_student) : $hidden,
            'large_family_label' => $sensitive ? $yesNo($employee->is_large_family) : $hidden,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function appointmentValues(HrHiring $hiring): array
    {
        $start = $hiring->start_date;
        $months = (int) $hiring->probation_months;
        $hasSub = self::filled($hiring->sub_unit_name_ru);

        $positionRu = [];
        $positionKz = [];
        if (self::filled($hiring->position_name_ru)) {
            $positionRu = [self::text($hiring->position_name_ru_gen)];
            if ($hasSub) {
                $positionRu[] = self::text($hiring->sub_unit_name_ru_gen);
            }
            if (self::filled($hiring->top_unit_name_ru)) {
                $positionRu[] = self::text($hiring->top_unit_name_ru_gen);
                $positionKz[] = self::text($hiring->top_unit_name_kz_gen);
            }
            if ($hasSub) {
                $positionKz[] = self::text($hiring->sub_unit_name_kz_gen);
            }
            $positionKz[] = self::text($hiring->position_name_kz_poss);
        }

        return [
            'category_label' => self::text(HrHiring::STAFF_CATEGORY_NAMES[$hiring->staff_category] ?? null),
            'top_unit_name' => self::text($hiring->top_unit_name_ru),
            'sub_unit_name' => self::orDash($hiring->sub_unit_name_ru),
            'position_name' => self::text($hiring->position_name_ru),
            'position_full_ru' => $positionRu ? implode(' ', $positionRu) : self::BLANK,
            'position_full_kz' => $positionKz ? implode(' ', $positionKz) : self::BLANK,
            'start_ru' => self::text(HrDates::ru($start)),
            'start_kz' => self::text(HrDates::kz($start)),
            'start_kz_from' => self::text(HrDates::kzFrom($start)),
            'start_date_short' => self::text(HrDates::short($start)),
            'prob_ru' => HiringTexts::RU_MONTHS[$months] ?? '',
            'prob_kz' => HiringTexts::KZ_MONTHS[$months] ?? '',
            'prob_end_ru' => $months > 0 && $start ? HrDates::ru(HrDates::periodEnd($start, $months)) : self::BLANK,
            'prob_end_kz' => $months > 0 && $start ? HrDates::kz(HrDates::periodEnd($start, $months)) : self::BLANK,
            'probation_label' => HiringTexts::RU_MONTHS[$months] ?? 'Без испытательного срока',
            'replacement_label' => self::orDash($hiring->replaces_full_name),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function contractValues(HrHiring $hiring, HrEmploymentContract $contract): array
    {
        $start = $hiring->start_date;
        $replaced = self::text($hiring->replaces_full_name);
        $years = $contract->termYears();

        $term = match (true) {
            $years !== null => HiringTexts::termYears($years),
            $contract->term === HrEmploymentContract::TERM_INDEFINITE => HiringTexts::termIndefinite(),
            $contract->term === HrEmploymentContract::TERM_REPLACEMENT => HiringTexts::termReplacement($replaced),
            default => ['ru' => self::BLANK, 'kz' => self::BLANK],
        };

        $end = match (true) {
            $years !== null && $start !== null => [
                'ru' => HrDates::ru(HrDates::periodEnd($start, 12 * $years)).' года.',
                'kz' => HrDates::kz(HrDates::periodEnd($start, 12 * $years)),
            ],
            $contract->term === HrEmploymentContract::TERM_REPLACEMENT => HiringTexts::END_REPLACEMENT,
            default => ['ru' => self::BLANK.' года.', 'kz' => self::BLANK],
        };

        $salary = (int) $contract->salary;
        $vacation = (int) $contract->vacation_days;

        return [
            'num' => self::text($contract->number),
            'contract_date_ru' => self::text(HrDates::ruQuoted($contract->date)),
            'contract_date_kz' => self::text(HrDates::kzQuoted($contract->date)),
            'contract_date_short' => self::text(HrDates::short($contract->date)),
            'contract_label' => self::filled($contract->number) && $contract->date ? '№'.$contract->number.' от '.HrDates::short($contract->date) : self::BLANK,
            'term_ru' => $term['ru'],
            'term_kz' => $term['kz'],
            'end_ru' => $end['ru'],
            'end_kz' => $end['kz'],
            'vac_days' => $vacation > 0 ? (string) $vacation : self::BLANK,
            'vac_days_ru' => $vacation > 0 ? NumberToWords::ru($vacation) : self::BLANK,
            'vac_days_kz' => $vacation > 0 ? NumberToWords::kz($vacation) : self::BLANK,
            'salary' => $salary > 0 ? NumberToWords::grouped($salary) : self::BLANK,
            'salary_ru' => $salary > 0 ? NumberToWords::ru($salary) : self::BLANK,
            'salary_kz' => $salary > 0 ? NumberToWords::kz($salary) : self::BLANK,
            'employment_label' => HrEmploymentContract::EMPLOYMENT_LABELS[$contract->employment ?: HrEmploymentContract::EMPLOYMENT_MAIN],
            'clause_1_7_sovm_ru' => HiringTexts::CLAUSE_1_7_SECONDARY['ru'],
            'clause_1_7_sovm_kz' => HiringTexts::CLAUSE_1_7_SECONDARY['kz'],
            'clause_3_1_2_aup_ru' => HiringTexts::CLAUSE_3_1_2_AUP['ru'],
            'clause_3_1_2_aup_kz' => HiringTexts::CLAUSE_3_1_2_AUP['kz'],
            'clause_3_1_shift_ru' => HiringTexts::CLAUSE_3_1_SHIFT['ru'],
            'clause_3_1_shift_kz' => HiringTexts::CLAUSE_3_1_SHIFT['kz'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function orderValues(HrHiring $hiring, HrEmploymentContract $contract, HrEmployee $employee): array
    {
        $months = (int) $hiring->probation_months;
        $years = $contract->termYears();
        $replaced = self::text($hiring->replaces_full_name);

        $term = match (true) {
            $years !== null => HiringTexts::orderTermYears($years),
            $contract->term === HrEmploymentContract::TERM_INDEFINITE => HiringTexts::ORDER_TERM_INDEFINITE,
            $contract->term === HrEmploymentContract::TERM_REPLACEMENT => HiringTexts::orderTermReplacement($replaced),
            default => ['ru' => self::BLANK, 'kz' => self::BLANK],
        };
        $probation = $months > 0 ? HiringTexts::orderProbation($months) : ['ru' => '', 'kz' => ''];
        $kind = HiringTexts::ORDER_KIND[$contract->employment === HrEmploymentContract::EMPLOYMENT_SECONDARY ? 'secondary' : 'main'];

        return [
            'order_num' => self::text($hiring->order_number),
            'order_date_ru' => self::text(HrDates::ruQuoted($hiring->order_date)),
            'order_date_kz' => self::text(HrDates::kzQuoted($hiring->order_date)),
            'order_label' => self::filled($hiring->order_number) && $hiring->order_date ? '№'.$hiring->order_number.' от '.HrDates::short($hiring->order_date) : self::BLANK,
            'fio_acc' => self::text($this->accusativeName($hiring, $employee)),
            'ord_term_ru' => $term['ru'],
            'ord_term_kz' => $term['kz'],
            'ord_prob_ru' => $probation['ru'],
            'ord_prob_kz' => $probation['kz'],
            'ord_kind_ru' => $kind['ru'],
            'ord_kind_kz' => $kind['kz'],
        ];
    }

    /**
     * @param  array<string, string>  $employer
     * @return array<string, string>
     */
    private function employerValues(array $employer): array
    {
        return [
            'emp_name_ru' => self::text($employer['name_ru']),
            'emp_name_kz' => self::text($employer['name_kz']),
            'emp_bin' => self::text($employer['bin']),
            'emp_basis_ru' => self::text($employer['basis_ru']),
            'emp_basis_kz' => self::text($employer['basis_kz']),
            'emp_signatory_ru_gen' => self::text($employer['signatory_ru_gen']),
            'emp_signatory_kz' => self::text($employer['signatory_kz']),
            'emp_signatory_title_ru' => self::text($employer['signatory_title_ru']),
            'emp_signatory_title_kz' => self::text($employer['signatory_title_kz']),
            'emp_signatory_short' => self::text($employer['signatory_short']),
            'emp_bank' => self::text($employer['bank']),
            'emp_iik' => self::text($employer['iik']),
            'emp_bik' => self::text($employer['bik']),
            'emp_address' => self::text($employer['legal_address_kz']),
            'emp_address_ru' => self::text($employer['legal_address_ru']),
            'emp_phone' => self::text($employer['phone']),
            'visa_title_ru' => self::text($employer['visa_title_ru']),
            'visa_title_kz' => self::text($employer['visa_title_kz']),
            'visa_name' => self::text($employer['visa_name']),
        ];
    }

    /** The order's «кого?» form: typed by HR (kept as is) or declined from the name. */
    public function accusativeName(HrHiring $hiring, HrEmployee $employee): string
    {
        if ($hiring->fio_accusative_manual && self::filled($hiring->fio_accusative)) {
            return trim($hiring->fio_accusative);
        }

        return RussianInflector::fullNameAccusative($employee->last_name, $employee->first_name, $employee->middle_name, $employee->gender);
    }

    /**
     * @param  array<string, string>  $employer
     * @return list<array{field: string, label: string, step: int}>
     */
    private function missing(HrHiring $hiring, HrEmployee $employee, HrEmploymentContract $contract, array $employer, string $type, bool $hasPhoto): array
    {
        $isContract = $type === HrDocumentTemplate::TYPE_CONTRACT;
        $isOrder = $type === HrDocumentTemplate::TYPE_ORDER;
        $isCard = $type === HrDocumentTemplate::TYPE_CARD;
        $usesForms = $isContract || $isOrder;
        $hasSub = self::filled($hiring->sub_unit_name_ru);
        $replacement = $contract->term === HrEmploymentContract::TERM_REPLACEMENT;

        // [applies, field, label, step, filled]
        $checks = [
            [true, 'employee.last_name', 'Фамилия', self::STEP_EMPLOYEE, self::filled($employee->last_name)],
            [true, 'employee.first_name', 'Имя', self::STEP_EMPLOYEE, self::filled($employee->first_name)],
            [$isContract || $isCard, 'employee.birth_date', 'Дата рождения', self::STEP_EMPLOYEE, $employee->birth_date !== null],
            [$isCard || ($isOrder && ! $hiring->fio_accusative_manual), 'employee.gender', 'Пол', self::STEP_EMPLOYEE, $employee->gender !== null],
            [$isContract || $isCard, 'employee.iin', 'ИИН', self::STEP_EMPLOYEE, Iin::parse($employee->iin)->valid],
            [$isContract && $employee->citizenship === HrEmployee::CITIZENSHIP_OTHER, 'employee.citizenship', 'Гражданство', self::STEP_EMPLOYEE,
                self::filled($employee->citizenship_ru) && self::filled($employee->citizenship_kz)],
            [$isCard, 'employee.photo', 'Фото', self::STEP_EMPLOYEE, $hasPhoto],
            [$isContract || $isCard, 'employee.id_card_number', '№ удостоверения', self::STEP_EMPLOYEE, self::filled($employee->id_card_number)],
            [$isContract || $isCard, 'employee.id_card_issued_at', 'Дата выдачи удостоверения', self::STEP_EMPLOYEE, $employee->id_card_issued_at !== null],
            [$isContract || $isCard, 'employee.address', 'Адрес', self::STEP_EMPLOYEE,
                self::filled($employee->city) && self::filled($employee->street) && self::filled($employee->house)],
            [$isContract, 'employee.phone', 'Телефон', self::STEP_EMPLOYEE, self::filled($employee->phone)],
            [$isCard, 'employee.marital_status', 'Семейное положение', self::STEP_EMPLOYEE, self::filled($employee->marital_status)],
            [$isCard, 'employee.educations', 'Образование', self::STEP_EMPLOYEE,
                $employee->educations->contains(fn (HrEmployeeEducation $e): bool => self::filled($e->level) && self::filled($e->institution))],
            [$isCard, 'employee.military_status', 'Воинский учёт', self::STEP_EMPLOYEE, self::filled($employee->military_status)],

            [true, 'hiring.top_unit', 'Департамент, управление, факультет', self::STEP_APPOINTMENT, self::filled($hiring->top_unit_name_ru)],
            [true, 'hiring.position', 'Должность', self::STEP_APPOINTMENT, self::filled($hiring->position_name_ru)],
            [$usesForms, 'hiring.top_unit_name_ru_gen', 'Подразделение: родительный падеж (рус.)', self::STEP_APPOINTMENT, self::filled($hiring->top_unit_name_ru_gen)],
            [$usesForms, 'hiring.top_unit_name_kz_gen', 'Подразделение: форма на казахском', self::STEP_APPOINTMENT, self::filled($hiring->top_unit_name_kz_gen)],
            [$usesForms && $hasSub, 'hiring.sub_unit_name_ru_gen', 'Отдел, кафедра: родительный падеж (рус.)', self::STEP_APPOINTMENT, self::filled($hiring->sub_unit_name_ru_gen)],
            [$usesForms && $hasSub, 'hiring.sub_unit_name_kz_gen', 'Отдел, кафедра: форма на казахском', self::STEP_APPOINTMENT, self::filled($hiring->sub_unit_name_kz_gen)],
            [$usesForms, 'hiring.position_name_ru_gen', 'Должность: родительный падеж (рус.)', self::STEP_APPOINTMENT, self::filled($hiring->position_name_ru_gen)],
            [$usesForms, 'hiring.position_name_kz_poss', 'Должность: форма на казахском', self::STEP_APPOINTMENT, self::filled($hiring->position_name_kz_poss)],
            [true, 'hiring.start_date', 'Дата приёма', self::STEP_APPOINTMENT, $hiring->start_date !== null],
            [$usesForms && $replacement, 'hiring.replaces', 'Замещаемый работник', self::STEP_APPOINTMENT, self::filled($hiring->replaces_full_name)],
            [$isOrder, 'hiring.order_number', '№ приказа', self::STEP_APPOINTMENT, self::filled($hiring->order_number)],
            [$isOrder, 'hiring.order_date', 'Дата приказа', self::STEP_APPOINTMENT, $hiring->order_date !== null],

            [$usesForms, 'contract.number', '№ договора', self::STEP_CONTRACT, self::filled($contract->number)],
            [$usesForms, 'contract.date', 'Дата договора', self::STEP_CONTRACT, $contract->date !== null],
            [$usesForms, 'contract.term', 'Срок договора', self::STEP_CONTRACT, self::filled($contract->term)],
            [$usesForms, 'contract.salary', 'Оклад', self::STEP_CONTRACT, (int) $contract->salary > 0],
            [$isContract, 'contract.vacation_days', 'Дни отпуска', self::STEP_CONTRACT, (int) $contract->vacation_days > 0],
        ];

        foreach (self::EMPLOYER_FIELDS[$type] ?? [] as $field) {
            $checks[] = [true, 'employer.'.$field, 'Настройки работодателя: '.EmployerSettings::FIELDS[$field], self::STEP_SETTINGS, self::filled($employer[$field] ?? null)];
        }

        $missing = [];
        foreach ($checks as [$applies, $field, $label, $step, $filled]) {
            if ($applies && ! $filled) {
                $missing[] = ['field' => $field, 'label' => $label, 'step' => $step];
            }
        }

        return $missing;
    }

    /**
     * @return list<string>
     */
    private function warnings(HrHiring $hiring, HrEmployee $employee, string $type): array
    {
        $warnings = [];

        if ($type !== HrDocumentTemplate::TYPE_CARD) {
            foreach ([[$hiring->topUnit, 'подразделения'], [$hiring->subUnit, 'отдела, кафедры']] as [$unit, $what]) {
                if ($unit instanceof OrgUnit && $unit->case_forms_verified_at === null) {
                    $warnings[] = "Падежные формы {$what} «{$unit->name}» не проверены ОУП.";
                }
            }
            if ($hiring->position instanceof Position && $hiring->position->case_forms_verified_at === null) {
                $warnings[] = "Падежные формы должности «{$hiring->position->name}» не проверены ОУП.";
            }
        }

        $iin = Iin::parse($employee->iin);
        if ($iin->valid && $employee->birth_date !== null && ! $iin->birthDate->isSameDay($employee->birth_date)) {
            $warnings[] = 'Дата рождения не совпадает с ИИН.';
        }
        if ($iin->valid && $employee->gender !== null && $iin->gender !== $employee->gender) {
            $warnings[] = 'Пол не совпадает с ИИН.';
        }

        return $warnings;
    }

    private static function filled(mixed $value): bool
    {
        return trim((string) $value) !== '';
    }

    private static function text(mixed $value): string
    {
        $value = trim((string) $value);

        return $value === '' ? self::BLANK : $value;
    }

    private static function orDash(mixed $value): string
    {
        $value = trim((string) $value);

        return $value === '' ? '—' : $value;
    }
}

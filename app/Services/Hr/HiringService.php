<?php

namespace App\Services\Hr;

use App\Models\HrDocument;
use App\Models\HrDocumentTemplate;
use App\Models\HrEmployee;
use App\Models\HrEmployeeAttachment;
use App\Models\HrEmploymentContract;
use App\Models\HrHiring;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Saving and presenting a hiring for the wizard, the hiring card and the list.
 * Drafts may be incomplete: the documents print blanks and list what is missing.
 */
class HiringService
{
    /** Social status fields: stored and shown only for users with the hr.sensitive right. */
    public const SENSITIVE_FIELDS = ['is_pensioner', 'disability', 'is_student', 'is_large_family'];

    private const EMPLOYEE_FIELDS = [
        'last_name', 'first_name', 'middle_name', 'iin', 'birth_date', 'gender', 'citizenship', 'citizenship_ru', 'citizenship_kz',
        'id_card_number', 'id_card_issued_at', 'id_card_issuer', 'city', 'street', 'house', 'apartment', 'phone',
        'marital_status', 'military_status', 'is_pensioner', 'disability', 'is_student', 'is_large_family',
    ];

    private const CONTRACT_FIELDS = ['number', 'date', 'term', 'salary', 'schedule', 'employment', 'vacation_days', 'break_start', 'break_end'];

    public function __construct(
        private readonly HrAccess $access,
        private readonly HiringSnapshot $snapshot,
        private readonly HiringDocumentContext $context,
        private readonly EmployerSettings $employer,
        private readonly HrAuditLogger $audit,
    ) {}

    /**
     * A new draft: a new employee or, for a re-hire, an existing one.
     */
    public function createDraft(User $user, ?HrEmployee $employee = null): HrHiring
    {
        $hiring = DB::transaction(function () use ($user, $employee): HrHiring {
            $employee ??= HrEmployee::query()->create(['created_by' => $user->id, 'updated_by' => $user->id]);
            $employer = $this->employer->all();

            $hiring = HrHiring::query()->create([
                'employee_id' => $employee->id,
                'status' => HrHiring::STATUS_DRAFT,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);
            HrEmploymentContract::query()->create([
                'hiring_id' => $hiring->id,
                'employment' => HrEmploymentContract::EMPLOYMENT_MAIN,
                'break_start' => HrDates::normalizeTime($employer['break_start']),
                'break_end' => HrDates::normalizeTime($employer['break_end']),
            ]);

            return $hiring;
        });

        $this->audit->hiring(HrAuditLogger::HIRING_CREATED, $hiring, 'Создан приём #'.$hiring->id, ['employee_id' => $hiring->employee_id], $user);

        return $hiring;
    }

    /**
     * @param  array<string, mixed>  $data  validated payload: employee, hiring, contract
     */
    public function update(HrHiring $hiring, array $data, User $user): HrHiring
    {
        $sensitive = $this->access->canViewSensitive($user);
        $catalog = $this->access->canManageCatalog($user);
        $changed = [];

        DB::transaction(function () use ($hiring, $data, $user, $sensitive, $catalog, &$changed): void {
            $hiring->loadMissing(['employee', 'contract']);
            $employee = $hiring->employee;

            $employeeData = array_intersect_key($data['employee'] ?? [], array_flip(self::EMPLOYEE_FIELDS));
            if (! $sensitive) {
                $employeeData = array_diff_key($employeeData, array_flip(self::SENSITIVE_FIELDS));
            }
            foreach (['is_pensioner', 'is_student', 'is_large_family'] as $flag) {
                if (array_key_exists($flag, $employeeData)) {
                    $employeeData[$flag] = (bool) $employeeData[$flag];
                }
            }
            if (array_key_exists('disability', $employeeData)) {
                $employeeData['disability'] = $employeeData['disability'] ?: 'none';
            }
            $employee->fill($employeeData + ['updated_by' => $user->id]);
            $changed = array_merge($changed, array_map(fn ($key) => 'employee.'.$key, array_keys($employee->getDirty())));
            $employee->save();

            if (array_key_exists('children', $data['employee'] ?? [])) {
                $this->syncList($employee->children(), $data['employee']['children'] ?? [], ['full_name', 'birth_date'], 'full_name');
            }
            if (array_key_exists('educations', $data['employee'] ?? [])) {
                $this->syncList($employee->educations(), $data['employee']['educations'] ?? [], ['level', 'institution', 'graduation_year', 'specialty', 'diploma_number'], 'level');
            }

            $hiringData = $data['hiring'] ?? [];
            if (array_key_exists('staff_category', $hiringData)) {
                $hiring->staff_category = $hiringData['staff_category'];
            }
            foreach (['start_date', 'order_number', 'order_date'] as $field) {
                if (array_key_exists($field, $hiringData)) {
                    $hiring->{$field} = $hiringData[$field];
                }
            }
            if (array_key_exists('probation_months', $hiringData)) {
                $hiring->probation_months = (int) $hiringData['probation_months'];
            }
            if (array_key_exists('top_unit', $hiringData)) {
                $this->applyUnit($hiring, 'top_unit', $hiringData['top_unit'], null, $catalog, $user);
            }
            if (array_key_exists('sub_unit', $hiringData)) {
                $this->applyUnit($hiring, 'sub_unit', $hiringData['sub_unit'], $hiring->top_unit_id, $catalog, $user);
            }
            if (array_key_exists('position', $hiringData)) {
                $this->applyPosition($hiring, $hiringData['position'], $catalog, $user);
            }
            if (array_key_exists('replaces', $hiringData)) {
                $replaces = $hiringData['replaces'] ?? [];
                $hiring->replaces_user_id = $replaces['user_id'] ?? null;
                $hiring->replaces_employee_id = $replaces['employee_id'] ?? null;
                $hiring->replaces_full_name = trim((string) ($replaces['full_name'] ?? '')) ?: null;
            }
            if (array_key_exists('fio_accusative_manual', $hiringData)) {
                $hiring->fio_accusative_manual = (bool) $hiringData['fio_accusative_manual'];
            }
            $hiring->fio_accusative = $hiring->fio_accusative_manual
                ? (trim((string) ($hiringData['fio_accusative'] ?? $hiring->fio_accusative)) ?: null)
                : (RussianInflector::fullNameAccusative($employee->last_name, $employee->first_name, $employee->middle_name, $employee->gender) ?: null);

            $this->snapshot->refresh($hiring);
            $hiring->updated_by = $user->id;
            $changed = array_merge($changed, array_map(fn ($key) => 'hiring.'.$key, array_diff(array_keys($hiring->getDirty()), ['updated_by'])));
            $hiring->save();

            $contract = $hiring->contract ?? new HrEmploymentContract(['hiring_id' => $hiring->id]);
            $contractData = array_intersect_key($data['contract'] ?? [], array_flip(self::CONTRACT_FIELDS));
            foreach (['break_start', 'break_end'] as $field) {
                if (array_key_exists($field, $contractData)) {
                    $contractData[$field] = HrDates::normalizeTime($contractData[$field]);
                }
            }
            if (array_key_exists('employment', $contractData)) {
                $contractData['employment'] = $contractData['employment'] ?: HrEmploymentContract::EMPLOYMENT_MAIN;
            }
            $contract->fill($contractData);
            $changed = array_merge($changed, array_map(fn ($key) => 'contract.'.$key, array_keys($contract->getDirty())));
            $contract->save();
        });

        if ($changed !== []) {
            $this->audit->hiring(HrAuditLogger::HIRING_UPDATED, $hiring, 'Изменён приём #'.$hiring->id, ['fields' => array_values(array_unique($changed))], $user);
        }

        return $hiring->fresh();
    }

    /**
     * Everything the wizard and the hiring card show. Full IIN and ID number: this is the personal card.
     *
     * @return array<string, mixed>
     */
    public function present(HrHiring $hiring, User $user): array
    {
        $hiring->loadMissing(['employee.children', 'employee.educations', 'employee.attachments', 'contract', 'topUnit', 'subUnit', 'position', 'replacesUser']);
        $employee = $hiring->employee;
        $contract = $hiring->contract ?? new HrEmploymentContract;
        $sensitive = $this->access->canViewSensitive($user);

        $employeeData = [];
        foreach (self::EMPLOYEE_FIELDS as $field) {
            $value = $employee->{$field};
            $employeeData[$field] = $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : $value;
        }
        if (! $sensitive) {
            foreach (self::SENSITIVE_FIELDS as $field) {
                $employeeData[$field] = null;
            }
        }

        return [
            'id' => $hiring->id,
            'status' => $hiring->status,
            'status_label' => HrHiring::STATUS_LABELS[$hiring->status] ?? $hiring->status,
            'employee' => $employeeData + [
                'id' => $employee->id,
                'full_name' => $employee->fullName(),
                'children' => $employee->children->map(fn ($child) => [
                    'id' => $child->id,
                    'full_name' => $child->full_name,
                    'birth_date' => $child->birth_date?->format('Y-m-d'),
                ])->values()->all(),
                'educations' => $employee->educations->map(fn ($education) => [
                    'id' => $education->id,
                    'level' => $education->level,
                    'institution' => $education->institution,
                    'graduation_year' => $education->graduation_year,
                    'specialty' => $education->specialty,
                    'diploma_number' => $education->diploma_number,
                ])->values()->all(),
                'has_photo' => $employee->photo_path !== null,
                'photo_url' => $employee->photo_path ? route('hr.hiring.photo.show', [$hiring, 'v' => substr(md5($employee->photo_path), 0, 8)]) : null,
                'attachments' => $employee->attachments->map(fn (HrEmployeeAttachment $attachment) => [
                    'id' => $attachment->id,
                    'doc_type' => $attachment->doc_type,
                    'doc_type_label' => $attachment->docTypeLabel(),
                    'original_name' => $attachment->original_name,
                    'size' => $attachment->size,
                    'uploaded_at' => $attachment->created_at?->format('d.m.Y H:i'),
                    'url' => $sensitive ? route('hr.hiring.attachments.show', [$hiring, $attachment]) : null,
                ])->values()->all(),
            ],
            'hiring' => [
                'staff_category' => $hiring->staff_category,
                'top_unit' => $this->unitSnapshot($hiring, 'top_unit', $hiring->topUnit),
                'sub_unit' => $this->unitSnapshot($hiring, 'sub_unit', $hiring->subUnit),
                'position' => [
                    'id' => $hiring->position_id,
                    'name_ru' => $hiring->position_name_ru,
                    'name_ru_gen' => $hiring->position_name_ru_gen,
                    'name_kz_poss' => $hiring->position_name_kz_poss,
                    'verified' => $hiring->position ? $hiring->position->case_forms_verified_at !== null : null,
                ],
                'start_date' => $hiring->start_date?->format('Y-m-d'),
                'probation_months' => (int) $hiring->probation_months,
                'replaces' => [
                    'user_id' => $hiring->replaces_user_id,
                    'employee_id' => $hiring->replaces_employee_id,
                    'full_name' => $hiring->replaces_full_name,
                ],
                'order_number' => $hiring->order_number,
                'order_date' => $hiring->order_date?->format('Y-m-d'),
                'fio_accusative' => $hiring->fio_accusative,
                'fio_accusative_manual' => (bool) $hiring->fio_accusative_manual,
            ],
            'contract' => [
                'number' => $contract->number,
                'date' => $contract->date?->format('Y-m-d'),
                'term' => $contract->term,
                'salary' => $contract->salary,
                'schedule' => $contract->schedule,
                'employment' => $contract->employment ?: HrEmploymentContract::EMPLOYMENT_MAIN,
                'vacation_days' => $contract->vacation_days,
                'break_start' => $contract->break_start,
                'break_end' => $contract->break_end,
            ],
            'documents' => $this->documents($hiring, $user),
            'checks' => $this->checks($hiring),
        ];
    }

    /**
     * Missing fields and warnings of each document, as the generator would see them now.
     *
     * @return array<string, array{missing: list<array{field: string, label: string, step: int}>, warnings: list<string>}>
     */
    public function checks(HrHiring $hiring): array
    {
        $checks = [];
        foreach (array_keys(HrDocumentTemplate::TYPE_LABELS) as $type) {
            $data = $this->context->build($hiring, $type, ['sensitive' => false]);
            $checks[$type] = ['missing' => $data->missing, 'warnings' => $data->warnings];
        }

        return $checks;
    }

    /**
     * Generated documents, newest version first per type.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function documents(HrHiring $hiring, User $user): array
    {
        $sensitive = $this->access->canViewSensitive($user);
        $result = array_fill_keys(array_keys(HrDocumentTemplate::TYPE_LABELS), []);

        $hiring->documents()->with(['generator:id,name', 'template:id,version'])->orderByDesc('version')->get()
            ->each(function (HrDocument $document) use (&$result, $hiring, $sensitive): void {
                $result[$document->type][] = [
                    'id' => $document->id,
                    'version' => $document->version,
                    'status' => $document->status,
                    'template_version' => $document->template?->version,
                    'generated_at' => $document->created_at?->format('d.m.Y H:i'),
                    'generated_by' => $document->generator?->name,
                    'signed_at' => $document->signed_at?->format('d.m.Y H:i'),
                    'oup_executor' => $document->oup_executor,
                    'missing_count' => count($document->missing_fields ?? []),
                    'download_url' => route('hr.hiring.documents.download', [$hiring, $document]),
                    'scan_url' => $document->signed_scan_path && $sensitive ? route('hr.hiring.documents.scan', [$hiring, $document]) : null,
                ];
            });

        return $result;
    }

    /**
     * @param  array{status?: ?string, unit?: ?int, date_from?: ?string, date_to?: ?string, q?: ?string}  $filters
     */
    public function listing(array $filters): LengthAwarePaginator
    {
        $query = $this->filtered($filters)->with([
            'employee',
            'contract',
            'documents' => fn ($q) => $q->select(['id', 'hiring_id', 'type', 'version', 'status']),
        ]);

        return $query->orderByDesc('id')->paginate(20)->withQueryString()->through(fn (HrHiring $hiring): array => [
            'id' => $hiring->id,
            'full_name' => $hiring->employee?->fullName() ?: 'Без имени',
            'iin_masked' => $hiring->employee?->maskedIin() ?: '',
            'id_card_masked' => $hiring->employee?->maskedIdCardNumber() ?: '',
            'position' => $hiring->position_name_ru,
            'unit' => collect([$hiring->sub_unit_name_ru, $hiring->top_unit_name_ru])->filter()->implode(', '),
            'start_date' => $hiring->start_date?->format('d.m.Y'),
            'status' => $hiring->status,
            'status_label' => HrHiring::STATUS_LABELS[$hiring->status] ?? $hiring->status,
            'contract_number' => $hiring->contract?->number,
            'order_number' => $hiring->order_number,
            'documents' => $this->documentStates($hiring),
            'updated_at' => $hiring->updated_at?->format('d.m.Y H:i'),
        ]);
    }

    /**
     * Hirings per status under the other list filters (search, unit, dates), for the status tabs.
     *
     * @return array<string, int> {all, draft, signed, cancelled}
     */
    public function statusCounts(array $filters): array
    {
        $counts = $this->filtered(['status' => null] + $filters)
            ->toBase()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $result = ['all' => (int) $counts->sum()];
        foreach (array_keys(HrHiring::STATUS_LABELS) as $status) {
            $result[$status] = (int) ($counts[$status] ?? 0);
        }

        return $result;
    }

    /** @return Builder<HrHiring> */
    private function filtered(array $filters): Builder
    {
        $query = HrHiring::query();

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['unit'])) {
            $query->where(fn (Builder $q) => $q->where('top_unit_id', $filters['unit'])->orWhere('sub_unit_id', $filters['unit']));
        }
        if (! empty($filters['date_from'])) {
            $query->whereDate('start_date', '>=', $filters['date_from']);
        }
        if (! empty($filters['date_to'])) {
            $query->whereDate('start_date', '<=', $filters['date_to']);
        }

        $search = trim((string) ($filters['q'] ?? ''));
        if ($search !== '') {
            if (preg_match('/^\d{12}$/', $search)) {
                $query->whereHas('employee', fn (Builder $q) => $q->where('iin_hash', HrEmployee::hashIin($search)));
            } else {
                foreach (preg_split('/\s+/u', $search) as $word) {
                    $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $word).'%';
                    $query->whereHas('employee', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                        ->where('last_name', 'like', $like)->orWhere('first_name', 'like', $like)->orWhere('middle_name', 'like', $like)));
                }
            }
        }

        return $query;
    }

    /**
     * State of the latest version of each document, for the list: none (not generated yet), draft, signed.
     *
     * @return array<string, string>
     */
    private function documentStates(HrHiring $hiring): array
    {
        $latest = $hiring->documents->sortByDesc('version')->unique('type')->keyBy('type');

        return collect(array_keys(HrDocumentTemplate::TYPE_LABELS))
            ->mapWithKeys(fn (string $type): array => [$type => $latest[$type]->status ?? 'none'])
            ->all();
    }

    /**
     * Units used by hirings, for the list filter.
     *
     * @return list<array{id: int, name: string}>
     */
    public function unitFilterOptions(): array
    {
        $ids = HrHiring::query()->pluck('top_unit_id')->merge(HrHiring::query()->pluck('sub_unit_id'))->filter()->unique();

        return OrgUnit::query()->whereIn('id', $ids)->orderBy('name')->get(['id', 'name'])
            ->map(fn (OrgUnit $unit) => ['id' => $unit->id, 'name' => $unit->name])->all();
    }

    /**
     * After a document is signed: the hiring is signed once its latest contract and order are signed.
     */
    public function refreshStatus(HrHiring $hiring): void
    {
        $latestSigned = fn (string $type): bool => $hiring->documents()->where('type', $type)->orderByDesc('version')->value('status') === HrDocument::STATUS_SIGNED;

        if ($latestSigned(HrDocumentTemplate::TYPE_CONTRACT) && $latestSigned(HrDocumentTemplate::TYPE_ORDER)) {
            $hiring->forceFill(['status' => HrHiring::STATUS_SIGNED])->save();
        }
    }

    /**
     * @param  array<string, mixed>|null  $input  {id, name_ru, name_ru_gen, name_kz_gen, add_to_catalog}
     */
    private function applyUnit(HrHiring $hiring, string $prefix, ?array $input, ?int $parentId, bool $catalog, User $user): void
    {
        $input ??= [];
        $id = $input['id'] ?? null;
        $name = trim((string) ($input['name_ru'] ?? ''));

        if ($id === null && $name !== '' && ($input['add_to_catalog'] ?? false) && $catalog) {
            $id = OrgUnit::query()->create([
                'code' => 'HR_'.Str::upper(Str::random(10)),
                'name' => $name,
                'unit_type' => OrgUnit::TYPE_OTHER,
                'parent_id' => $parentId ?? OrgUnit::query()->where('unit_type', OrgUnit::TYPE_UNIVERSITY)->value('id'),
                'is_active' => true,
                'source' => 'hr_hiring',
                'name_ru_gen' => self::blankToNull($input['name_ru_gen'] ?? null),
                'name_kz_gen' => self::blankToNull($input['name_kz_gen'] ?? null),
                'case_forms_verified_at' => now(),
                'case_forms_verified_by' => $user->id,
            ])->id;
            $this->audit->module(HrAuditLogger::CATALOG_UPDATED, 'OrgUnit', $id, 'Подразделение добавлено в справочник из приёма #'.$hiring->id, ['hiring_id' => $hiring->id], $user);
        }

        if ($id !== null && ($input['add_to_catalog'] ?? false) && $catalog) {
            $this->fillCatalogGaps(OrgUnit::query()->find($id), [
                'name_ru_gen' => $input['name_ru_gen'] ?? null,
                'name_kz_gen' => $input['name_kz_gen'] ?? null,
            ], $hiring, $user);
        }

        $hiring->{$prefix.'_id'} = $id;
        $hiring->{$prefix.'_name_ru'} = $name ?: null;
        $hiring->{$prefix.'_name_ru_gen'} = self::blankToNull($input['name_ru_gen'] ?? null);
        $hiring->{$prefix.'_name_kz_gen'} = self::blankToNull($input['name_kz_gen'] ?? null);
        $hiring->setRelation($prefix === 'top_unit' ? 'topUnit' : 'subUnit', $id ? OrgUnit::query()->find($id) : null);
    }

    /**
     * @param  array<string, mixed>|null  $input  {id, name_ru, name_ru_gen, name_kz_poss, add_to_catalog}
     */
    private function applyPosition(HrHiring $hiring, ?array $input, bool $catalog, User $user): void
    {
        $input ??= [];
        $id = $input['id'] ?? null;
        $name = trim((string) ($input['name_ru'] ?? ''));

        if ($id === null && $name !== '' && ($input['add_to_catalog'] ?? false) && $catalog) {
            // Position names are unique: a name that is already in the catalog links to that entry.
            $id = Position::query()->where('name', $name)->value('id');
        }
        if ($id === null && $name !== '' && ($input['add_to_catalog'] ?? false) && $catalog) {
            $id = Position::query()->create([
                'name' => $name,
                'staff_category' => $hiring->staff_category,
                'name_ru_gen' => self::blankToNull($input['name_ru_gen'] ?? null),
                'name_kz_poss' => self::blankToNull($input['name_kz_poss'] ?? null),
                'case_forms_verified_at' => now(),
                'case_forms_verified_by' => $user->id,
            ])->id;
            $this->audit->module(HrAuditLogger::CATALOG_UPDATED, 'Position', $id, 'Должность добавлена в справочник из приёма #'.$hiring->id, ['hiring_id' => $hiring->id], $user);
        }

        if ($id !== null && ($input['add_to_catalog'] ?? false) && $catalog) {
            $this->fillCatalogGaps(Position::query()->find($id), [
                'name_ru_gen' => $input['name_ru_gen'] ?? null,
                'name_kz_poss' => $input['name_kz_poss'] ?? null,
            ], $hiring, $user);
        }

        $hiring->position_id = $id;
        $hiring->position_name_ru = $name ?: null;
        $hiring->position_name_ru_gen = self::blankToNull($input['name_ru_gen'] ?? null);
        $hiring->position_name_kz_poss = self::blankToNull($input['name_kz_poss'] ?? null);
        $hiring->setRelation('position', $id ? Position::query()->find($id) : null);
    }

    /**
     * A catalog entry picked in the wizard gets the forms it lacked (filled ones are not overwritten).
     *
     * @param  array<string, mixed>  $forms
     */
    private function fillCatalogGaps(OrgUnit|Position|null $entry, array $forms, HrHiring $hiring, User $user): void
    {
        if ($entry === null) {
            return;
        }

        foreach ($forms as $field => $value) {
            if (trim((string) $entry->{$field}) === '' && self::blankToNull($value) !== null) {
                $entry->{$field} = trim($value);
            }
        }

        if ($entry->isDirty()) {
            $entry->save();
            $this->audit->module(HrAuditLogger::CATALOG_UPDATED, class_basename($entry), $entry->id, 'Формы дополнены из приёма #'.$hiring->id, ['hiring_id' => $hiring->id, 'fields' => array_keys($forms)], $user);
        }
    }

    /**
     * Replaces the child rows with the submitted list (rows keep their ids; rows without the key field are dropped).
     *
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>  $fields
     */
    private function syncList($relation, array $rows, array $fields, string $keyField): void
    {
        $keep = [];
        foreach (array_values($rows) as $index => $row) {
            if (trim((string) ($row[$keyField] ?? '')) === '') {
                continue;
            }
            $values = array_intersect_key($row, array_flip($fields)) + ['sort_order' => $index];
            $model = ! empty($row['id']) ? (clone $relation)->whereKey($row['id'])->first() : null;
            $model ? $model->update($values) : ($model = (clone $relation)->create($values));
            $keep[] = $model->id;
        }
        (clone $relation)->whereNotIn('id', $keep)->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function unitSnapshot(HrHiring $hiring, string $prefix, ?OrgUnit $unit): array
    {
        return [
            'id' => $hiring->{$prefix.'_id'},
            'name_ru' => $hiring->{$prefix.'_name_ru'},
            'name_ru_gen' => $hiring->{$prefix.'_name_ru_gen'},
            'name_kz_gen' => $hiring->{$prefix.'_name_kz_gen'},
            'verified' => $unit ? $unit->case_forms_verified_at !== null : null,
        ];
    }

    private static function blankToNull(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}

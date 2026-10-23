<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrDocumentTemplate;
use App\Models\OrgUnit;
use App\Models\Position;
use App\Models\User;
use App\Services\Hr\Docx\TemplateInspector;
use App\Services\Hr\EmployerSettings;
use App\Services\Hr\HrAccess;
use App\Services\Hr\HrAuditLogger;
use App\Services\Hr\HrDates;
use App\Services\Hr\HrNumberSuggester;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Module settings: employer requisites and template versions (HR), the catalog case forms
 * (hr.catalog right), module rights (administrators).
 */
class HiringSettingsController extends Controller
{
    private const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    /** Same as the wizard lookup: units where people work. */
    private const NOT_HIRING_UNITS = [OrgUnit::TYPE_UNIVERSITY, OrgUnit::TYPE_GOVERNANCE, OrgUnit::TYPE_RECTORATE];

    public function __construct(
        private readonly EmployerSettings $employer,
        private readonly HrAccess $access,
        private readonly HrAuditLogger $audit,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $abilities = $this->access->abilities($user);

        return Inertia::render('Hr/Hiring/Settings', [
            'tab' => $request->query('tab', 'employer'),
            'employer' => $this->employer->all(),
            'numbering' => app(HrNumberSuggester::class)->externalSetting() + ['current_year' => (int) now()->year],
            'employerFields' => EmployerSettings::FIELDS,
            'templates' => $this->templates(),
            'units' => OrgUnit::query()->whereNotIn('unit_type', self::NOT_HIRING_UNITS)->with('parent:id,name')->orderBy('name')->get()
                ->map(fn (OrgUnit $unit) => [
                    'id' => $unit->id,
                    'name' => $unit->name,
                    'type_label' => $unit->unitTypeLabel(),
                    'parent' => $unit->parent?->name,
                    'name_ru_gen' => $unit->name_ru_gen,
                    'name_kz' => $unit->name_kz,
                    'name_kz_gen' => $unit->name_kz_gen,
                    'verified' => $unit->case_forms_verified_at !== null,
                    'is_active' => (bool) $unit->is_active,
                ])->values(),
            'positions' => Position::query()->orderBy('name')->get()->map(fn (Position $position) => [
                'id' => $position->id,
                'name' => $position->name,
                'staff_category' => $position->staff_category,
                'name_ru_gen' => $position->name_ru_gen,
                'name_kz' => $position->name_kz,
                'name_kz_poss' => $position->name_kz_poss,
                'verified' => $position->case_forms_verified_at !== null,
            ])->values(),
            'categories' => Position::CATEGORY_LABELS,
            'members' => $abilities['rights'] ? $this->access->members() : [],
            'capabilities' => HrAccess::CAPABILITIES,
            'abilities' => $abilities,
        ]);
    }

    public function updateEmployer(Request $request): RedirectResponse
    {
        $rules = array_fill_keys(array_keys(EmployerSettings::FIELDS), ['nullable', 'string', 'max:500']);
        $timeRule = function (string $attribute, mixed $value, \Closure $fail): void {
            if (trim((string) $value) !== '' && HrDates::normalizeTime((string) $value) === null) {
                $fail('Время в формате ЧЧ.ММ, например 12.30.');
            }
        };
        $rules['break_start'][] = $timeRule;
        $rules['break_end'][] = $timeRule;
        $data = $request->validate($rules);

        foreach (['break_start', 'break_end'] as $field) {
            $data[$field] = HrDates::normalizeTime($data[$field] ?? null) ?? '';
        }
        $this->employer->update($data);
        $this->audit->module(HrAuditLogger::SETTINGS_UPDATED, 'AppSetting', null, 'Изменены настройки работодателя', ['fields' => array_keys($data)], $request->user());

        return Redirect::back()->with('success', 'Настройки работодателя сохранены.');
    }

    /** The last «-К» order number issued outside the module for a year (the next-number hint continues from it). */
    public function updateNumbering(Request $request, HrNumberSuggester $numbers): RedirectResponse
    {
        $data = $request->validate([
            'year' => ['required', 'integer', 'between:2000,2100'],
            'last_order_number' => ['nullable', 'integer', 'between:0,100000'],
        ], [
            'last_order_number.integer' => 'Укажите номер числом, без «-К».',
        ]);

        $numbers->setExternalOrderNumber((int) $data['year'], isset($data['last_order_number']) ? (int) $data['last_order_number'] : null);
        $this->audit->module(HrAuditLogger::SETTINGS_UPDATED, 'AppSetting', null, 'Изменён последний номер приказа вне системы', ['year' => (int) $data['year']], $request->user());

        return Redirect::back()->with('success', 'Номер сохранён: подсказка следующего номера приказа учтёт его.');
    }

    /**
     * A new template version: checked tag by tag before it is stored; optionally activated at once.
     */
    public function storeTemplate(Request $request, TemplateInspector $inspector): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(HrDocumentTemplate::TYPE_LABELS))],
            'file' => ['required', 'file', 'extensions:docx', 'max:10240'],
            'comment' => ['nullable', 'string', 'max:255'],
            'activate' => ['nullable', 'boolean'],
        ], [
            'file.required' => 'Выберите файл .docx.',
            'file.extensions' => 'Шаблон — файл Word в формате .docx.',
            'file.max' => 'Файл не больше 10 МБ.',
        ]);

        $report = $inspector->inspect($request->file('file')->getRealPath(), $data['type']);
        if ($report['errors'] !== []) {
            return Redirect::back()->withErrors(['file' => implode("\n", $report['errors'])]);
        }

        $template = DB::transaction(function () use ($request, $data): HrDocumentTemplate {
            $version = (int) HrDocumentTemplate::query()->where('type', $data['type'])->lockForUpdate()->max('version') + 1;
            $path = $request->file('file')->storeAs("hr/templates/{$data['type']}", "v{$version}-".Str::random(8).'.docx', config('hr.disk'));

            $template = HrDocumentTemplate::query()->create([
                'type' => $data['type'],
                'version' => $version,
                'file_path' => $path,
                'original_name' => Str::limit($request->file('file')->getClientOriginalName(), 200, ''),
                'sha256' => hash_file('sha256', Storage::disk(config('hr.disk'))->path($path)),
                'is_active' => false,
                'comment' => $data['comment'] ?? null,
                'uploaded_by' => $request->user()->id,
            ]);

            if ($data['activate'] ?? false) {
                $this->activate($template);
            }

            return $template;
        });

        $this->audit->module(HrAuditLogger::TEMPLATE_UPLOADED, 'HrDocumentTemplate', $template->id,
            'Загружен шаблон: '.HrDocumentTemplate::TYPE_LABELS[$template->type].' v'.$template->version.($template->is_active ? ' (активен)' : ''),
            ['type' => $template->type, 'version' => $template->version], $request->user());

        return Redirect::back()->with('success', 'Шаблон загружен: версия '.$template->version.($template->is_active ? ', активна.' : '. Сделайте её активной, когда будете готовы.'));
    }

    public function activateTemplate(Request $request, HrDocumentTemplate $template): RedirectResponse
    {
        DB::transaction(fn () => $this->activate($template));
        $this->audit->module(HrAuditLogger::TEMPLATE_ACTIVATED, 'HrDocumentTemplate', $template->id,
            'Активирован шаблон: '.HrDocumentTemplate::TYPE_LABELS[$template->type].' v'.$template->version,
            ['type' => $template->type, 'version' => $template->version], $request->user());

        return Redirect::back()->with('success', HrDocumentTemplate::TYPE_LABELS[$template->type].': активна версия '.$template->version.'.');
    }

    public function downloadTemplate(HrDocumentTemplate $template): BinaryFileResponse|StreamedResponse
    {
        $name = HrDocumentTemplate::TYPE_LABELS[$template->type].' — шаблон v'.$template->version.'.docx';

        if ($template->file_path === null) {
            return response()->download(HrDocumentTemplate::builtInPath($template->type), $name, ['Content-Type' => self::DOCX_MIME]);
        }

        abort_unless(Storage::disk(config('hr.disk'))->exists($template->file_path), 404);

        return Storage::disk(config('hr.disk'))->download($template->file_path, $name, ['Content-Type' => self::DOCX_MIME]);
    }

    public function updateUnit(Request $request, OrgUnit $orgUnit): RedirectResponse
    {
        abort_if(in_array($orgUnit->unit_type, self::NOT_HIRING_UNITS, true), 404);
        $data = $request->validate([
            'name_ru_gen' => ['nullable', 'string', 'max:255'],
            'name_kz' => ['nullable', 'string', 'max:255'],
            'name_kz_gen' => ['nullable', 'string', 'max:255'],
            'verified' => ['required', 'boolean'],
        ]);

        $this->saveForms($orgUnit, $data, $request->user());
        $this->audit->module(HrAuditLogger::CATALOG_UPDATED, 'OrgUnit', $orgUnit->id, 'Падежные формы подразделения'.($data['verified'] ? ' подтверждены' : ' изменены'), ['verified' => (bool) $data['verified']], $request->user());

        return Redirect::back()->with('success', 'Формы подразделения сохранены.');
    }

    public function updatePosition(Request $request, Position $position): RedirectResponse
    {
        $data = $request->validate([
            'staff_category' => ['nullable', Rule::in(array_keys(Position::CATEGORY_LABELS))],
            'name_ru_gen' => ['nullable', 'string', 'max:255'],
            'name_kz' => ['nullable', 'string', 'max:255'],
            'name_kz_poss' => ['nullable', 'string', 'max:255'],
            'verified' => ['required', 'boolean'],
        ]);

        $this->saveForms($position, $data, $request->user());
        $this->audit->module(HrAuditLogger::CATALOG_UPDATED, 'Position', $position->id, 'Падежные формы должности'.($data['verified'] ? ' подтверждены' : ' изменены'), ['verified' => (bool) $data['verified']], $request->user());

        return Redirect::back()->with('success', 'Формы должности сохранены.');
    }

    public function storePosition(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('positions', 'name')],
            'staff_category' => ['required', Rule::in(array_keys(Position::CATEGORY_LABELS))],
            'name_ru_gen' => ['nullable', 'string', 'max:255'],
            'name_kz' => ['nullable', 'string', 'max:255'],
            'name_kz_poss' => ['nullable', 'string', 'max:255'],
        ], [
            'name.required' => 'Укажите название должности.',
            'name.unique' => 'Такая должность уже есть в справочнике.',
            'staff_category.required' => 'Выберите категорию персонала.',
        ]);

        $position = Position::query()->create($data + [
            'case_forms_verified_at' => now(),
            'case_forms_verified_by' => $request->user()->id,
        ]);
        $this->audit->module(HrAuditLogger::CATALOG_UPDATED, 'Position', $position->id, 'Должность добавлена в справочник', [], $request->user());

        return Redirect::back()->with('success', 'Должность добавлена.');
    }

    public function users(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $data['q']).'%';

        return response()->json(['items' => User::query()
            ->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('email', 'like', $like))
            ->orderBy('name')->limit(20)->get(['id', 'name', 'email', 'role', 'role_id'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => (string) $user->name,
                'email' => $user->email,
                'role' => $user->resolvedRoleSlug(),
                'can_use_module' => $this->access->canUseModule($user),
                'role_access' => $this->access->hasModuleRole($user),
            ])->values()]);
    }

    public function grant(Request $request): RedirectResponse
    {
        $data = $this->validateRight($request);
        $subject = User::query()->findOrFail($data['user_id']);

        $this->access->grant($subject, $data['capability'], $request->user());
        $this->audit->module(HrAuditLogger::RIGHTS_CHANGED, 'User', $subject->id, 'Выдано право: '.HrAccess::CAPABILITIES[$data['capability']], ['capability' => $data['capability'], 'granted' => true], $request->user());

        $warning = $this->access->canUseModule($subject) ? null : ' Модуль этому пользователю пока закрыт — право начнёт действовать, когда выдадите «Доступ к модулю».';

        return Redirect::back()->with('success', 'Право выдано.'.($warning ?? ''));
    }

    public function revoke(Request $request): RedirectResponse
    {
        $data = $this->validateRight($request);
        $subject = User::query()->findOrFail($data['user_id']);

        $this->access->revoke($subject, $data['capability']);
        $this->audit->module(HrAuditLogger::RIGHTS_CHANGED, 'User', $subject->id, 'Отозвано право: '.HrAccess::CAPABILITIES[$data['capability']], ['capability' => $data['capability'], 'granted' => false], $request->user());

        return Redirect::back()->with('success', 'Право отозвано.');
    }

    /**
     * @return array{user_id: int, capability: string}
     */
    private function validateRight(Request $request): array
    {
        return $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'capability' => ['required', Rule::in(array_keys(HrAccess::CAPABILITIES))],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function saveForms(OrgUnit|Position $entry, array $data, User $user): void
    {
        $verified = (bool) $data['verified'];
        unset($data['verified']);

        $entry->fill(array_map(fn ($value) => is_string($value) ? (trim($value) ?: null) : $value, $data));
        $entry->case_forms_verified_at = $verified ? ($entry->case_forms_verified_at ?? now()) : null;
        $entry->case_forms_verified_by = $verified ? ($entry->case_forms_verified_by ?? $user->id) : null;
        $entry->save();
    }

    private function activate(HrDocumentTemplate $template): void
    {
        HrDocumentTemplate::query()->where('type', $template->type)->whereKeyNot($template->id)->update(['is_active' => false]);
        $template->forceFill(['is_active' => true])->save();
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private function templates(): array
    {
        $result = array_fill_keys(array_keys(HrDocumentTemplate::TYPE_LABELS), []);

        HrDocumentTemplate::query()->with('uploader:id,name')->orderByDesc('version')->get()
            ->each(function (HrDocumentTemplate $template) use (&$result): void {
                $result[$template->type][] = [
                    'id' => $template->id,
                    'version' => $template->version,
                    'is_active' => $template->is_active,
                    'built_in' => $template->file_path === null,
                    'original_name' => $template->original_name,
                    'comment' => $template->comment,
                    'uploaded_by' => $template->uploader?->name,
                    'uploaded_at' => $template->created_at?->format('d.m.Y H:i'),
                    'download_url' => route('hr.hiring.settings.templates.download', $template),
                ];
            });

        return $result;
    }
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { buttonClassName, inputClassName, inputSizedClassName, Notice, VerifiedBadge } from '@/components/hr-hiring/ui';
import { DOCUMENT_TYPES } from '@/components/hr-hiring/logic';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { PageHeader, Segmented, UnderlineTabs } from '@/components/platform';
import axios from 'axios';
import { BookOpenCheck, Building2, Download, FileText, FileUp, Hash, KeyRound, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

const TABS = [
    { value: 'employer', label: 'Работодатель', icon: Building2 },
    { value: 'templates', label: 'Шаблоны', icon: FileUp },
    { value: 'catalog', label: 'Справочник', icon: BookOpenCheck },
    { value: 'rights', label: 'Права', icon: KeyRound },
];

const MULTILINE = ['legal_address_kz', 'legal_address_ru', 'visa_title_ru', 'visa_title_kz'];

export default function Settings(props) {
    const { abilities } = props;
    const [tab, setTab] = useState(TABS.some((item) => item.value === props.tab) ? props.tab : 'employer');
    const tabs = TABS.filter((item) => item.value !== 'rights' || abilities.rights);

    const select = (value) => {
        setTab(value);
        window.history.replaceState(window.history.state, '', route('hr.hiring.settings.index', { tab: value }));
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Отдел кадров · Приём на работу"
                    title="Настройки модуля"
                    description="Реквизиты работодателя и нумерация приказов, шаблоны документов, справочник подразделений и должностей, права сотрудников."
                    actions={<Link href={route('hr.hiring.index')} className={buttonClassName.secondary}>К списку приёмов</Link>}
                />
            )}
        >
            <Head title="Настройки приёма на работу" />
            <div className="admin-page-wrap space-y-6">
                <UnderlineTabs
                    items={tabs.map((item) => ({ key: item.value, label: item.label, icon: item.icon }))}
                    value={tab}
                    onChange={select}
                />
                {tab === 'employer' && (
                    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <EmployerTab {...props} />
                        <div className="xl:sticky xl:top-4">
                            <NumberingCard numbering={props.numbering} />
                        </div>
                    </div>
                )}
                {tab === 'templates' && <TemplatesTab {...props} />}
                {tab === 'catalog' && <CatalogTab {...props} />}
                {tab === 'rights' && abilities.rights && <RightsTab {...props} />}
            </div>
        </AuthenticatedLayout>
    );
}

function EmployerTab({ employer, employerFields }) {
    const form = useForm({ ...employer });

    const submit = (event) => {
        event.preventDefault();
        form.put(route('hr.hiring.settings.employer'), { preserveScroll: true });
    };

    return (
        <Panel as="form" onSubmit={submit} icon={Building2} title="Реквизиты работодателя" description="Реквизиты подставляются в преамбулу, раздел 11 договора и приказ. Перерыв — значение по умолчанию для новых договоров.">
            <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 2xl:grid-cols-3">
                {Object.entries(employerFields).map(([key, label]) => (
                    <div key={key} className={MULTILINE.includes(key) ? 'md:col-span-1' : ''}>
                        <label htmlFor={`employer-${key}`} className="qd-field-label mb-2 block text-[#102945]">{label}</label>
                        {MULTILINE.includes(key) ? (
                            <textarea id={`employer-${key}`} rows={2} value={form.data[key] ?? ''} onChange={(event) => form.setData(key, event.target.value)} className={inputClassName} />
                        ) : (
                            <input id={`employer-${key}`} value={form.data[key] ?? ''} onChange={(event) => form.setData(key, event.target.value)} className={inputClassName} />
                        )}
                        {form.errors[key] && <p className="mt-1.5 text-xs text-red-700">{form.errors[key]}</p>}
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">В многострочных полях перенос строки сохраняется в документе (как в образце договора).</p>
                <button type="submit" disabled={form.processing} className={buttonClassName.primary}>Сохранить</button>
            </div>
        </Panel>
    );
}

function NumberingCard({ numbering }) {
    const form = useForm({
        year: numbering?.year ?? numbering?.current_year,
        last_order_number: numbering?.year === numbering?.current_year ? (numbering?.last_order_number ?? '') : '',
    });

    const submit = (event) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, last_order_number: data.last_order_number === '' ? null : Number(data.last_order_number) }));
        form.put(route('hr.hiring.settings.numbering'), { preserveScroll: true });
    };

    return (
        <Panel
            as="form"
            onSubmit={submit}
            icon={Hash}
            title="Нумерация приказов «-К»"
            description="Другие приказы «-К» нумеруются вне системы. Укажите последний выданный номер — подсказка номера приказа о приёме продолжит с него. Номер действует для указанного года; с 1 января счёт начинается заново."
        >
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label htmlFor="numbering-year" className="qd-field-label mb-2 block text-[#102945]">Год</label>
                    <input id="numbering-year" type="number" value={form.data.year ?? ''} onChange={(event) => form.setData('year', event.target.value === '' ? '' : Number(event.target.value))} className={`${inputSizedClassName} w-24`} />
                </div>
                <div>
                    <label htmlFor="numbering-last" className="qd-field-label mb-2 block text-[#102945]">Последний номер вне системы</label>
                    <div className="flex items-center gap-2">
                        <input id="numbering-last" inputMode="numeric" value={form.data.last_order_number} onChange={(event) => form.setData('last_order_number', event.target.value.replace(/\D/g, ''))} placeholder="например, 415" className={`${inputSizedClassName} w-40 font-mono`} />
                        <span className="font-mono text-sm font-semibold text-slate-600">-К</span>
                    </div>
                </div>
                <button type="submit" disabled={form.processing} className={buttonClassName.secondary}>Сохранить</button>
            </div>
            {(form.errors.year || form.errors.last_order_number) && <p className="text-xs text-red-700">{form.errors.year ?? form.errors.last_order_number}</p>}
        </Panel>
    );
}

function TemplatesTab({ templates }) {
    const form = useForm({ type: 'contract', file: null, comment: '', activate: false });
    const problems = (form.errors.file ?? '').split('\n').filter(Boolean);
    // A new key empties the file input after an upload (form.reset only clears the data).
    const [fileKey, setFileKey] = useState(0);

    const submit = (event) => {
        event.preventDefault();
        form.post(route('hr.hiring.settings.templates.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset('file', 'comment', 'activate');
                setFileKey((key) => key + 1);
            },
        });
    };

    const activate = (template) => {
        if (window.confirm(`Сделать активной версию ${template.version}? Новые документы будут формироваться по ней.`)) {
            router.post(route('hr.hiring.settings.templates.activate', template.id), {}, { preserveScroll: true });
        }
    };

    return (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="space-y-4">
                {DOCUMENT_TYPES.map((type) => (
                    <Panel key={type.value} icon={FileText} title={type.label} flush>
                        <ul className="divide-y divide-slate-200 text-sm">
                            {(templates[type.value] ?? []).map((template) => (
                                <li key={template.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                                    <span className="min-w-0">
                                        <span className="font-semibold text-slate-900">Версия {template.version}</span>
                                        {template.is_active && <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">активна</span>}
                                        <span className="block text-xs text-slate-500">
                                            {template.built_in ? 'встроенный шаблон' : `${template.original_name} · ${template.uploaded_by ?? '—'} · ${template.uploaded_at}`}
                                            {template.comment && !template.built_in && ` · ${template.comment}`}
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <a href={template.download_url} className={buttonClassName.ghost}><Download className="h-4 w-4" />скачать</a>
                                        {!template.is_active && (
                                            <button type="button" onClick={() => activate(template)} className={buttonClassName.ghost}>
                                                Сделать активной
                                            </button>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                ))}
            </div>
            <Panel
                as="form"
                onSubmit={submit}
                icon={FileUp}
                title="Загрузить новую версию"
                description="Скачайте текущую версию, измените её в Word и загрузите. Система проверит теги; шаблон с ошибками не принимается. Список тегов — в инструкции ОУП (docs/hr-module/README-ОУП.md)."
                className="xl:sticky xl:top-4"
            >
                <span className="qd-field-label -mb-2 block text-[#102945]">Документ</span>
                <select value={form.data.type} onChange={(event) => form.setData('type', event.target.value)} className={inputClassName} aria-label="Документ">
                    {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <input key={fileKey} type="file" accept=".docx" onChange={(event) => form.setData('file', event.target.files?.[0] ?? null)} className="block w-full rounded-[10px] border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 file:mr-3 file:rounded-[8px] file:border-0 file:bg-teal-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:tracking-[0.08em] file:text-white hover:file:bg-[#102945]" aria-label="Файл шаблона .docx" />
                {form.errors.type && <p className="text-xs text-red-700">{form.errors.type}</p>}
                <input value={form.data.comment} onChange={(event) => form.setData('comment', event.target.value)} placeholder="Комментарий (что изменено)" className={inputClassName} maxLength={255} aria-label="Комментарий" />
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={form.data.activate} onChange={(event) => form.setData('activate', event.target.checked)} className="h-4 w-4 rounded-[4px] border-slate-300 text-teal-700 focus:ring-teal-600/30" />
                    Сразу сделать активной
                </label>
                {problems.length > 0 && (
                    <Notice tone="error">
                        <p className="mb-1 font-medium">Шаблон не принят:</p>
                        <ul className="list-disc space-y-0.5 pl-4">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                    </Notice>
                )}
                <div className="border-t border-slate-200 pt-4">
                    <button type="submit" disabled={!form.data.file || form.processing} className={buttonClassName.primary}><FileUp className="h-4 w-4" /> Загрузить и проверить</button>
                </div>
            </Panel>
        </div>
    );
}

function CatalogTab({ units, positions, categories, abilities }) {
    const [kind, setKind] = useState('units');
    const [query, setQuery] = useState('');
    const [onlyUnverified, setOnlyUnverified] = useState(false);
    const rows = kind === 'units' ? units : positions;
    const filtered = useMemo(() => rows.filter((row) => (!onlyUnverified || !row.verified) && row.name.toLowerCase().includes(query.trim().toLowerCase())), [rows, onlyUnverified, query]);
    const unverifiedCount = rows.filter((row) => !row.verified).length;

    return (
        <Panel icon={BookOpenCheck} title="Справочник подразделений и должностей">
            {!abilities.catalog && <Notice icon={ShieldCheck}>Изменять формы и пополнять справочник могут сотрудники с отдельным правом. Вы видите справочник только для чтения.</Notice>}
            <div className="flex flex-wrap items-center gap-3">
                <Segmented
                    items={[{ key: 'units', label: 'Подразделения' }, { key: 'positions', label: 'Должности' }]}
                    value={kind}
                    onChange={setKind}
                />
                <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" className={`${inputSizedClassName} w-64 max-w-full pl-9`} />
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={onlyUnverified} onChange={(event) => setOnlyUnverified(event.target.checked)} className="h-4 w-4 rounded-[4px] border-slate-300 text-teal-700 focus:ring-teal-600/30" />
                    Только непроверенные ({unverifiedCount})
                </label>
            </div>
            <p className="text-xs text-slate-500">
                Формы, заполненные автоматически, отмечены «не проверены ОУП» — у документа с ними будет предупреждение. Проверьте написание и отметьте «Проверено».
            </p>
            <div className="divide-y divide-slate-200 border-t border-slate-200">
                {filtered.map((row) => (
                    <CatalogRow key={`${kind}-${row.id}`} kind={kind} row={row} categories={categories} editable={abilities.catalog} />
                ))}
                {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Ничего не найдено.</p>}
            </div>
            {kind === 'positions' && abilities.catalog && <NewPosition categories={categories} />}
        </Panel>
    );
}

function CatalogRow({ kind, row, categories, editable }) {
    const isUnit = kind === 'units';
    const fields = isUnit
        ? [['name_ru_gen', 'Род. падеж (рус.)', 'кафедры «Менеджмент»'], ['name_kz_gen', 'Форма на казахском', '«Менеджмент» кафедрасының']]
        : [['name_ru_gen', 'Род. падеж (рус.)', 'старшего преподавателя'], ['name_kz_poss', 'Форма на казахском', 'аға оқытушысы']];
    const form = useForm({
        name_ru_gen: row.name_ru_gen ?? '',
        name_kz: row.name_kz ?? '',
        [isUnit ? 'name_kz_gen' : 'name_kz_poss']: row[isUnit ? 'name_kz_gen' : 'name_kz_poss'] ?? '',
        ...(isUnit ? {} : { staff_category: row.staff_category ?? '' }),
        verified: row.verified,
    });

    const save = (verified) => {
        form.transform((data) => ({ ...data, verified }));
        form.put(route(isUnit ? 'hr.hiring.settings.units.update' : 'hr.hiring.settings.positions.update', row.id), { preserveScroll: true });
    };

    return (
        <div className="grid gap-3 py-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] lg:items-center">
            <div className="min-w-0">
                <p className="font-semibold text-slate-900">{row.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {isUnit ? [row.type_label, row.parent].filter(Boolean).join(' · ') : (categories[row.staff_category] ?? 'без категории')}
                    <VerifiedBadge verified={row.verified} />
                </p>
            </div>
            <div className={`grid gap-2 ${isUnit ? 'sm:grid-cols-2' : 'sm:grid-cols-[6rem_1fr_1fr]'}`}>
                {!isUnit && (
                    <select disabled={!editable} value={form.data.staff_category} onChange={(event) => form.setData('staff_category', event.target.value)} className={inputClassName} aria-label="Категория">
                        <option value="">—</option>
                        {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                )}
                {fields.map(([key, label, placeholder]) => (
                    <input key={key} disabled={!editable} value={form.data[key]} onChange={(event) => form.setData(key, event.target.value)} placeholder={placeholder} title={label} aria-label={label}
                        className={`${inputClassName} ${!form.data[key] ? 'border-amber-300 bg-amber-50' : ''}`} />
                ))}
            </div>
            {editable && (
                <div className="flex gap-2">
                    <button type="button" disabled={form.processing} onClick={() => save(row.verified)} className={buttonClassName.secondary}>Сохранить</button>
                    {!row.verified && <button type="button" disabled={form.processing} onClick={() => save(true)} className={buttonClassName.primary}>Проверено</button>}
                </div>
            )}
        </div>
    );
}

function NewPosition({ categories }) {
    const form = useForm({ name: '', staff_category: 'aup', name_ru_gen: '', name_kz_poss: '' });

    const submit = (event) => {
        event.preventDefault();
        form.post(route('hr.hiring.settings.positions.store'), { preserveScroll: true, onSuccess: () => form.reset() });
    };

    return (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 p-4">
            <p className="qd-kicker">Новая должность</p>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_6rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Название" className={inputClassName} aria-label="Название должности" />
                <select value={form.data.staff_category} onChange={(event) => form.setData('staff_category', event.target.value)} className={inputClassName} aria-label="Категория">
                    {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input value={form.data.name_ru_gen} onChange={(event) => form.setData('name_ru_gen', event.target.value)} placeholder="Род. падеж (рус.)" className={inputClassName} aria-label="Родительный падеж (рус.)" />
                <input value={form.data.name_kz_poss} onChange={(event) => form.setData('name_kz_poss', event.target.value)} placeholder="Форма на казахском" className={inputClassName} aria-label="Форма на казахском" />
                <button type="submit" disabled={form.processing || form.data.name.trim() === ''} className={buttonClassName.primary}>Добавить</button>
            </div>
            {Object.values(form.errors).map((message) => <p key={message} className="text-xs text-red-700">{message}</p>)}
        </form>
    );
}

function RightsTab({ members, capabilities }) {
    const [query, setQuery] = useState('');
    const [found, setFound] = useState([]);
    const [searchState, setSearchState] = useState({ status: 'idle', message: '' });
    const [saving, setSaving] = useState(null);

    const search = async (event) => {
        event.preventDefault();
        if (query.trim().length < 2) {
            setSearchState({ status: 'error', message: 'Введите хотя бы 2 символа.' });
            return;
        }
        setSearchState({ status: 'loading', message: '' });
        try {
            const { data } = await axios.get(route('hr.hiring.settings.users', { q: query.trim() }));
            const items = data.items ?? [];
            setFound(items);
            setSearchState(items.length ? { status: 'idle', message: '' } : { status: 'error', message: 'Никого не нашли. Проверьте ФИО или e-mail.' });
        } catch {
            setSearchState({ status: 'error', message: 'Поиск не удался. Попробуйте ещё раз.' });
        }
    };

    const toggle = (userId, capability, granted) => {
        if (saving) {
            return;
        }
        const payload = { user_id: userId, capability };
        const options = { preserveScroll: true, onFinish: () => setSaving(null) };
        setSaving(`${userId}:${capability}`);
        granted
            ? router.delete(route('hr.hiring.settings.rights.revoke'), { data: payload, ...options })
            : router.post(route('hr.hiring.settings.rights.grant'), payload, options);
    };

    const rows = [...members, ...found.filter((user) => !members.some((member) => member.id === user.id)).map((user) => ({ ...user, rights: [] }))];

    return (
        <Panel icon={KeyRound} title="Права сотрудников">
            <Notice>
                Модуль открыт роли «Отдел кадров» и администраторам. Любому другому пользователю его открывает право «Доступ к модулю» —
                роль при этом не меняется, модуль просто добавляется в его меню. Остальные права действуют только вместе с доступом;
                у администраторов они есть всегда.
            </Notice>
            <form onSubmit={search} className="flex flex-wrap items-end gap-2">
                <div className="w-full max-w-md">
                    <span className="qd-field-label mb-2 block text-[#102945]">Пользователь</span>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти пользователя: ФИО или e-mail" className={inputClassName} aria-label="Найти пользователя" />
                </div>
                <button type="submit" disabled={searchState.status === 'loading'} className={buttonClassName.secondary}><Search className="h-4 w-4" /> Найти</button>
                {searchState.message && <p className="w-full text-xs text-red-700">{searchState.message}</p>}
            </form>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                    <thead className="text-left">
                        <tr>
                            <th>Пользователь</th>
                            {Object.entries(capabilities).map(([key, label]) => <th key={key}>{label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <span className="flex items-center gap-2 font-medium text-slate-900"><UserRound className="h-4 w-4 text-teal-700" />{user.name}</span>
                                    <span className="block text-xs text-slate-500">{user.email} · роль: {user.role}{user.can_use_module === false && ' (модуль закрыт)'}</span>
                                </td>
                                {Object.keys(capabilities).map((capability) => {
                                    const granted = (user.rights ?? []).includes(capability);
                                    if (capability === 'hr.access' && user.role_access) {
                                        return (
                                            <td key={capability}>
                                                <label className="flex items-center gap-2" title="Модуль открыт ролью пользователя">
                                                    <input type="checkbox" checked disabled className="h-4 w-4 rounded-[4px] border-slate-300 text-teal-700 opacity-60" />
                                                    <span className="text-xs text-slate-600">по роли</span>
                                                </label>
                                            </td>
                                        );
                                    }
                                    return (
                                        <td key={capability}>
                                            <label className="flex items-center gap-2">
                                                <input type="checkbox" checked={granted} disabled={saving !== null} onChange={() => toggle(user.id, capability, granted)} className="h-4 w-4 rounded-[4px] border-slate-300 text-teal-700 focus:ring-teal-600/30 disabled:opacity-60" />
                                                <span className="text-xs text-slate-600">{granted ? 'выдано' : 'нет'}</span>
                                            </label>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={Object.keys(capabilities).length + 1} className="text-center text-slate-500">Сотрудников с доступом к модулю пока нет. Найдите пользователя выше.</td></tr>}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

/** Qadam card: strip header (spaced-capitals title, teal icon, optional description), padded body. */
function Panel({ as: Tag = 'section', icon: Icon, title, description = null, flush = false, className = '', children, ...props }) {
    return (
        <Tag className={`overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] ${className}`} {...props}>
            <header className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h3 className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[#102945]">
                    {Icon && <Icon className="h-4 w-4 text-teal-700" />}
                    {title}
                </h3>
                {description && <p className="mt-1 max-w-5xl text-xs leading-relaxed text-slate-600">{description}</p>}
            </header>
            <div className={flush ? '' : 'space-y-4 px-5 py-4'}>{children}</div>
        </Tag>
    );
}

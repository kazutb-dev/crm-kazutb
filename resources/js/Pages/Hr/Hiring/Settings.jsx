import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { buttonClassName, inputClassName, Notice, VerifiedBadge } from '@/components/hr-hiring/ui';
import { DOCUMENT_TYPES } from '@/components/hr-hiring/logic';
import { Head, Link, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import { BookOpenCheck, Building2, Download, FileUp, KeyRound, Search, ShieldCheck, UserRound } from 'lucide-react';
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
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">HR и учет · Приём на работу</p>
                        <h2 className="text-2xl font-semibold text-slate-900">Настройки модуля</h2>
                    </div>
                    <Link href={route('hr.hiring.index')} className={buttonClassName.secondary}>К списку приёмов</Link>
                </div>
            )}
        >
            <Head title="Настройки приёма на работу" />
            <div className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
                <div role="tablist" className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1 sm:w-fit">
                    {tabs.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            role="tab"
                            aria-selected={tab === item.value}
                            onClick={() => select(item.value)}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === item.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <item.icon className="h-4 w-4" /> {item.label}
                        </button>
                    ))}
                </div>
                {tab === 'employer' && <EmployerTab {...props} />}
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
        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Реквизиты подставляются в преамбулу, раздел 11 договора и приказ. Перерыв — значение по умолчанию для новых договоров.</p>
            <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(employerFields).map(([key, label]) => (
                    <div key={key} className={MULTILINE.includes(key) ? 'md:col-span-1' : ''}>
                        <label htmlFor={`employer-${key}`} className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
                        {MULTILINE.includes(key) ? (
                            <textarea id={`employer-${key}`} rows={2} value={form.data[key] ?? ''} onChange={(event) => form.setData(key, event.target.value)} className={inputClassName} />
                        ) : (
                            <input id={`employer-${key}`} value={form.data[key] ?? ''} onChange={(event) => form.setData(key, event.target.value)} className={inputClassName} />
                        )}
                        {form.errors[key] && <p className="mt-1 text-xs text-rose-600">{form.errors[key]}</p>}
                    </div>
                ))}
            </div>
            <p className="text-xs text-slate-500">В многострочных полях перенос строки сохраняется в документе (как в образце договора).</p>
            <button type="submit" disabled={form.processing} className={buttonClassName.primary}>Сохранить</button>
        </form>
    );
}

function TemplatesTab({ templates }) {
    const form = useForm({ type: 'contract', file: null, comment: '', activate: false });
    const problems = (form.errors.file ?? '').split('\n').filter(Boolean);

    const submit = (event) => {
        event.preventDefault();
        form.post(route('hr.hiring.settings.templates.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset('file', 'comment', 'activate'),
        });
    };

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
                {DOCUMENT_TYPES.map((type) => (
                    <section key={type.value} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h3 className="mb-3 font-semibold text-slate-900">{type.label}</h3>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {(templates[type.value] ?? []).map((template) => (
                                <li key={template.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                    <span className="min-w-0">
                                        <span className="font-medium text-slate-800">Версия {template.version}</span>
                                        {template.is_active && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">активна</span>}
                                        <span className="block text-xs text-slate-500">
                                            {template.built_in ? 'встроенный шаблон' : `${template.original_name} · ${template.uploaded_by ?? '—'} · ${template.uploaded_at}`}
                                            {template.comment && !template.built_in && ` · ${template.comment}`}
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <a href={template.download_url} className={buttonClassName.ghost}><Download className="h-4 w-4" />скачать</a>
                                        {!template.is_active && (
                                            <button type="button" onClick={() => router.post(route('hr.hiring.settings.templates.activate', template.id), {}, { preserveScroll: true })} className={buttonClassName.ghost}>
                                                Сделать активной
                                            </button>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
            <form onSubmit={submit} className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Загрузить новую версию</h3>
                <p className="text-sm text-slate-600">
                    Скачайте текущую версию, измените её в Word и загрузите. Система проверит теги; шаблон с ошибками не принимается.
                    Список тегов — в инструкции ОУП (docs/hr-module/README-ОУП.md).
                </p>
                <select value={form.data.type} onChange={(event) => form.setData('type', event.target.value)} className={inputClassName}>
                    {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <input type="file" accept=".docx" onChange={(event) => form.setData('file', event.target.files?.[0] ?? null)} className="block w-full text-sm" />
                <input value={form.data.comment} onChange={(event) => form.setData('comment', event.target.value)} placeholder="Комментарий (что изменено)" className={inputClassName} maxLength={255} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.data.activate} onChange={(event) => form.setData('activate', event.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    Сразу сделать активной
                </label>
                {problems.length > 0 && (
                    <Notice tone="error">
                        <p className="mb-1 font-medium">Шаблон не принят:</p>
                        <ul className="list-disc space-y-0.5 pl-4">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                    </Notice>
                )}
                <button type="submit" disabled={!form.data.file || form.processing} className={buttonClassName.primary}><FileUp className="h-4 w-4" /> Загрузить и проверить</button>
            </form>
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
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {!abilities.catalog && <Notice icon={ShieldCheck}>Изменять формы и пополнять справочник могут сотрудники с отдельным правом. Вы видите справочник только для чтения.</Notice>}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                    {[['units', 'Подразделения'], ['positions', 'Должности']].map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-lg px-3 py-1.5 text-sm ${kind === value ? 'bg-white shadow-sm' : 'text-slate-600'}`}>{label}</button>
                    ))}
                </div>
                <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" className={`${inputClassName} w-64 pl-9`} />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={onlyUnverified} onChange={(event) => setOnlyUnverified(event.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    Только непроверенные ({unverifiedCount})
                </label>
            </div>
            <p className="text-xs text-slate-500">
                Формы, заполненные автоматически, отмечены «не проверены ОУП» — у документа с ними будет предупреждение. Проверьте написание и отметьте «Проверено».
            </p>
            <div className="divide-y divide-slate-100">
                {filtered.map((row) => (
                    <CatalogRow key={`${kind}-${row.id}`} kind={kind} row={row} categories={categories} editable={abilities.catalog} />
                ))}
                {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Ничего не найдено.</p>}
            </div>
            {kind === 'positions' && abilities.catalog && <NewPosition categories={categories} />}
        </section>
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
        <div className="grid gap-2 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] lg:items-end">
            <div className="min-w-0">
                <p className="font-medium text-slate-900">{row.name}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                        className={`${inputClassName} ${!form.data[key] ? 'border-amber-300 bg-amber-50/60' : ''}`} />
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
        <form onSubmit={submit} className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-4">
            <p className="text-sm font-medium text-slate-800">Новая должность</p>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_6rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Название" className={inputClassName} />
                <select value={form.data.staff_category} onChange={(event) => form.setData('staff_category', event.target.value)} className={inputClassName}>
                    {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input value={form.data.name_ru_gen} onChange={(event) => form.setData('name_ru_gen', event.target.value)} placeholder="Род. падеж (рус.)" className={inputClassName} />
                <input value={form.data.name_kz_poss} onChange={(event) => form.setData('name_kz_poss', event.target.value)} placeholder="Форма на казахском" className={inputClassName} />
                <button type="submit" disabled={form.processing} className={buttonClassName.primary}>Добавить</button>
            </div>
            {Object.values(form.errors).map((message) => <p key={message} className="text-xs text-rose-600">{message}</p>)}
        </form>
    );
}

function RightsTab({ members, capabilities }) {
    const [query, setQuery] = useState('');
    const [found, setFound] = useState([]);

    const search = async (event) => {
        event.preventDefault();
        if (query.trim().length < 2) {
            return;
        }
        const { data } = await axios.get(route('hr.hiring.settings.users', { q: query.trim() }));
        setFound(data.items ?? []);
    };

    const toggle = (userId, capability, granted) => {
        const payload = { user_id: userId, capability };
        granted
            ? router.delete(route('hr.hiring.settings.rights.revoke'), { data: payload, preserveScroll: true })
            : router.post(route('hr.hiring.settings.rights.grant'), payload, { preserveScroll: true });
    };

    const rows = [...members, ...found.filter((user) => !members.some((member) => member.id === user.id)).map((user) => ({ ...user, rights: [] }))];

    return (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Notice>
                Модуль открыт роли «Отдел кадров» и администраторам. Роль назначается в разделе «Пользователи». Здесь — отдельные права модуля;
                у администраторов они есть всегда.
            </Notice>
            <form onSubmit={search} className="flex flex-wrap gap-2">
                <div className="w-full max-w-md">
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти пользователя: ФИО или e-mail" className={inputClassName} />
                </div>
                <button type="submit" className={buttonClassName.secondary}><Search className="h-4 w-4" /> Найти</button>
            </form>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="py-2 pr-4">Пользователь</th>
                            {Object.entries(capabilities).map(([key, label]) => <th key={key} className="px-3 py-2">{label}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((user) => (
                            <tr key={user.id}>
                                <td className="py-2 pr-4">
                                    <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" />{user.name}</span>
                                    <span className="block text-xs text-slate-500">{user.email} · роль: {user.role}{user.can_use_module === false && ' (нет доступа к модулю)'}</span>
                                </td>
                                {Object.keys(capabilities).map((capability) => {
                                    const granted = (user.rights ?? []).includes(capability);
                                    return (
                                        <td key={capability} className="px-3 py-2">
                                            <label className="flex items-center gap-2">
                                                <input type="checkbox" checked={granted} onChange={() => toggle(user.id, capability, granted)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                                                <span className="text-xs text-slate-600">{granted ? 'выдано' : 'нет'}</span>
                                            </label>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-500">Сотрудников с ролью «Отдел кадров» пока нет. Найдите пользователя выше.</td></tr>}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DocumentPills, buttonClassName, inputClassName, StatusBadge } from '@/components/hr-hiring/ui';
import { FilterBar, PageHeader, StatGrid, StatTile, underlineTabClass } from '@/components/platform';
import { Head, Link, router } from '@inertiajs/react';
import { Ban, CheckCircle2, ChevronRight, FilePen, FileSignature, FlaskConical, LoaderCircle, Search, Settings2, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SEARCH_DELAY_MS = 450;

const STATUS_TABS = [
    { value: '', label: 'Все', countKey: 'all' },
    { value: 'draft', label: 'Черновики', countKey: 'draft' },
    { value: 'signed', label: 'Подписаны', countKey: 'signed' },
    { value: 'cancelled', label: 'Отменены', countKey: 'cancelled' },
];

const EMPTY_FILTERS = { q: '', status: '', unit: '', date_from: '', date_to: '' };

/** Laravel's «&laquo; Previous» / «Next &raquo;» as plain text. */
const paginationLabel = (label) => {
    if (label.includes('Previous') || label.includes('&laquo;')) {
        return '‹ Назад';
    }
    if (label.includes('Next') || label.includes('&raquo;')) {
        return 'Вперёд ›';
    }
    return label;
};

/** A draft opens in the form to continue filling it in, anything else in the hiring card. */
const rowUrl = (row) => (row.status === 'draft' ? route('hr.hiring.edit', row.id) : route('hr.hiring.show', row.id));

export default function Index({ hirings, counts = {}, filters, units = [], abilities = {} }) {
    const [form, setForm] = useState(() => ({ ...EMPTY_FILTERS, ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value ?? ''])) }));
    const rows = hirings?.data ?? [];
    const searchTimer = useRef(null);
    const hasFilters = Boolean(form.q || form.unit || form.date_from || form.date_to);

    const apply = (next) => {
        const query = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== '' && value !== null));
        router.get(route('hr.hiring.index'), query, { preserveState: true, preserveScroll: true, replace: true });
    };

    const change = (key, value) => {
        const next = { ...form, [key]: value };
        setForm(next);
        window.clearTimeout(searchTimer.current);
        if (key === 'q') {
            searchTimer.current = window.setTimeout(() => apply(next), SEARCH_DELAY_MS);
        } else {
            apply(next);
        }
    };

    useEffect(() => () => window.clearTimeout(searchTimer.current), []);

    const resetFilters = () => {
        const next = { ...EMPTY_FILTERS, status: form.status };
        setForm(next);
        apply(next);
    };

    // A double click must not create two drafts: one request at a time.
    const [creating, setCreating] = useState(null);
    const post = (kind, url) => {
        if (creating) {
            return;
        }
        setCreating(kind);
        router.post(url, {}, { onFinish: () => setCreating(null) });
    };
    const create = () => post('hiring', route('hr.hiring.store'));
    const createDemo = () => post('demo', route('hr.hiring.demo.store'));

    /** Drafts only: files go at once, the record after 30 days (see HiringCleanup). */
    const removeDraft = (row) => {
        if (window.confirm(`Удалить черновик «${row.full_name}»? Сформированные документы, фото и сканы удалятся сразу.`)) {
            router.delete(route('hr.hiring.destroy', row.id), { preserveScroll: true });
        }
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Кадры"
                    title="Приём на работу"
                    description="Данные сотрудника вводятся один раз — из них собираются трудовой договор, приказ о приёме и личная карточка."
                    actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link href={route('hr.hiring.settings.index')} className={buttonClassName.secondary}>
                            <Settings2 className="h-4 w-4" /> Настройки
                        </Link>
                        {abilities.rights && (
                            <button type="button" onClick={createDemo} disabled={creating !== null} className={buttonClassName.secondary} title="Черновик с выдуманными данными для проверки документов (видят только администраторы)">
                                {creating === 'demo' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Демо-приём
                            </button>
                        )}
                        <button type="button" onClick={create} disabled={creating !== null} className={`${buttonClassName.primary} px-5`}>
                            {creating === 'hiring' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Новый приём
                        </button>
                    </div>
                    )}
                />
            )}
        >
            <Head title="Приём на работу" />
            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего приёмов" value={counts.all ?? 0} tone="navy" icon={Users} hint="Все записи модуля, кроме удалённых черновиков" />
                    <StatTile label="Черновики" value={counts.draft ?? 0} tone="warning" icon={FilePen} hint="Данные ещё заполняются" />
                    <StatTile label="Подписаны" value={counts.signed ?? 0} tone="success" icon={CheckCircle2} hint="Документы подписаны" />
                    <StatTile label="Отменены" value={counts.cancelled ?? 0} tone="neutral" icon={Ban} hint="Приём не состоялся" />
                </StatGrid>

                <nav className="flex gap-x-6 overflow-x-auto border-b border-slate-200" aria-label="Статус приёма">
                        {STATUS_TABS.filter((tab) => tab.value !== 'cancelled' || counts.cancelled > 0 || form.status === 'cancelled').map((tab) => {
                            const active = form.status === tab.value;
                            return (
                                <button
                                    key={tab.value || 'all'}
                                    type="button"
                                    onClick={() => change('status', tab.value)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`${underlineTabClass(active)} shrink-0`}
                                >
                                    {tab.label}
                                    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {counts[tab.countKey] ?? 0}
                                    </span>
                                </button>
                            );
                        })}
                </nav>

                <FilterBar>
                    <form
                        onSubmit={(event) => { event.preventDefault(); window.clearTimeout(searchTimer.current); apply(form); }}
                        className="grid items-end gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]"
                    >
                        <label className="block">
                            <span className="qd-field-label mb-2 block">Поиск</span>
                            <span className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={form.q}
                                    onChange={(event) => change('q', event.target.value)}
                                    placeholder="Фамилия, имя или ИИН (12 цифр)"
                                    className={`${inputClassName} pl-9`}
                                />
                            </span>
                        </label>
                        <label className="block">
                            <span className="qd-field-label mb-2 block">Подразделение</span>
                            <select value={form.unit} onChange={(event) => change('unit', event.target.value)} className={inputClassName}>
                                <option value="">Все подразделения</option>
                                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                            </select>
                        </label>
                        <fieldset>
                            <legend className="qd-field-label mb-2 block">Дата приёма</legend>
                            <div className="flex items-center gap-2">
                                <input type="date" value={form.date_from} onChange={(event) => change('date_from', event.target.value)} className={inputClassName} aria-label="Дата приёма с" />
                                <span className="text-slate-400">—</span>
                                <input type="date" value={form.date_to} onChange={(event) => change('date_to', event.target.value)} className={inputClassName} aria-label="Дата приёма по" />
                            </div>
                        </fieldset>
                        {hasFilters && (
                            <div className="flex items-center md:h-10">
                                <button type="button" onClick={resetFilters} className={buttonClassName.secondary}>
                                    <X className="h-4 w-4" /> Сбросить
                                </button>
                            </div>
                        )}
                    </form>
                </FilterBar>

                <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(25,28,29,0.04)]">

                    {rows.length === 0 ? (
                        <EmptyState noHirings={(counts.all ?? 0) === 0 && !hasFilters} onCreate={create} creating={creating !== null} onReset={resetFilters} />
                    ) : (
                        <>
                            <table className="hidden min-w-full text-sm md:table">
                                <thead className="text-left">
                                    <tr className="border-b border-slate-200">
                                        <th className="px-5 py-3">Сотрудник</th>
                                        <th className="px-4 py-3">Должность</th>
                                        <th className="px-4 py-3">Дата приёма</th>
                                        <th className="px-4 py-3">Документы</th>
                                        <th className="px-4 py-3">Статус</th>
                                        <th className="px-5 py-3"><span className="sr-only">Действие</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {rows.map((row) => (
                                        <tr key={row.id} className="group cursor-pointer transition-colors hover:bg-slate-50" onClick={() => router.visit(rowUrl(row))}>
                                            <td className="px-5 py-3.5 align-top">
                                                <Link href={rowUrl(row)} onClick={(event) => event.stopPropagation()} className="font-semibold text-slate-900 group-hover:text-teal-700">
                                                    {row.full_name}
                                                </Link>
                                                <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                                                    {row.iin_masked ? <>ИИН <span className="font-mono">{row.iin_masked}</span></> : 'ИИН не указан'}
                                                    {row.id_card_masked && <> · уд. <span className="font-mono">{row.id_card_masked}</span></>}
                                                </div>
                                            </td>
                                            <td className="max-w-xs px-4 py-3.5 align-top">
                                                <div className="text-slate-800">{row.position || <span className="text-slate-400">не выбрана</span>}</div>
                                                {row.unit && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{row.unit}</div>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 align-top tabular-nums text-slate-700">
                                                {row.start_date || <span className="text-slate-400">—</span>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 align-top">
                                                <DocumentPills documents={row.documents} />
                                                <Numbers row={row} />
                                            </td>
                                            <td className="px-4 py-3.5 align-top"><StatusBadge status={row.status} label={row.status_label} /></td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right align-top">
                                                <span className="inline-flex items-center gap-3">
                                                    {row.status === 'draft' && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => { event.stopPropagation(); removeDraft(row); }}
                                                            className="rounded-[10px] p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700"
                                                            title="Удалить черновик"
                                                            aria-label={`Удалить черновик «${row.full_name}»`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.08em] text-teal-700 group-hover:text-[#102945]">
                                                        {row.status === 'draft' ? 'Продолжить' : 'Открыть'} <ChevronRight className="h-4 w-4" />
                                                    </span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <ul className="divide-y divide-slate-200 md:hidden">
                                {rows.map((row) => (
                                    <li key={row.id}>
                                        <Link href={rowUrl(row)} className="block space-y-2 px-4 py-3 active:bg-slate-50">
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="font-semibold text-slate-900">{row.full_name}</span>
                                                <StatusBadge status={row.status} label={row.status_label} />
                                            </div>
                                            <div className="text-sm text-slate-700">
                                                {row.position || 'Должность не выбрана'}
                                                {row.unit && <span className="block text-xs text-slate-500">{row.unit}</span>}
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                                <DocumentPills documents={row.documents} />
                                                <span>{row.start_date ? `с ${row.start_date}` : 'дата приёма не указана'}</span>
                                            </div>
                                        </Link>
                                        {row.status === 'draft' && (
                                            <button type="button" onClick={() => removeDraft(row)} className="mx-4 mb-3 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                                                <Trash2 className="h-3.5 w-3.5" /> Удалить черновик
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
                                <span>
                                    Показаны {hirings.from}–{hirings.to} из {hirings.total}. Документы: серый — ещё не сформирован, синий — сформирован, зелёный — подписан.
                                </span>
                                {hirings?.links?.length > 3 && (
                                    <nav className="flex flex-wrap items-center gap-1">
                                        {hirings.links.map((link, index) => (
                                            <Link
                                                key={`${link.label}-${index}`}
                                                href={link.url ?? ''}
                                                preserveScroll
                                                disabled={!link.url}
                                                className={`rounded-[10px] px-3 py-1.5 text-sm font-medium tabular-nums ${link.active ? 'bg-teal-700 text-white' : link.url ? 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-[#102945]' : 'pointer-events-none text-slate-300'}`}
                                            >
                                                {paginationLabel(link.label)}
                                            </Link>
                                        ))}
                                    </nav>
                                )}
                            </footer>
                        </>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Numbers({ row }) {
    if (!row.contract_number && !row.order_number) {
        return null;
    }

    return (
        <div className="mt-1.5 text-xs text-slate-500">
            {row.contract_number && <>договор №{row.contract_number}</>}
            {row.contract_number && row.order_number && ' · '}
            {row.order_number && <>приказ {row.order_number}</>}
        </div>
    );
}

function EmptyState({ noHirings, onCreate, creating, onReset }) {
    if (!noHirings) {
        return (
            <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700"><Search className="h-7 w-7" /></span>
                <p className="font-display text-lg font-bold text-[#102945]">Ничего не найдено</p>
                <p className="mt-1 max-w-md text-sm text-slate-600">Измените условия поиска. ИИН ищется только по полному номеру — 12 цифр.</p>
                <button type="button" onClick={onReset} className={`${buttonClassName.secondary} mt-4`}>Сбросить фильтры</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700"><FileSignature className="h-7 w-7" /></span>
            <p className="font-display text-xl font-bold text-[#102945]">Приёмов пока нет</p>
            <ol className="mx-auto mt-5 grid w-full max-w-2xl gap-3 text-left text-sm text-slate-700 sm:grid-cols-3">
                {['Нажмите «Новый приём» и заполните данные сотрудника', 'Выберите должность и условия договора', 'Скачайте договор, приказ и личную карточку'].map((text, index) => (
                    <li key={text} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-700 font-display text-sm font-bold text-white">{index + 1}</span>
                        {text}
                    </li>
                ))}
            </ol>
            <button type="button" onClick={onCreate} disabled={creating} className={`${buttonClassName.primary} mt-6 px-5`}>
                <UserPlus className="h-4 w-4" /> Оформить первый приём
            </button>
        </div>
    );
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DocumentPills, buttonClassName, inputClassName, StatusBadge } from '@/components/hr-hiring/ui';
import { Head, Link, router } from '@inertiajs/react';
import { ChevronRight, FileSignature, Search, Settings2, UserPlus, X } from 'lucide-react';
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

export default function Index({ hirings, counts = {}, filters, units = [] }) {
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

    const create = () => router.post(route('hr.hiring.store'));

    return (
        <AuthenticatedLayout>
            <Head title="Приём на работу" />
            <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl font-semibold text-slate-900">Приём на работу</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Данные сотрудника вводятся один раз — из них собираются трудовой договор, приказ о приёме и личная карточка.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href={route('hr.hiring.settings.index')} className={buttonClassName.secondary}>
                            <Settings2 className="h-4 w-4" /> Настройки
                        </Link>
                        <button type="button" onClick={create} className={`${buttonClassName.primary} px-5`}>
                            <UserPlus className="h-4 w-4" /> Новый приём
                        </button>
                    </div>
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3" aria-label="Статус приёма">
                        {STATUS_TABS.filter((tab) => tab.value !== 'cancelled' || counts.cancelled > 0 || form.status === 'cancelled').map((tab) => {
                            const active = form.status === tab.value;
                            return (
                                <button
                                    key={tab.value || 'all'}
                                    type="button"
                                    onClick={() => change('status', tab.value)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${active ? 'border-teal-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                >
                                    {tab.label}
                                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
                                        {counts[tab.countKey] ?? 0}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>

                    <form
                        onSubmit={(event) => { event.preventDefault(); window.clearTimeout(searchTimer.current); apply(form); }}
                        className="grid items-end gap-3 border-b border-slate-100 bg-slate-50/60 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]"
                    >
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">Поиск</span>
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
                            <span className="mb-1 block text-sm font-medium text-slate-700">Подразделение</span>
                            <select value={form.unit} onChange={(event) => change('unit', event.target.value)} className={inputClassName}>
                                <option value="">Все подразделения</option>
                                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                            </select>
                        </label>
                        <fieldset>
                            <legend className="mb-1 block text-sm font-medium text-slate-700">Дата приёма</legend>
                            <div className="flex items-center gap-2">
                                <input type="date" value={form.date_from} onChange={(event) => change('date_from', event.target.value)} className={inputClassName} aria-label="Дата приёма с" />
                                <span className="text-slate-400">—</span>
                                <input type="date" value={form.date_to} onChange={(event) => change('date_to', event.target.value)} className={inputClassName} aria-label="Дата приёма по" />
                            </div>
                        </fieldset>
                        {hasFilters && (
                            <div className="flex items-center md:h-[42px]">
                                <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
                                    <X className="h-4 w-4" /> Сбросить
                                </button>
                            </div>
                        )}
                    </form>

                    {rows.length === 0 ? (
                        <EmptyState noHirings={(counts.all ?? 0) === 0 && !hasFilters} onCreate={create} onReset={resetFilters} />
                    ) : (
                        <>
                            <table className="hidden min-w-full text-sm md:table">
                                <thead className="text-left text-xs font-medium text-slate-500">
                                    <tr className="border-b border-slate-100">
                                        <th className="px-4 py-3 font-medium">Сотрудник</th>
                                        <th className="px-4 py-3 font-medium">Должность</th>
                                        <th className="px-4 py-3 font-medium">Дата приёма</th>
                                        <th className="px-4 py-3 font-medium">Документы</th>
                                        <th className="px-4 py-3 font-medium">Статус</th>
                                        <th className="px-4 py-3"><span className="sr-only">Действие</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row) => (
                                        <tr key={row.id} className="group cursor-pointer transition hover:bg-teal-50/40" onClick={() => router.visit(rowUrl(row))}>
                                            <td className="px-4 py-3 align-top">
                                                <Link href={rowUrl(row)} onClick={(event) => event.stopPropagation()} className="font-medium text-slate-900 group-hover:text-teal-800">
                                                    {row.full_name}
                                                </Link>
                                                <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                                                    {row.iin_masked ? <>ИИН <span className="font-mono">{row.iin_masked}</span></> : 'ИИН не указан'}
                                                    {row.id_card_masked && <> · уд. <span className="font-mono">{row.id_card_masked}</span></>}
                                                </div>
                                            </td>
                                            <td className="max-w-xs px-4 py-3 align-top">
                                                <div className="text-slate-800">{row.position || <span className="text-slate-400">не выбрана</span>}</div>
                                                {row.unit && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{row.unit}</div>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 align-top text-slate-700">
                                                {row.start_date || <span className="text-slate-400">—</span>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 align-top">
                                                <DocumentPills documents={row.documents} />
                                                <Numbers row={row} />
                                            </td>
                                            <td className="px-4 py-3 align-top"><StatusBadge status={row.status} label={row.status_label} /></td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                                                <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 group-hover:text-teal-900">
                                                    {row.status === 'draft' ? 'Продолжить' : 'Открыть'} <ChevronRight className="h-4 w-4" />
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <ul className="divide-y divide-slate-100 md:hidden">
                                {rows.map((row) => (
                                    <li key={row.id}>
                                        <Link href={rowUrl(row)} className="block space-y-2 px-4 py-3 active:bg-slate-50">
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="font-medium text-slate-900">{row.full_name}</span>
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
                                    </li>
                                ))}
                            </ul>

                            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
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
                                                className={`rounded-lg px-3 py-1.5 text-sm ${link.active ? 'bg-slate-900 text-white' : link.url ? 'text-slate-700 hover:bg-slate-100' : 'pointer-events-none text-slate-300'}`}
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

function EmptyState({ noHirings, onCreate, onReset }) {
    if (!noHirings) {
        return (
            <div className="px-6 py-14 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="font-medium text-slate-800">Ничего не найдено</p>
                <p className="mt-1 text-sm text-slate-500">Измените условия поиска. ИИН ищется только по полному номеру — 12 цифр.</p>
                <button type="button" onClick={onReset} className={`${buttonClassName.secondary} mt-4`}>Сбросить фильтры</button>
            </div>
        );
    }

    return (
        <div className="px-6 py-14 text-center">
            <FileSignature className="mx-auto mb-3 h-10 w-10 text-teal-600/70" />
            <p className="text-lg font-semibold text-slate-900">Приёмов пока нет</p>
            <ol className="mx-auto mt-4 grid max-w-2xl gap-3 text-left text-sm text-slate-600 sm:grid-cols-3">
                {['Нажмите «Новый приём» и заполните данные сотрудника', 'Выберите должность и условия договора', 'Скачайте договор, приказ и личную карточку'].map((text, index) => (
                    <li key={text} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800">{index + 1}</span>
                        {text}
                    </li>
                ))}
            </ol>
            <button type="button" onClick={onCreate} className={`${buttonClassName.primary} mt-6 px-5`}>
                <UserPlus className="h-4 w-4" /> Оформить первый приём
            </button>
        </div>
    );
}

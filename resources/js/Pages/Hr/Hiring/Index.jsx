import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { buttonClassName, inputClassName, StatusBadge } from '@/components/hr-hiring/ui';
import { Head, Link, router } from '@inertiajs/react';
import { FileSignature, Plus, Search, Settings2, UserPlus } from 'lucide-react';
import { useState } from 'react';

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

export default function Index({ hirings, filters, units = [], statuses = [] }) {
    const [form, setForm] = useState({
        q: filters.q ?? '',
        status: filters.status ?? '',
        unit: filters.unit ?? '',
        date_from: filters.date_from ?? '',
        date_to: filters.date_to ?? '',
    });
    const rows = hirings?.data ?? [];

    const apply = (next = form) => {
        const query = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== '' && value !== null));
        router.get(route('hr.hiring.index'), query, { preserveState: true, preserveScroll: true, replace: true });
    };

    const change = (key, value, immediate = true) => {
        const next = { ...form, [key]: value };
        setForm(next);
        if (immediate) {
            apply(next);
        }
    };

    const reset = () => {
        const empty = { q: '', status: '', unit: '', date_from: '', date_to: '' };
        setForm(empty);
        apply(empty);
    };

    const create = () => router.post(route('hr.hiring.store'));

    return (
        <AuthenticatedLayout
            header={(
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">HR и учет</p>
                        <h2 className="text-2xl font-semibold text-slate-900">Приём на работу</h2>
                        <p className="max-w-3xl text-sm text-slate-600">
                            Сотрудник и условия вводятся один раз — из них собираются трудовой договор, приказ о приёме и личная карточка.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href={route('hr.hiring.settings.index')} className={buttonClassName.secondary}>
                            <Settings2 className="h-4 w-4" /> Настройки
                        </Link>
                        <button type="button" onClick={create} className={buttonClassName.primary}>
                            <UserPlus className="h-4 w-4" /> Новый приём
                        </button>
                    </div>
                </div>
            )}
        >
            <Head title="Приём на работу" />
            <div className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
                <form
                    onSubmit={(event) => { event.preventDefault(); apply(); }}
                    className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
                >
                    <label className="relative">
                        <span className="sr-only">Поиск</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={form.q}
                            onChange={(event) => change('q', event.target.value, false)}
                            placeholder="ФИО или полный ИИН (12 цифр)"
                            className={`${inputClassName} pl-9`}
                        />
                    </label>
                    <select value={form.status} onChange={(event) => change('status', event.target.value)} className={inputClassName} aria-label="Статус">
                        <option value="">Все статусы</option>
                        {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                    <select value={form.unit} onChange={(event) => change('unit', event.target.value)} className={inputClassName} aria-label="Подразделение">
                        <option value="">Все подразделения</option>
                        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                    </select>
                    <input type="date" value={form.date_from} onChange={(event) => change('date_from', event.target.value)} className={inputClassName} aria-label="Дата приёма с" title="Дата приёма с" />
                    <input type="date" value={form.date_to} onChange={(event) => change('date_to', event.target.value)} className={inputClassName} aria-label="Дата приёма по" title="Дата приёма по" />
                    <div className="flex gap-2">
                        <button type="submit" className={buttonClassName.secondary}>Найти</button>
                        <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-slate-800">Сбросить</button>
                    </div>
                </form>

                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    {rows.length === 0 ? (
                        <div className="px-6 py-16 text-center text-sm text-slate-500">
                            <FileSignature className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                            Приёмов пока нет.{' '}
                            <button type="button" onClick={create} className="font-medium text-teal-700 hover:underline">Оформить первый приём</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Сотрудник</th>
                                        <th className="px-4 py-3">ИИН</th>
                                        <th className="px-4 py-3">Удостоверение</th>
                                        <th className="px-4 py-3">Должность и подразделение</th>
                                        <th className="px-4 py-3">Дата приёма</th>
                                        <th className="px-4 py-3">Договор / приказ</th>
                                        <th className="px-4 py-3">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row) => (
                                        <tr key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.visit(route('hr.hiring.show', row.id))}>
                                            <td className="px-4 py-3">
                                                <Link href={route('hr.hiring.show', row.id)} className="font-medium text-slate-900 hover:text-teal-700" onClick={(event) => event.stopPropagation()}>
                                                    {row.full_name}
                                                </Link>
                                                <div className="text-xs text-slate-400">приём #{row.id} · изменён {row.updated_at}</div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-700">{row.iin_masked || '—'}</td>
                                            <td className="px-4 py-3 font-mono text-slate-700">{row.id_card_masked || '—'}</td>
                                            <td className="px-4 py-3">
                                                <div className="text-slate-800">{row.position || '—'}</div>
                                                <div className="text-xs text-slate-500">{row.unit}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{row.start_date || '—'}</td>
                                            <td className="px-4 py-3 text-slate-700">
                                                {row.contract_number ? `№${row.contract_number}` : '—'}
                                                {row.order_number && <span className="text-slate-400"> / {row.order_number}</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={row.status} label={row.status_label} />
                                                {row.signed_documents_count > 0 && row.status !== 'signed' && (
                                                    <div className="mt-1 text-xs text-slate-500">подписано: {row.signed_documents_count}</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {hirings?.links?.length > 3 && (
                        <nav className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-4 py-3">
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
                </section>
                <p className="text-xs text-slate-500">
                    <Plus className="mr-1 inline h-3 w-3" />
                    ИИН и номер удостоверения в списке скрыты; полностью они видны в карточке приёма. Поиск по ИИН — только по полному номеру.
                </p>
            </div>
        </AuthenticatedLayout>
    );
}

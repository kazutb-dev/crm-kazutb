import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, PageHeader, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const STATUS_COLORS = {
    available: 'bg-emerald-500',
    busy: 'bg-red-500',
    soon: 'bg-amber-500',
    dnd: 'bg-slate-400',
};
const STATUS_TONES = {
    available: 'success',
    busy: 'danger',
    soon: 'warning',
    dnd: 'default',
};
const STATUS_LABELS = {
    available: 'Доступен',
    busy: 'Занят',
    soon: 'Скоро',
    dnd: 'Не беспокоить',
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
};

export default function CalendarEmployees({ employees = [] }) {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');

    const statusCounts = useMemo(() => employees.reduce((acc, e) => {
        const key = STATUS_LABELS[e.calendar_status] ? e.calendar_status : 'none';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {}), [employees]);

    const filtered = employees.filter(e => {
        const q = query.toLowerCase();
        if (status !== 'all' && (STATUS_LABELS[e.calendar_status] ? e.calendar_status : 'none') !== status) return false;
        return !q ||
            e.name?.toLowerCase().includes(q) ||
            e.title?.toLowerCase().includes(q) ||
            e.department?.toLowerCase().includes(q) ||
            e.room?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q) ||
            e.phone?.toLowerCase().includes(q);
    });

    const statusItems = [
        { key: 'all', label: 'Все', count: employees.length, dot: null },
        ...Object.keys(STATUS_LABELS).map(key => ({ key, label: STATUS_LABELS[key], count: statusCounts[key] ?? 0, dot: STATUS_COLORS[key] })),
        ...((statusCounts.none ?? 0) > 0 ? [{ key: 'none', label: 'Нет данных', count: statusCounts.none, dot: 'bg-slate-300' }] : []),
    ];

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title="Сотрудники"
                    description="Каталог сотрудников с быстрым переходом в календарь и статусом доступности"
                    meta={<StatusBadge tone="default">Всего: {employees.length}</StatusBadge>}
                />
            )}
        >
            <Head title="Smart Calendar — Сотрудники" />
            <div className="admin-page-wrap space-y-6">
                <FilterBar>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)_auto] lg:items-end">
                        <label className="relative block space-y-2">
                            <span className="qd-field-label block">Поиск</span>
                            <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-slate-400" />
                            <Input
                                className="pl-9"
                                placeholder="Поиск по ФИО, должности, кабинету, телефону..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                        </label>
                        <div className="space-y-2">
                            <span className="qd-field-label block">Доступность</span>
                            <div className="flex min-h-10 flex-wrap items-center gap-1.5">
                                {statusItems.map(item => (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setStatus(item.key)}
                                        aria-pressed={status === item.key}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${status === item.key ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                                    >
                                        {item.dot && <span className={`h-2 w-2 rounded-full ${item.dot}`} />}
                                        {item.label}
                                        <span className="tabular-nums text-slate-400">{item.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="flex h-10 items-center whitespace-nowrap text-xs font-medium text-slate-500">
                            Найдено: <span className="ml-1 font-semibold tabular-nums text-[#102945]">{filtered.length}</span>&nbsp;из {employees.length}
                        </p>
                    </div>
                </FilterBar>

                {filtered.length === 0 ? (
                    <EmptyState title="Сотрудники не найдены" description="Измените поисковый запрос: поиск идёт по ФИО, должности, подразделению, кабинету, email и телефону." />
                ) : (
                    <Card>
                        <CardContent className="p-0 sm:p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th>Сотрудник</th>
                                            <th>Подразделение</th>
                                            <th>Кабинет</th>
                                            <th>Телефон</th>
                                            <th>Email</th>
                                            <th>Статус</th>
                                            <th className="text-right"><span className="sr-only">Действия</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(emp => (
                                            <tr key={emp.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                <td>
                                                    <div className="flex min-w-[14rem] items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-[#102945]">
                                                                {getInitials(emp.name)}
                                                            </div>
                                                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${STATUS_COLORS[emp.calendar_status] ?? STATUS_COLORS.dnd}`} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium text-slate-900">{emp.name}</p>
                                                            <p className="truncate text-xs text-slate-500">{emp.title ?? '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="max-w-[18rem] truncate text-slate-600">{emp.department || '—'}</td>
                                                <td className="whitespace-nowrap text-slate-600">{emp.room ? `Каб. ${emp.room}` : '—'}</td>
                                                <td className="whitespace-nowrap tabular-nums text-slate-600">{emp.phone || '—'}</td>
                                                <td className="max-w-[16rem] truncate text-slate-600">{emp.email || '—'}</td>
                                                <td>
                                                    <StatusBadge tone={STATUS_TONES[emp.calendar_status] ?? 'default'}>
                                                        {STATUS_LABELS[emp.calendar_status] ?? 'Нет данных'}
                                                    </StatusBadge>
                                                </td>
                                                <td className="text-right">
                                                    <Button variant="outline" size="sm" asChild>
                                                        <Link href={route('calendar.employees.profile', { employee: emp.id })}>Открыть календарь</Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

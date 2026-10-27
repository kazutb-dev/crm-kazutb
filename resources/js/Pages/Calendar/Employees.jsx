import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, PageHeader, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';

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

    const filtered = employees.filter(e => {
        const q = query.toLowerCase();
        return !q ||
            e.name?.toLowerCase().includes(q) ||
            e.title?.toLowerCase().includes(q) ||
            e.department?.toLowerCase().includes(q) ||
            e.room?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q) ||
            e.phone?.toLowerCase().includes(q);
    });

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
                    <label className="relative block max-w-xl space-y-2">
                        <span className="qd-field-label block">Поиск</span>
                        <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-slate-400" />
                        <Input
                            className="pl-9"
                            placeholder="Поиск по ФИО, должности, кабинету, телефону..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </label>
                    {query && (
                        <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-medium text-slate-500">
                            Найдено: {filtered.length} из {employees.length}
                        </p>
                    )}
                </FilterBar>

                {filtered.length === 0 ? (
                    <EmptyState title="Сотрудники не найдены" description="Измените поисковый запрос: поиск идёт по ФИО, должности, подразделению, кабинету, email и телефону." />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map(emp => (
                            <div key={emp.id} className="flex h-full flex-col gap-4 rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_0_rgba(25,28,29,0.04)] transition-colors hover:border-teal-300">
                                <div className="flex gap-3">
                                    <div className="relative shrink-0">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 font-display text-sm font-bold text-[#102945]">
                                            {getInitials(emp.name)}
                                        </div>
                                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${STATUS_COLORS[emp.calendar_status] ?? STATUS_COLORS.dnd}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-slate-900">{emp.name}</p>
                                        <p className="mt-0.5 truncate text-sm text-slate-500">{emp.title ?? '—'}</p>
                                    </div>
                                </div>
                                {(emp.department || emp.room || emp.phone) && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {emp.department && <Badge variant="secondary" className="max-w-full truncate">{emp.department}</Badge>}
                                        {emp.room && <Badge variant="outline">Каб. {emp.room}</Badge>}
                                        {emp.phone && <Badge variant="outline" className="tabular-nums">{emp.phone}</Badge>}
                                    </div>
                                )}
                                <div className="mt-auto flex items-center gap-2 border-t border-slate-200 pt-4">
                                    <StatusBadge tone={STATUS_TONES[emp.calendar_status] ?? 'default'}>
                                        {STATUS_LABELS[emp.calendar_status] ?? 'Нет данных'}
                                    </StatusBadge>
                                    <Button variant="outline" size="sm" className="ml-auto" asChild>
                                        <Link href={route('calendar.employees.profile', { employee: emp.id })}>Открыть календарь</Link>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

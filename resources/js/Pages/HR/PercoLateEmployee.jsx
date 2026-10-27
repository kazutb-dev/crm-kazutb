import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { InfoField, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, Clock3, Download, Timer, TrendingUp, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function PercoLateEmployee({ employee = null, events = [], filters = {} }) {
    const [sortConfig, setSortConfig] = useState({ key: 'late_date', dir: 'asc' });

    const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const fmtTime = (t) => {
        if (!t) return '—';
        return String(t).slice(0, 5);
    };

    const fmtMinutes = (seconds) => {
        const value = Number(seconds ?? 0);
        if (!Number.isFinite(value) || value <= 0) return '0';
        return String(Math.ceil(value / 60));
    };

    const fullName = employee
        ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(' ')
        : 'Сотрудник';

    const toggleSort = (key) => {
        setSortConfig((prev) => (
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'asc' }
        ));
    };

    const sortIndicator = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.dir === 'asc' ? ' ↑' : ' ↓';
    };

    const getSortValue = (row, key) => {
        if (key === 'late_date') return row.late_date ?? '';
        if (key === 'first_enter_time') return row.first_enter_time ?? '';
        if (key === 'late_time') return Number(row.late_time ?? 0);
        return '';
    };

    const displayedEvents = useMemo(() => {
        const sorted = [...events];
        sorted.sort((a, b) => {
            const aVal = getSortValue(a, sortConfig.key);
            const bVal = getSortValue(b, sortConfig.key);
            const compare = typeof aVal === 'number' && typeof bVal === 'number'
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal), 'ru', { sensitivity: 'base' });
            return sortConfig.dir === 'asc' ? compare : -compare;
        });
        return sorted;
    }, [events, sortConfig]);

    const maxLate = events.reduce((acc, row) => Math.max(acc, Number(row.late_time ?? 0) || 0), 0);
    const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    // 'YYYY-MM-DD' is parsed as a local date so the weekday does not shift with the time zone.
    const parseDay = (value) => {
        if (!value) return null;
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
        const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    };
    const weekdayCounts = useMemo(() => {
        const counts = WEEKDAYS.map(() => 0);
        events.forEach((row) => {
            const date = parseDay(row.late_date);
            if (date) {
                counts[(date.getDay() + 6) % 7] += 1;
            }
        });
        return counts;
    }, [events]);
    const maxWeekday = Math.max(...weekdayCounts, 0);

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_late_employee.csv',
            columns: [
                { header: 'ФИО', getValue: () => fullName },
                { header: 'Подразделение', getValue: () => employee?.division ?? '—' },
                { header: 'Должность', getValue: () => employee?.position ?? '—' },
                { header: 'Дата', getValue: (row) => fmtDate(row.late_date) },
                { header: 'Во сколько зашел', getValue: (row) => fmtTime(row.first_enter_time) },
                { header: 'На сколько опоздал (мин)', getValue: (row) => fmtMinutes(row.late_time) },
            ],
            rows: displayedEvents,
        });
    };

    const SORT_BTN = 'inline-flex items-center gap-1 uppercase hover:text-teal-700';

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="HR · Карточка опозданий"
                    title={fullName || 'Сотрудник'}
                    description={[employee?.division, employee?.position].filter(Boolean).join(' · ') || null}
                    actions={(
                        <>
                            <Button
                                variant="outline"
                                onClick={() => router.get(route('hr.perco.late'), filters, { preserveScroll: true })}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Назад
                            </Button>
                            <Button variant="outline" type="button" onClick={handleExport}>
                                <Download className="h-4 w-4" />
                                Экспорт в Excel
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title="HR / Карточка опозданий сотрудника" />

            <div className="admin-page-wrap space-y-4">
                <StatGrid>
                    <StatTile label="Кол-во опозданий" value={employee?.late_count ?? 0} icon={Clock3} tone="copper" hint={filters?.from ? `${fmtDate(filters.from)} – ${fmtDate(filters.to)}` : null} />
                    <StatTile label="Суммарно (мин)" value={fmtMinutes(employee?.total_late_time ?? 0)} icon={Clock3} tone="danger" />
                    <StatTile label="Среднее (мин)" value={fmtMinutes(employee?.avg_late_time ?? 0)} icon={Timer} tone="navy" />
                    <StatTile label="Максимум (мин)" value={fmtMinutes(maxLate)} icon={TrendingUp} tone="gold" />
                    <StatTile label="Последнее опоздание" value={<span className="text-xl">{fmtDate(employee?.last_late_date)}</span>} icon={CalendarDays} tone="neutral" />
                </StatGrid>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <Clock3 className="shrink-0" />
                            Полная информация по опозданиям
                        </CardTitle>
                        <span className="text-xs tabular-nums text-slate-500">{events.length}</span>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-0">
                        {events.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-slate-500">За выбранный период опозданий нет.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th className="w-12">#</th>
                                            <th><button type="button" className={SORT_BTN} onClick={() => toggleSort('late_date')}>Дата{sortIndicator('late_date')}</button></th>
                                            <th>День недели</th>
                                            <th><button type="button" className={SORT_BTN} onClick={() => toggleSort('first_enter_time')}>Во сколько зашел{sortIndicator('first_enter_time')}</button></th>
                                            <th className="text-right"><button type="button" className={SORT_BTN} onClick={() => toggleSort('late_time')}>На сколько опоздал (мин){sortIndicator('late_time')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedEvents.map((row, idx) => {
                                            const date = parseDay(row.late_date);
                                            const weekday = date ? WEEKDAYS[(date.getDay() + 6) % 7] : '—';
                                            return (
                                                <tr key={`${row.late_date}-${idx}`} className="border-b border-slate-200 last:border-0">
                                                    <td className="tabular-nums text-slate-400">{idx + 1}</td>
                                                    <td className="font-medium tabular-nums text-slate-900">{fmtDate(row.late_date)}</td>
                                                    <td className="text-slate-600">{weekday}</td>
                                                    <td className="font-semibold tabular-nums text-[#102945]">{fmtTime(row.first_enter_time)}</td>
                                                    <td className="text-right">
                                                        <StatusBadge tone="danger" className="tabular-nums">{fmtMinutes(row.late_time)}</StatusBadge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserRound className="shrink-0" />
                                Карточка сотрудника
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                            <InfoField label="ФИО" className="sm:col-span-2">{fullName}</InfoField>
                            <InfoField label="Подразделение">{employee?.division ?? '—'}</InfoField>
                            <InfoField label="Должность">{employee?.position ?? '—'}</InfoField>
                            <InfoField label="Табельный номер"><span className="tabular-nums">{employee?.tabel_number ?? '—'}</span></InfoField>
                        </CardContent>
                    </Card>

                    {events.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarDays className="shrink-0" />
                                    По дням недели
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {WEEKDAYS.map((label, idx) => (
                                    <div key={label} className="flex items-center gap-3 text-sm">
                                        <span className="w-6 text-slate-600">{label}</span>
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${maxWeekday > 0 ? (weekdayCounts[idx] / maxWeekday) * 100 : 0}%` }} />
                                        </div>
                                        <span className="w-6 text-right text-xs tabular-nums text-slate-500">{weekdayCounts[idx]}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, Clock3, Download, Timer, TrendingDown, UserRound, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DivisionLatePeople({ rows = [], divisionName = 'Подразделение', from = null, to = null, filters = {} }) {
    const [sortConfig, setSortConfig] = useState({ key: 'name', dir: 'asc' });

    const handleBack = () => {
        router.get(route('hr.dashboard'), filters, { preserveScroll: true });
    };

    const formatTime = (value) => {
        if (!value) return '—';
        return String(value).slice(0, 5);
    };

    const formatLate = (value) => {
        const seconds = Number(value ?? 0);
        if (!Number.isFinite(seconds) || seconds <= 0) return '0 мин';
        return `${Math.round(seconds / 60)} мин`;
    };

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
        if (key === 'name') return row.name ?? '';
        if (key === 'position') return row.position ?? '';
        if (key === 'first_enter_time') return row.first_enter_time ?? '';
        if (key === 'late_minutes') return Number(row.late_minutes ?? 0);
        return '';
    };

    const displayedRows = useMemo(() => {
        const sorted = [...rows];
        sorted.sort((a, b) => {
            const aVal = getSortValue(a, sortConfig.key);
            const bVal = getSortValue(b, sortConfig.key);
            const compare = typeof aVal === 'number' && typeof bVal === 'number'
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal), 'ru', { sensitivity: 'base' });
            return sortConfig.dir === 'asc' ? compare : -compare;
        });
        return sorted;
    }, [rows, sortConfig]);

    const totalLateSeconds = rows.reduce((acc, row) => acc + (Number(row.late_minutes ?? 0) || 0), 0);
    const maxLateSeconds = rows.reduce((acc, row) => Math.max(acc, Number(row.late_minutes ?? 0) || 0), 0);
    const uniqueDays = new Set(rows.map((row) => row.late_date).filter(Boolean)).size;
    const byPerson = useMemo(() => {
        const map = new Map();
        rows.forEach((row) => {
            const key = row.name ?? '—';
            const entry = map.get(key) ?? { name: key, position: row.position, count: 0, seconds: 0 };
            entry.count += 1;
            entry.seconds += Number(row.late_minutes ?? 0) || 0;
            map.set(key, entry);
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count || b.seconds - a.seconds);
    }, [rows]);
    const maxPersonCount = byPerson.reduce((acc, row) => Math.max(acc, row.count), 0);

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_division_late_people.csv',
            columns: [
                { header: 'Дата', getValue: (row) => formatDate(row.late_date) },
                { header: 'ФИО', key: 'name' },
                { header: 'Должность', key: 'position' },
                { header: 'Во сколько зашел', getValue: (row) => formatTime(row.first_enter_time) },
                { header: 'На сколько опоздал', getValue: (row) => formatLate(row.late_minutes) },
            ],
            rows: displayedRows,
        });
    };

    const SORT_BTN = 'inline-flex items-center gap-1 uppercase hover:text-teal-700';

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="HR · Опоздавшие сотрудники"
                    title={divisionName}
                    description={`с ${formatDate(from)} по ${formatDate(to)}`}
                    meta={<StatusBadge tone="danger">Записей: {rows.length}</StatusBadge>}
                    actions={(
                        <>
                            <Button onClick={handleBack} variant="outline">
                                <ArrowLeft className="h-4 w-4" />
                                Назад
                            </Button>
                            <Button type="button" variant="outline" onClick={handleExport}>
                                <Download className="h-4 w-4" />
                                Экспорт в Excel
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title="Опоздавшие сотрудники" />

            <div className="admin-page-wrap space-y-4">
                {rows.length > 0 && (
                    <StatGrid>
                        <StatTile label="Опозданий" value={rows.length} icon={TrendingDown} tone="danger" />
                        <StatTile label="Сотрудников" value={byPerson.length} icon={Users} tone="info" hint={byPerson.length > 0 ? `${(rows.length / byPerson.length).toFixed(1)} опоздания на сотрудника` : null} />
                        <StatTile label="Дней с опозданиями" value={uniqueDays} icon={CalendarDays} tone="navy" />
                        <StatTile label="Суммарно" value={formatLate(totalLateSeconds)} icon={Clock3} tone="copper" />
                        <StatTile label="Среднее / максимум" value={formatLate(rows.length > 0 ? totalLateSeconds / rows.length : 0)} icon={Timer} tone="gold" hint={`Максимум: ${formatLate(maxLateSeconds)}`} />
                    </StatGrid>
                )}

                {rows.length === 0 ? (
                    <EmptyState
                        title="Нет опоздавших сотрудников за выбранный период"
                        description="Вернитесь на HR Dashboard и выберите другой период или подразделение."
                        action={(
                            <Button onClick={handleBack} variant="outline">
                                <ArrowLeft className="h-4 w-4" />
                                Назад
                            </Button>
                        )}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="shrink-0" />
                                Список ({rows.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[820px] text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th>#</th>
                                            <th><button type="button" className={SORT_BTN} onClick={() => toggleSort('late_date')}>Дата{sortIndicator('late_date')}</button></th>
                                            <th><button type="button" className={SORT_BTN} onClick={() => toggleSort('name')}>ФИО{sortIndicator('name')}</button></th>
                                            <th><button type="button" className={SORT_BTN} onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button></th>
                                            <th><button type="button" className={SORT_BTN} onClick={() => toggleSort('first_enter_time')}>Во сколько зашел{sortIndicator('first_enter_time')}</button></th>
                                            <th className="text-right"><button type="button" className={SORT_BTN} onClick={() => toggleSort('late_minutes')}>На сколько опоздал{sortIndicator('late_minutes')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedRows.map((person, idx) => (
                                            <tr key={person.id} className="border-b border-slate-200 last:border-0">
                                                <td className="tabular-nums text-slate-400">{idx + 1}</td>
                                                <td className="tabular-nums text-slate-700">{formatDate(person.late_date)}</td>
                                                <td>
                                                    <div className="font-medium text-slate-900">{person.name}</div>
                                                    {person.tabel_number ? <div className="text-xs tabular-nums text-slate-500">Таб. № {person.tabel_number}</div> : null}
                                                </td>
                                                <td className="text-slate-600">{person.position || '—'}</td>
                                                <td className="font-semibold tabular-nums text-[#102945]">{formatTime(person.first_enter_time)}</td>
                                                <td className="text-right">
                                                    <StatusBadge tone="danger" className="tabular-nums">{formatLate(person.late_minutes)}</StatusBadge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <UserRound className="shrink-0" />
                                По сотрудникам
                            </CardTitle>
                            <span className="text-xs tabular-nums text-slate-500">{byPerson.length}</span>
                        </CardHeader>
                        <CardContent className="max-h-[70vh] space-y-3 overflow-auto">
                            {byPerson.map((person) => (
                                <div key={person.name}>
                                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                        <span className="min-w-0 truncate font-medium text-slate-900" title={person.position || undefined}>{person.name}</span>
                                        <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500">{person.count} раз · {formatLate(person.seconds)}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${maxPersonCount > 0 ? Math.max(6, (person.count / maxPersonCount) * 100) : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

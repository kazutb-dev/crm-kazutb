import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, FormField, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { Clock3, Download, Search, Timer, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function PercoOvertime({ staff, divisions = [], filters = {}, summary = {}, latestOvertimeDate = null }) {
    const items = staff?.data ?? [];
    const links = staff?.links ?? [];
    const meta = staff?.meta ?? {};

    const [q, setQ] = useState(filters.q ?? '');
    const [division, setDivision] = useState(filters.division ?? '');
    const [days, setDays] = useState(String(filters.days ?? 1));
    const [sortConfig, setSortConfig] = useState({ key: 'work_date', dir: 'desc' });
    const [fromDate, setFromDate] = useState(filters.from ?? '');
    const searchRef = useRef(null);

    useEffect(() => {
        setQ(filters.q ?? '');
        setDivision(filters.division ?? '');
        setDays(String(filters.days ?? 1));
        setFromDate(filters.from ?? '');
    }, [filters]);

    const applyFilters = (overrides = {}) => {
        const params = { q, division, days, ...overrides };
        if (fromDate) {
            params.from = fromDate;
            delete params.days;
        }
        router.get(route('hr.perco.overtime'), params, { preserveState: false, preserveScroll: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters();
    };

    const handleDivisionChange = (e) => {
        const value = e.target.value;
        setDivision(value);
        applyFilters({ division: value });
    };

    const handleDaysChange = (e) => {
        const value = e.target.value;
        setDays(value);
        setFromDate('');
        applyFilters({ days: value, from: '' });
    };

    const handleFromDateChange = (e) => {
        const value = e.target.value;
        setFromDate(value);
        applyFilters({ from: value });
    };

    const openDayEvents = (row) => {
        if (!row?.id || !row?.work_date) return;
        const back = `${window.location.pathname}${window.location.search}`;
        router.get(route('hr.perco.day.events'), {
            user_id: row.id,
            date: row.work_date,
            back,
        });
    };

    const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const fmtTime = (timeStr) => {
        if (!timeStr) return '—';
        const value = String(timeStr);
        return value.length >= 5 ? value.slice(0, 5) : value;
    };

    const fmtTimeList = (times, fallback = null) => {
        const list = Array.isArray(times)
            ? times.map((t) => fmtTime(t)).filter((t) => t !== '—')
            : [];

        if (list.length > 0) {
            return list.join(', ');
        }

        const fallbackValue = fallback ? fmtTime(fallback) : '—';
        return fallbackValue;
    };

    const getEventIssue = (row) => {
        const hasEnter = (Array.isArray(row.enter_times) && row.enter_times.length > 0) || Boolean(row.first_enter_time);
        const hasExit = (Array.isArray(row.exit_times) && row.exit_times.length > 0)
            || (Array.isArray(row.exit_times_from_next_day) && row.exit_times_from_next_day.length > 0)
            || Boolean(row.last_exit_time);

        if (!hasEnter && !hasExit) return 'Нет событий прохода';
        if (!hasEnter) return 'Нет события входа';
        if (!hasExit) return 'Нет события выхода';

        return null;
    };

    const fmtDuration = (seconds) => {
        const value = Number(seconds ?? 0);
        if (!Number.isFinite(value) || value <= 0) return '0 ч 00 мин';

        const totalMinutes = Math.round(value / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours} ч ${String(minutes).padStart(2, '0')} мин`;
    };

    const fullName = (row) => [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ') || '—';

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
        if (key === 'work_date') return row.work_date ?? '';
        if (key === 'full_name') return fullName(row);
        if (key === 'division') return row.division ?? '';
        if (key === 'position') return row.position ?? '';
        if (key === 'first_enter_time') return row.first_enter_time ?? '';
        if (key === 'last_exit_time') return row.last_exit_time ?? '';
        if (key === 'work_time') return Number(row.work_time ?? 0);
        if (key === 'overtime_time') return Number(row.overtime_time ?? 0);
        return '';
    };

    const displayedItems = useMemo(() => {
        const sorted = [...items];
        sorted.sort((a, b) => {
            const aVal = getSortValue(a, sortConfig.key);
            const bVal = getSortValue(b, sortConfig.key);
            const compare = typeof aVal === 'number' && typeof bVal === 'number'
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal), 'ru', { sensitivity: 'base' });
            return sortConfig.dir === 'asc' ? compare : -compare;
        });
        return sorted;
    }, [items, sortConfig]);

    const overtimeDays = Number(summary?.overtime_days ?? 0);
    const overtimePeople = Number(summary?.overtime_people ?? 0);
    const totalWorkTime = fmtDuration(summary?.total_work_time ?? 0);
    const totalOvertime = fmtDuration(summary?.total_overtime_time ?? 0);
    const latestDateLabel = latestOvertimeDate ? fmtDate(latestOvertimeDate) : null;

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_perco_overtime.csv',
            columns: [
                { header: 'Дата', getValue: (row) => fmtDate(row.work_date) },
                { header: 'ФИО', getValue: (row) => fullName(row) },
                { header: 'Подразделение', key: 'division' },
                { header: 'Должность', key: 'position' },
                { header: 'Пришел', getValue: (row) => fmtTimeList(row.enter_times, row.first_enter_time) },
                { header: 'Ушел', getValue: (row) => fmtTimeList(row.exit_times, row.last_exit_time) },
                { header: 'Отработал', getValue: (row) => fmtDuration(row.work_time) },
                { header: 'Переработка', getValue: (row) => fmtDuration(row.overtime_time) },
            ],
            rows: displayedItems,
        });
    };

    const SORT_BTN = 'inline-flex items-center gap-1 uppercase hover:text-teal-700';

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="HR · PERCo"
                    title="Переработка"
                    description="Рабочие дни с переработкой: время прихода и ухода, отработанное время и переработка по сотрудникам."
                    meta={meta?.total != null ? <StatusBadge tone="default">Записей с переработкой: {meta.total}</StatusBadge> : null}
                    actions={(
                        <Button type="button" variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4" />
                            Экспорт в Excel
                        </Button>
                    )}
                />
            )}
        >
            <Head title="HR / Переработка" />

            <div className="admin-page-wrap space-y-6">
                <FilterBar>
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
                            <label className="relative block space-y-2">
                                <span className="qd-field-label block">Поиск</span>
                                <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
                                <Input
                                    ref={searchRef}
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="ФИО сотрудника..."
                                    className="pl-9"
                                />
                            </label>
                            <FormField label="Подразделение">
                                <select value={division} onChange={handleDivisionChange} className={qdFieldClass}>
                                    <option value="">Все подразделения</option>
                                    {divisions.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Период">
                                <select value={days} onChange={handleDaysChange} className={qdFieldClass}>
                                    <option value="1">Сегодня</option>
                                    <option value="-1">Вчера</option>
                                    <option value="7">За 7 дней</option>
                                    <option value="14">За 14 дней</option>
                                    <option value="30">За 30 дней</option>
                                    <option value="0">За все время</option>
                                </select>
                            </FormField>
                            <FormField label="С даты">
                                <input type="date" value={fromDate} onChange={handleFromDateChange} className={qdFieldClass} />
                            </FormField>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                            <Button type="submit">
                                <Search className="h-4 w-4" />
                                Найти
                            </Button>
                        </div>
                    </form>
                </FilterBar>

                <StatGrid>
                    <StatTile label="Рабочих дней в периоде" value={overtimeDays} icon={Timer} tone="copper" />
                    <StatTile label="Сотрудников" value={overtimePeople} icon={Users} tone="info" />
                    <StatTile label="Всего отработано" value={<span className="text-2xl">{totalWorkTime}</span>} icon={Clock3} tone="success" />
                    <StatTile label="Суммарная переработка" value={<span className="text-2xl">{totalOvertime}</span>} icon={Clock3} tone="danger" />
                </StatGrid>

                {overtimeDays === 0 && latestDateLabel && (
                    <Notice tone="warning">
                        За выбранный период нет данных по рабочему времени. Последняя доступная дата в PERCo: <strong>{latestDateLabel}</strong>.
                    </Notice>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Timer className="shrink-0" />Кто сколько работал</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {items.length === 0 ? (
                            <p className="px-6 py-10 text-center text-sm text-slate-500">Нет данных.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th className="py-3 pl-6 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('work_date')}>Дата{sortIndicator('work_date')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('first_enter_time')}>Пришел{sortIndicator('first_enter_time')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('last_exit_time')}>Ушел{sortIndicator('last_exit_time')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('work_time')}>Отработал{sortIndicator('work_time')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('overtime_time')}>Переработка{sortIndicator('overtime_time')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedItems.map((row) => (
                                            (() => {
                                                const eventIssue = getEventIssue(row);

                                                return (
                                            <tr
                                                key={`${row.id}-${row.work_date}`}
                                                className="cursor-pointer border-b border-slate-200 last:border-0"
                                                onClick={() => openDayEvents(row)}
                                                title="Открыть историю проходов за день"
                                            >
                                                <td className="py-3 pl-6 pr-3 tabular-nums text-slate-700">{fmtDate(row.work_date)}</td>
                                                <td className="py-3 pr-3 font-medium text-teal-700 underline underline-offset-4">{fullName(row)}</td>
                                                <td className="py-3 pr-3 text-slate-500">{row.division ?? '—'}</td>
                                                <td className="py-3 pr-3 text-slate-500">{row.position ?? '—'}</td>
                                                <td className="py-3 pr-3 font-medium tabular-nums text-emerald-700">{fmtTimeList(row.enter_times, row.first_enter_time)}</td>
                                                <td className="py-3 pr-3 font-medium tabular-nums text-red-600">
                                                    {fmtTimeList(row.exit_times, row.last_exit_time)}
                                                    {eventIssue && (
                                                        <div className="text-[11px] font-normal text-amber-700">{eventIssue}</div>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-3 font-semibold tabular-nums text-[#102945]">{fmtDuration(row.work_time)}</td>
                                                <td className="py-3 pr-6"><StatusBadge tone="danger" className="tabular-nums">{fmtDuration(row.overtime_time)}</StatusBadge></td>
                                            </tr>
                                                );
                                            })()
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="flex flex-wrap gap-2 border-t border-slate-200 px-6 py-4">
                                {links.map((link, i) => (
                                    <Button
                                        key={`${link.label}-${i}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

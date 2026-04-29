import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { CalendarDays, Clock3, Download, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function PercoTimetracking({ staff, divisions = [], filters = {}, summary = {}, range = {} }) {
    const items = staff?.data ?? [];
    const links = staff?.links ?? [];
    const meta = staff?.meta ?? {};

    const [q, setQ] = useState(filters.q ?? '');
    const [division, setDivision] = useState(filters.division ?? '');
    const [days, setDays] = useState(String(filters.days ?? 30));
    const [fromDate, setFromDate] = useState(filters.from ?? '');
    const [toDate, setToDate] = useState(filters.to ?? '');
    const [sortConfig, setSortConfig] = useState({ key: 'work_date', dir: 'desc' });
    const searchRef = useRef(null);

    useEffect(() => {
        setQ(filters.q ?? '');
        setDivision(filters.division ?? '');
        setDays(String(filters.days ?? 30));
        setFromDate(filters.from ?? '');
        setToDate(filters.to ?? '');
    }, [filters]);

    const applyFilters = (overrides = {}) => {
        const effectiveFrom = 'from' in overrides ? overrides.from : fromDate;
        const effectiveTo = 'to' in overrides ? overrides.to : toDate;
        const params = { q, division, days, ...overrides };
        if (effectiveFrom || effectiveTo) {
            if (effectiveFrom) params.from = effectiveFrom; else delete params.from;
            if (effectiveTo) params.to = effectiveTo; else delete params.to;
            delete params.days;
        } else {
            delete params.from;
            delete params.to;
        }
        router.get(route('hr.perco.timetracking'), params, { preserveState: false, preserveScroll: true });
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
        setToDate('');
        applyFilters({ days: value, from: '', to: '' });
    };

    const handleFromDateChange = (e) => {
        const value = e.target.value;
        setFromDate(value);
        applyFilters({ from: value });
    };

    const handleToDateChange = (e) => {
        const value = e.target.value;
        setToDate(value);
        applyFilters({ to: value });
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

    const fmtTime = (t) => {
        if (!t) return '—';
        const s = String(t);
        return s.length >= 5 ? s.slice(0, 5) : s;
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
                : { key, dir: key === 'work_date' ? 'desc' : 'asc' }
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
        return Number(row[key] ?? 0);
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

    const totalPeople = Number(summary?.total_people ?? 0);
    const totalWorkDays = Number(summary?.total_work_days ?? 0);
    const totalPresence = fmtDuration(summary?.total_presence ?? 0);
    const totalAbsent = fmtDuration(summary?.total_absent ?? 0);

    const rangeLabel = range.from && range.to
        ? `${fmtDate(range.from)} — ${fmtDate(range.to)}`
        : null;

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_perco_timetracking.csv',
            columns: [
                { header: 'Дата', getValue: (row) => fmtDate(row.work_date) },
                { header: 'ФИО', getValue: (row) => fullName(row) },
                { header: 'Подразделение', key: 'division' },
                { header: 'Должность', key: 'position' },
                { header: 'Зашел', getValue: (row) => fmtTimeList(row.enter_times, row.first_enter_time) },
                { header: 'Вышел', getValue: (row) => fmtTimeList(row.exit_times, row.last_exit_time) },
                { header: 'Отработано', getValue: (row) => fmtDuration(row.work_time) },
                { header: 'Отсутствие', getValue: (row) => fmtDuration(row.absent_time) },
                { header: 'Опоздание', getValue: (row) => fmtDuration(row.late_time) },
                { header: 'Ранний уход', getValue: (row) => fmtDuration(row.early_time) },
                { header: 'Переработка', getValue: (row) => fmtDuration(row.over_time) },
            ],
            rows: displayedItems,
        });
    };

    return (
        <AuthenticatedLayout
            headerRight={
                <form className="flex items-center gap-2" onSubmit={handleSearch}>
                    <Input
                        ref={searchRef}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="ФИО сотрудника..."
                        className="h-8 w-64"
                    />
                    <Button size="sm" type="submit">
                        <Search className="mr-1 h-4 w-4" />
                        Найти
                    </Button>
                </form>
            }
        >
            <Head title="HR / Рабочее время" />

            <div className="space-y-4 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={division}
                        onChange={handleDivisionChange}
                        className="h-9 rounded-md border bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">Все подразделения</option>
                        {divisions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>

                    <select
                        value={fromDate || toDate ? '' : days}
                        onChange={handleDaysChange}
                        className="h-9 rounded-md border bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        {(fromDate || toDate) && <option value="" disabled>Диапазон дат</option>}
                        <option value="1">Сегодня</option>
                        <option value="-1">Вчера</option>
                        <option value="7">За 7 дней</option>
                        <option value="14">За 14 дней</option>
                        <option value="30">За 30 дней</option>
                        <option value="0">За все время</option>
                    </select>

                    <Input type="date" value={fromDate} onChange={handleFromDateChange} className="h-9 w-[160px]" />
                    <span className="text-sm text-muted-foreground">—</span>
                    <Input type="date" value={toDate} onChange={handleToDateChange} className="h-9 w-[160px]" />

                    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-1 h-4 w-4" />
                        Экспорт в Excel
                    </Button>

                    {rangeLabel && (
                        <span className="text-sm text-muted-foreground">{rangeLabel}</span>
                    )}

                    {meta?.total != null && (
                        <span className="ml-auto text-sm text-muted-foreground">
                            Записей: <strong>{meta.total}</strong>
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Сотрудников</p>
                                <p className="text-2xl font-semibold">{totalPeople}</p>
                            </div>
                            <Users className="h-5 w-5 text-blue-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Рабочих дней</p>
                                <p className="text-2xl font-semibold">{totalWorkDays}</p>
                            </div>
                            <CalendarDays className="h-5 w-5 text-violet-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Всего отработано</p>
                                <p className="text-lg font-semibold">{totalPresence}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-emerald-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Суммарное отсутствие</p>
                                <p className="text-lg font-semibold">{totalAbsent}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-orange-500" />
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Рабочее время сотрудников</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {items.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">Нет данных за выбранный период.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1200px] text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                                            <th className="py-3 pl-6 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('work_date')}>Дата{sortIndicator('work_date')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium text-center">
                                                <button type="button" onClick={() => toggleSort('first_enter_time')}>Зашел{sortIndicator('first_enter_time')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium text-center">
                                                <button type="button" onClick={() => toggleSort('last_exit_time')}>Вышел{sortIndicator('last_exit_time')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium text-right">
                                                <button type="button" onClick={() => toggleSort('work_time')}>Отработано{sortIndicator('work_time')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium text-right">
                                                <button type="button" onClick={() => toggleSort('absent_time')}>Отсутствие{sortIndicator('absent_time')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium text-right">
                                                <button type="button" onClick={() => toggleSort('late_time')}>Опоздание{sortIndicator('late_time')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium text-right">
                                                <button type="button" onClick={() => toggleSort('early_time')}>Ранний уход{sortIndicator('early_time')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium text-right">
                                                <button type="button" onClick={() => toggleSort('over_time')}>Переработка{sortIndicator('over_time')}</button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedItems.map((row) => (
                                            (() => {
                                                const eventIssue = getEventIssue(row);

                                                return (
                                            <tr
                                                key={`${row.id}-${row.work_date}`}
                                                className={[
                                                    'cursor-pointer border-b last:border-0',
                                                    row.is_non_working_day
                                                        ? 'bg-red-50 hover:bg-red-100/70'
                                                        : 'hover:bg-muted/30',
                                                ].join(' ')}
                                                onClick={() => openDayEvents(row)}
                                                title="Открыть историю проходов за день"
                                            >
                                                <td className="py-3 pl-6 pr-3">
                                                    <div>{fmtDate(row.work_date)}</div>
                                                    {row.is_non_working_day && (
                                                        <div className="text-[11px] font-medium text-red-600">
                                                            {row.is_holiday ? 'Праздничный день' : 'Выходной день'}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-3 font-medium underline underline-offset-4">{fullName(row)}</td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.division ?? '—'}</td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.position ?? '—'}</td>
                                                <td className="py-3 pr-3 text-center font-medium text-emerald-700">{fmtTimeList(row.enter_times, row.first_enter_time)}</td>
                                                <td className="py-3 pr-3 text-center font-medium text-red-600">
                                                    {fmtTimeList(row.exit_times, row.last_exit_time)}
                                                    {eventIssue && (
                                                        <div className="text-[11px] font-normal text-amber-600">{eventIssue}</div>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-3 text-right font-semibold text-emerald-700">{fmtDuration(row.work_time)}</td>
                                                <td className="py-3 pr-3 text-right text-orange-600">{fmtDuration(row.absent_time)}</td>
                                                <td className="py-3 pr-3 text-right text-red-600">{fmtDuration(row.late_time)}</td>
                                                <td className="py-3 pr-3 text-right text-amber-600">{fmtDuration(row.early_time)}</td>
                                                <td className="py-3 pr-3 text-right text-violet-600">{fmtDuration(row.over_time)}</td>
                                            </tr>
                                                );
                                            })()
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="flex flex-wrap gap-2 p-4">
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

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, FormField, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, CalendarDays, Clock3, Download, Search, Timer, Users } from 'lucide-react';
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

    const pageSum = (key) => items.reduce((acc, row) => acc + (Number(row[key] ?? 0) || 0), 0);
    const pageLate = pageSum('late_time');
    const pageEarly = pageSum('early_time');
    const pageOver = pageSum('over_time');
    const pageNonWorking = items.filter((row) => row.is_non_working_day).length;
    const pageIssues = items.filter((row) => getEventIssue(row)).length;

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

    const SORT_BTN = 'inline-flex items-center gap-1 uppercase hover:text-teal-700';

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="HR · PERCo"
                    title="Рабочее время"
                    description="Табель по проходам: вход и выход, отработано, отсутствие, опоздания, ранний уход, переработка. Строка открывает историю проходов за день."
                    meta={(
                        <>
                            {rangeLabel && <StatusBadge tone="info">{rangeLabel}</StatusBadge>}
                            {meta?.total != null && <StatusBadge tone="default">Записей: {meta.total}</StatusBadge>}
                        </>
                    )}
                    actions={(
                        <Button type="button" variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4" />
                            Экспорт в Excel
                        </Button>
                    )}
                />
            )}
        >
            <Head title="HR / Рабочее время" />

            <div className="admin-page-wrap space-y-4">
                <FilterBar>
                    <form onSubmit={handleSearch}>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]">
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
                                <select value={fromDate || toDate ? '' : days} onChange={handleDaysChange} className={qdFieldClass}>
                                    {(fromDate || toDate) && <option value="" disabled>Диапазон дат</option>}
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
                            <FormField label="По дату">
                                <input type="date" value={toDate} onChange={handleToDateChange} className={qdFieldClass} />
                            </FormField>
                            <div className="flex items-end justify-end">
                                <Button type="submit">
                                    <Search className="h-4 w-4" />
                                    Найти
                                </Button>
                            </div>
                        </div>
                    </form>
                </FilterBar>

                <StatGrid>
                    <StatTile label="Сотрудников" value={totalPeople} icon={Users} tone="info" hint={rangeLabel} />
                    <StatTile label="Рабочих дней" value={totalWorkDays} icon={CalendarDays} tone="navy" hint={totalPeople > 0 ? `${(totalWorkDays / totalPeople).toFixed(1)} на сотрудника` : null} />
                    <StatTile label="Всего отработано" value={<span className="text-2xl">{totalPresence}</span>} icon={Clock3} tone="success" />
                    <StatTile label="Суммарное отсутствие" value={<span className="text-2xl">{totalAbsent}</span>} icon={Clock3} tone="copper" />
                    <StatTile
                        label="Опоздания / ранний уход"
                        value={<span className="text-xl">{fmtDuration(pageLate)}</span>}
                        icon={AlertTriangle}
                        tone="danger"
                        hint={`Ранний уход: ${fmtDuration(pageEarly)} · по строкам страницы`}
                    />
                    <StatTile
                        label="Переработка"
                        value={<span className="text-xl">{fmtDuration(pageOver)}</span>}
                        icon={Timer}
                        tone="info"
                        hint={`По строкам страницы · выходных: ${pageNonWorking} · без прохода: ${pageIssues}`}
                    />
                </StatGrid>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2"><Clock3 className="shrink-0" />Рабочее время сотрудников</CardTitle>
                        <span className="text-xs tabular-nums text-slate-500">
                            На странице: {items.length}{meta?.total != null ? ` · всего ${meta.total}` : ''}
                        </span>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-0">
                        {items.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-slate-500">Нет данных за выбранный период.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1200px] text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('work_date')}>Дата{sortIndicator('work_date')}</button>
                                            </th>
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button>
                                            </th>
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button>
                                            </th>
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button>
                                            </th>
                                            <th className="font-medium text-center">
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('first_enter_time')}>Зашел{sortIndicator('first_enter_time')}</button>
                                            </th>
                                            <th className="font-medium text-center">
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('last_exit_time')}>Вышел{sortIndicator('last_exit_time')}</button>
                                            </th>
                                            <th className="font-medium text-right">
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('work_time')}>Отработано{sortIndicator('work_time')}</button>
                                            </th>
                                            <th className="font-medium text-right">
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('absent_time')}>Отсутствие{sortIndicator('absent_time')}</button>
                                            </th>
                                            <th className="font-medium text-right">
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('late_time')}>Опоздание{sortIndicator('late_time')}</button>
                                            </th>
                                            <th className="font-medium text-right">
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('early_time')}>Ранний уход{sortIndicator('early_time')}</button>
                                            </th>
                                            <th className="font-medium text-right">
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('over_time')}>Переработка{sortIndicator('over_time')}</button>
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
                                                    'cursor-pointer border-b border-slate-200 last:border-0',
                                                    row.is_non_working_day
                                                        ? 'bg-red-50 hover:bg-red-100/70'
                                                        : '',
                                                ].join(' ')}
                                                onClick={() => openDayEvents(row)}
                                                title="Открыть историю проходов за день"
                                            >
                                                <td>
                                                    <div className="tabular-nums text-slate-700">{fmtDate(row.work_date)}</div>
                                                    {row.is_non_working_day && (
                                                        <div className="text-[11px] font-medium text-red-600">
                                                            {row.is_holiday ? 'Праздничный день' : 'Выходной день'}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="font-medium text-teal-700 underline underline-offset-4">{fullName(row)}</td>
                                                <td className="text-slate-500">{row.division ?? '—'}</td>
                                                <td className="text-slate-500">{row.position ?? '—'}</td>
                                                <td className="text-center font-medium text-emerald-700">{fmtTimeList(row.enter_times, row.first_enter_time)}</td>
                                                <td className="text-center font-medium text-red-600">
                                                    {fmtTimeList(row.exit_times, row.last_exit_time)}
                                                    {eventIssue && (
                                                        <div className="text-[11px] font-normal text-amber-700">{eventIssue}</div>
                                                    )}
                                                </td>
                                                <td className="text-right font-semibold text-emerald-700">{fmtDuration(row.work_time)}</td>
                                                <td className="text-right text-orange-600">{fmtDuration(row.absent_time)}</td>
                                                <td className="text-right text-red-600">{fmtDuration(row.late_time)}</td>
                                                <td className="text-right text-amber-700">{fmtDuration(row.early_time)}</td>
                                                <td className="text-right text-blue-700">{fmtDuration(row.over_time)}</td>
                                            </tr>
                                                );
                                            })()
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {links.length > 3 && (
                            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3 sm:px-6">
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

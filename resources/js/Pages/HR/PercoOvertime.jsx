import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
            <Head title="HR / Переработка" />

            <div className="admin-page-wrap">
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
                        value={days}
                        onChange={handleDaysChange}
                        className="h-9 rounded-md border bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="1">Сегодня</option>
                        <option value="-1">Вчера</option>
                        <option value="7">За 7 дней</option>
                        <option value="14">За 14 дней</option>
                        <option value="30">За 30 дней</option>
                        <option value="0">За все время</option>
                    </select>

                    <Input type="date" value={fromDate} onChange={handleFromDateChange} className="h-9 w-[160px]" />

                    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-1 h-4 w-4" />
                        Экспорт в Excel
                    </Button>

                    {meta?.total != null && (
                        <span className="ml-auto text-sm text-muted-foreground">
                            Записей с переработкой: <strong>{meta.total}</strong>
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Рабочих дней в периоде</p>
                                <p className="text-2xl font-semibold">{overtimeDays}</p>
                            </div>
                            <Timer className="h-5 w-5 text-orange-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Сотрудников</p>
                                <p className="text-2xl font-semibold">{overtimePeople}</p>
                            </div>
                            <Users className="h-5 w-5 text-blue-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Всего отработано</p>
                                <p className="text-lg font-semibold">{totalWorkTime}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-emerald-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Суммарная переработка</p>
                                <p className="text-lg font-semibold">{totalOvertime}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-red-600" />
                        </CardContent>
                    </Card>
                </div>

                {overtimeDays === 0 && latestDateLabel && (
                    <Card className="border-orange-200 bg-orange-50/60">
                        <CardContent className="p-4 text-sm text-orange-900">
                            За выбранный период нет данных по рабочему времени. Последняя доступная дата в PERCo: <strong>{latestDateLabel}</strong>.
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Кто сколько работал</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {items.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">Нет данных.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                                            <th className="py-3 pl-6 pr-3 font-medium"><button type="button" onClick={() => toggleSort('work_date')}>Дата{sortIndicator('work_date')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('first_enter_time')}>Пришел{sortIndicator('first_enter_time')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('last_exit_time')}>Ушел{sortIndicator('last_exit_time')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('work_time')}>Отработал{sortIndicator('work_time')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('overtime_time')}>Переработка{sortIndicator('overtime_time')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedItems.map((row) => (
                                            (() => {
                                                const eventIssue = getEventIssue(row);

                                                return (
                                            <tr
                                                key={`${row.id}-${row.work_date}`}
                                                className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                                                onClick={() => openDayEvents(row)}
                                                title="Открыть историю проходов за день"
                                            >
                                                <td className="py-3 pl-6 pr-3">{fmtDate(row.work_date)}</td>
                                                <td className="py-3 pr-3 font-medium underline underline-offset-4">{fullName(row)}</td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.division ?? '—'}</td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.position ?? '—'}</td>
                                                <td className="py-3 pr-3 font-medium text-emerald-700">{fmtTimeList(row.enter_times, row.first_enter_time)}</td>
                                                <td className="py-3 pr-3 font-medium text-red-600">
                                                    {fmtTimeList(row.exit_times, row.last_exit_time)}
                                                    {eventIssue && (
                                                        <div className="text-[11px] font-normal text-amber-600">{eventIssue}</div>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-3 font-semibold">{fmtDuration(row.work_time)}</td>
                                                <td className="py-3 pr-3 font-semibold text-red-600">{fmtDuration(row.overtime_time)}</td>
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

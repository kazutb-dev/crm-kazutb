import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { AlertCircle, Clock3, Download, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function PercoLate({ staff, divisions = [], filters = {}, range = {}, summary = {}, divisionStats = [], latestLateDate = null }) {
    const items = staff?.data ?? [];
    const links = staff?.links ?? [];
    const meta  = staff?.meta  ?? {};

    const [q, setQ]               = useState(filters.q ?? '');
    const [division, setDivision] = useState(filters.division ?? '');
    const [days, setDays]         = useState(String(filters.days ?? 1));
    const [sortConfig, setSortConfig] = useState({ key: 'full_name', dir: 'asc' });
    const [fromDate, setFromDate] = useState(filters.from ?? '');
    const searchRef               = useRef(null);

    // Синхронизируем состояние с props когда они меняются
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
        router.get(
            route('hr.perco.late'),
            params,
            { preserveState: false, preserveScroll: true },
        );
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters();
    };

    const handleDivisionChange = (e) => {
        const v = e.target.value;
        setDivision(v);
        applyFilters({ division: v });
    };

    const handleDaysChange = (e) => {
        const v = e.target.value;
        setDays(v);
        setFromDate('');
        applyFilters({ days: v, from: '' });
    };

    const handleFromDateChange = (e) => {
        const v = e.target.value;
        setFromDate(v);
        applyFilters({ from: v });
    };

    const openEmployee = (row) => {
        router.get(route('hr.perco.late.employee'), {
            user_id: row.id,
            q,
            division,
            from: range.from,
            to: range.to,
        });
    };

    const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const fmtMinutes = (seconds) => {
        const value = Number(seconds ?? 0);
        if (!Number.isFinite(value) || value <= 0) return '0';
        return String(Math.ceil(value / 60));
    };

    const fullName = (row) =>
        [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ') || '—';

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
        if (key === 'full_name') return fullName(row);
        if (key === 'division') return row.division ?? '';
        if (key === 'position') return row.position ?? '';
        if (key === 'late_count') return Number(row.late_count ?? 0);
        if (key === 'total_late_time') return Number(row.total_late_time ?? 0);
        if (key === 'avg_late_time') return Number(row.avg_late_time ?? 0);
        if (key === 'last_late_date') return row.last_late_date ?? '';
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

    const totalEvents = Number(summary?.late_events ?? 0);
    const totalPeople = Number(summary?.late_people ?? 0);
    const totalLateMinutes = fmtMinutes(summary?.total_late_time ?? 0);
    const avgLateMinutes = fmtMinutes(summary?.avg_late_time ?? 0);
    const maxDivisionEvents = divisionStats.length > 0
        ? Math.max(...divisionStats.map((x) => Number(x.late_events ?? 0)))
        : 0;
    const latestLateDateLabel = latestLateDate ? fmtDate(latestLateDate) : null;

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_perco_late.csv',
            columns: [
                { header: 'ФИО', getValue: (row) => fullName(row) },
                { header: 'Подразделение', key: 'division' },
                { header: 'Должность', key: 'position' },
                { header: 'Кол-во опозданий', key: 'late_count' },
                { header: 'Суммарно (мин)', getValue: (row) => fmtMinutes(row.total_late_time) },
                { header: 'Среднее (мин)', getValue: (row) => fmtMinutes(row.avg_late_time) },
                { header: 'Последнее опоздание', getValue: (row) => fmtDate(row.last_late_date) },
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
                        placeholder="ФИО, табельный номер…"
                        className="h-8 w-64"
                    />
                    <Button size="sm" type="submit">
                        <Search className="mr-1 h-4 w-4" />
                        Найти
                    </Button>
                </form>
            }
        >
            <Head title="HR / Опоздавшие" />

            <div className="space-y-4 p-4 sm:p-6 lg:p-8">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Division filter */}
                    <select
                        value={division}
                        onChange={handleDivisionChange}
                        className="h-9 rounded-md border bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">Все подразделения</option>
                        {divisions.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
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

                    <Input
                        type="date"
                        value={fromDate}
                        onChange={handleFromDateChange}
                        className="h-9 w-[160px]"
                    />

                    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-1 h-4 w-4" />
                        Экспорт в Excel
                    </Button>

                    {meta?.total != null && (
                        <span className="ml-auto text-sm text-muted-foreground">
                            Сотрудников в рейтинге: <strong>{meta.total}</strong>
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Событий опоздания</p>
                                <p className="text-2xl font-semibold">{totalEvents}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-orange-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Опоздавших сотрудников</p>
                                <p className="text-2xl font-semibold">{totalPeople}</p>
                            </div>
                            <Users className="h-5 w-5 text-blue-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Суммарно, минут</p>
                                <p className="text-2xl font-semibold">{totalLateMinutes}</p>
                            </div>
                            <AlertCircle className="h-5 w-5 text-red-600" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Среднее опоздание, минут</p>
                                <p className="text-2xl font-semibold">{avgLateMinutes}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-purple-600" />
                        </CardContent>
                    </Card>
                </div>

                {totalEvents === 0 && latestLateDateLabel && (
                    <Card className="border-orange-200 bg-orange-50/60">
                        <CardContent className="p-4 text-sm text-orange-900">
                            За выбранный период данных об опозданиях нет. Последняя доступная дата в PERCo: <strong>{latestLateDateLabel}</strong>.
                        </CardContent>
                    </Card>
                )}

                {/* Table */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            Dashboard опозданий: кто сколько раз опоздал
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {items.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">Нет данных.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                                            <th className="py-3 pl-6 pr-3 font-medium"><button type="button" onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('late_count')}>Кол-во опозданий{sortIndicator('late_count')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('total_late_time')}>Суммарно (мин){sortIndicator('total_late_time')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('avg_late_time')}>Среднее (мин){sortIndicator('avg_late_time')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('last_late_date')}>Последнее опоздание{sortIndicator('last_late_date')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedItems.map((row) => (
                                            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                                                <td className="py-3 pl-6 pr-3 font-medium">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEmployee(row)}
                                                        className="text-left text-blue-700 hover:underline"
                                                    >
                                                        {fullName(row)}
                                                    </button>
                                                </td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.division ?? '—'}</td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.position ?? '—'}</td>
                                                <td className="py-3 pr-3 font-semibold">{row.late_count ?? 0}</td>
                                                <td className="py-3 pr-3 font-semibold text-red-600">{fmtMinutes(row.total_late_time)}</td>
                                                <td className="py-3 pr-3">{fmtMinutes(row.avg_late_time)}</td>
                                                <td className="py-3 pr-3">{fmtDate(row.last_late_date)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
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

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Подразделения с наибольшим числом опозданий</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {divisionStats.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Нет данных по подразделениям.</p>
                        ) : (
                            <div className="space-y-3">
                                {divisionStats.map((row, idx) => {
                                    const events = Number(row.late_events ?? 0);
                                    const people = Number(row.late_people ?? 0);
                                    const width = maxDivisionEvents > 0 ? Math.max(6, Math.round((events / maxDivisionEvents) * 100)) : 0;

                                    return (
                                        <div key={`${row.division}-${idx}`}>
                                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                                <span className="truncate font-medium">{row.division || 'Без подразделения'}</span>
                                                <span className="text-muted-foreground">{events} опозданий • {people} сотрудников</span>
                                            </div>
                                            <div className="h-2 rounded bg-muted">
                                                <div className="h-2 rounded bg-orange-500" style={{ width: `${width}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

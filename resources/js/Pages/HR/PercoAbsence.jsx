import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, FormField, Notice, PageHeader, StatGrid, StatTile, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { CircleX, Clock3, Download, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function PercoAbsence({ staff, divisions = [], filters = {}, summary = {}, divisionStats = [], latestAbsenceDate = null }) {
    const items = staff?.data ?? [];
    const links = staff?.links ?? [];
    const meta = staff?.meta ?? {};

    const [q, setQ] = useState(filters.q ?? '');
    const [division, setDivision] = useState(filters.division ?? '');
    const [days, setDays] = useState(String(filters.days ?? 1));
    const [sortConfig, setSortConfig] = useState({ key: 'full_name', dir: 'asc' });
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
        router.get(route('hr.perco.absence'), params, { preserveState: false, preserveScroll: true });
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

    const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const fmtMinutes = (seconds) => {
        const value = Number(seconds ?? 0);
        if (!Number.isFinite(value) || value <= 0) return '0';
        return String(Math.ceil(value / 60));
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
        if (key === 'full_name') return fullName(row);
        if (key === 'division') return row.division ?? '';
        if (key === 'position') return row.position ?? '';
        if (key === 'absence_count') return Number(row.absence_count ?? 0);
        if (key === 'last_absence_date') return row.last_absence_date ?? '';
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

    const totalEvents = Number(summary?.absence_events ?? 0);
    const totalPeople = Number(summary?.absence_people ?? 0);
    const totalAbsentMinutes = fmtMinutes(summary?.total_absent_time ?? 0);
    const avgAbsentMinutes = fmtMinutes(summary?.avg_absent_time ?? 0);
    const maxDivisionEvents = divisionStats.length > 0
        ? Math.max(...divisionStats.map((x) => Number(x.absence_events ?? 0)))
        : 0;
    const latestAbsenceDateLabel = latestAbsenceDate ? fmtDate(latestAbsenceDate) : null;

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_perco_absence.csv',
            columns: [
                { header: 'ФИО', getValue: (row) => fullName(row) },
                { header: 'Подразделение', key: 'division' },
                { header: 'Должность', key: 'position' },
                { header: 'Кол-во отсутствий', key: 'absence_count' },
                { header: 'Последнее отсутствие', getValue: (row) => fmtDate(row.last_absence_date) },
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
                    title="Отсутствующие"
                    description="Кто не пришёл на работу: события отсутствия по сотрудникам и подразделениям за выбранный период."
                    meta={meta?.total != null ? <StatusBadge tone="default">Сотрудников в рейтинге: {meta.total}</StatusBadge> : null}
                    actions={(
                        <Button type="button" variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4" />
                            Экспорт в Excel
                        </Button>
                    )}
                />
            )}
        >
            <Head title="HR / Отсутствующие" />

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
                                    placeholder="ФИО, табельный номер…"
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
                    <StatTile label="Событий отсутствия" value={totalEvents} icon={CircleX} tone="danger" />
                    <StatTile label="Отсутствующих сотрудников" value={totalPeople} icon={Users} tone="info" />
                    <StatTile label="Суммарно, минут" value={totalAbsentMinutes} icon={Clock3} tone="danger" />
                    <StatTile label="Среднее отсутствие, минут" value={avgAbsentMinutes} icon={Clock3} tone="navy" />
                </StatGrid>

                {totalEvents === 0 && latestAbsenceDateLabel && (
                    <Notice tone="danger">
                        За выбранный период данных об отсутствии нет. Последняя доступная дата в PERCo: <strong>{latestAbsenceDateLabel}</strong>.
                    </Notice>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CircleX className="shrink-0" />
                            Dashboard отсутствий: кто не пришел на работу
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {items.length === 0 ? (
                            <p className="px-6 py-10 text-center text-sm text-slate-500">Нет данных.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th className="py-3 pl-6 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('absence_count')}>Кол-во отсутствий{sortIndicator('absence_count')}</button></th>
                                            <th className="py-3 pr-3"><button type="button" className={SORT_BTN} onClick={() => toggleSort('last_absence_date')}>Последнее отсутствие{sortIndicator('last_absence_date')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedItems.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-200 last:border-0">
                                                <td className="py-3 pl-6 pr-3 font-medium text-slate-900">{fullName(row)}</td>
                                                <td className="py-3 pr-3 text-slate-500">{row.division ?? '—'}</td>
                                                <td className="py-3 pr-3 text-slate-500">{row.position ?? '—'}</td>
                                                <td className="py-3 pr-3 font-semibold tabular-nums text-[#102945]">{row.absence_count ?? 0}</td>
                                                <td className="py-3 pr-3 tabular-nums text-slate-700">{fmtDate(row.last_absence_date)}</td>
                                            </tr>
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

                <Card>
                    <CardHeader>
                        <CardTitle>Подразделения с наибольшим числом отсутствий</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {divisionStats.length === 0 ? (
                            <p className="text-sm text-slate-500">Нет данных по подразделениям.</p>
                        ) : (
                            <div className="space-y-4">
                                {divisionStats.map((row, idx) => {
                                    const events = Number(row.absence_events ?? 0);
                                    const people = Number(row.absence_people ?? 0);
                                    const width = maxDivisionEvents > 0 ? Math.max(6, Math.round((events / maxDivisionEvents) * 100)) : 0;

                                    return (
                                        <div key={`${row.division}-${idx}`}>
                                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                                <span className="truncate font-medium text-slate-900">{row.division || 'Без подразделения'}</span>
                                                <span className="text-slate-500">{events} отсутствий • {people} сотрудников</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-2 rounded-full bg-red-500" style={{ width: `${width}%` }} />
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

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, FormField, PageHeader, StatusBadge, qdFieldClass } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { Download, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function Perco({ staff, divisions = [], filters = {} }) {
    const items = staff?.data ?? [];
    const links = staff?.links ?? [];
    const meta  = staff?.meta  ?? {};

    const [q, setQ]               = useState(filters.q ?? '');
    const [division, setDivision] = useState(filters.division ?? '');
    const [sortConfig, setSortConfig] = useState({ key: 'full_name', dir: 'asc' });
    const searchRef               = useRef(null);

    // Синхронизируем состояние с props когда они меняются
    useEffect(() => {
        setQ(filters.q ?? '');
        setDivision(filters.division ?? '');
    }, [filters]);

    const applyFilters = (overrides = {}) => {
        const params = { q, division, ...overrides };
        router.get(
            route('hr.perco.index'),
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

    const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
        if (key === 'hiring_date') return row.hiring_date ?? '';
        if (key === 'status') {
            if (row.is_dismissed) return '2';
            if (row.is_active && !row.is_block) return '1';
            return '0';
        }
        return '';
    };

    const displayedItems = useMemo(() => {
        const sorted = [...items];
        sorted.sort((a, b) => {
            const aVal = String(getSortValue(a, sortConfig.key));
            const bVal = String(getSortValue(b, sortConfig.key));
            const compare = aVal.localeCompare(bVal, 'ru', { sensitivity: 'base' });
            return sortConfig.dir === 'asc' ? compare : -compare;
        });
        return sorted;
    }, [items, sortConfig]);

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_perco_staff.csv',
            columns: [
                { header: 'ФИО', getValue: (row) => fullName(row) },
                { header: 'Подразделение', key: 'division' },
                { header: 'Должность', key: 'position' },
                { header: 'Дата приема', getValue: (row) => fmtDate(row.hiring_date) },
                {
                    header: 'Статус',
                    getValue: (row) => {
                        if (row.is_dismissed) return 'Уволен';
                        if (row.is_active && !row.is_block) return 'Активен';
                        return 'Заблокирован';
                    },
                },
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
                    title="Сотрудники"
                    description="Справочник сотрудников из системы контроля доступа: подразделение, должность, дата приёма и статус."
                    meta={meta?.total != null ? <StatusBadge tone="default">Найдено: {meta.total}</StatusBadge> : null}
                    actions={(
                        <Button type="button" variant="outline" onClick={handleExport}>
                            <Download className="h-4 w-4" />
                            Экспорт в Excel
                        </Button>
                    )}
                />
            )}
        >
            <Head title="HR / Сотрудники" />

            <div className="admin-page-wrap space-y-6">
                {/* Filters */}
                <FilterBar>
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
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
                                <select
                                    value={division}
                                    onChange={handleDivisionChange}
                                    className={qdFieldClass}
                                >
                                    <option value="">Все подразделения</option>
                                    {divisions.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
                            <span className="text-xs font-medium text-slate-500">
                                {meta?.total != null ? <>Найдено: <span className="tabular-nums">{meta.total}</span></> : null}
                            </span>
                            <Button type="submit">
                                <Search className="h-4 w-4" />
                                Найти
                            </Button>
                        </div>
                    </form>
                </FilterBar>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="shrink-0" />
                            Все сотрудники
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-0">
                        {items.length === 0 ? (
                            <p className="px-5 py-12 text-center text-sm text-slate-500">Нет данных.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button>
                                            </th>
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button>
                                            </th>
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button>
                                            </th>
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('hiring_date')}>Дата приёма{sortIndicator('hiring_date')}</button>
                                            </th>
                                            <th>
                                                <button type="button" className={SORT_BTN} onClick={() => toggleSort('status')}>Статус{sortIndicator('status')}</button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedItems.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-200 last:border-0">
                                                <td className="font-medium text-slate-900">{fullName(row)}</td>
                                                <td className="text-slate-600">{row.division ?? '—'}</td>
                                                <td className="text-slate-600">{row.position ?? '—'}</td>
                                                <td className="tabular-nums text-slate-700">{fmtDate(row.hiring_date)}</td>
                                                <td>
                                                    {row.is_dismissed ? (
                                                        <StatusBadge tone="danger">
                                                            Уволен{row.dismissed_date ? ' ' + fmtDate(row.dismissed_date) : ''}
                                                        </StatusBadge>
                                                    ) : row.is_active && !row.is_block ? (
                                                        <StatusBadge tone="success">
                                                            Активен
                                                        </StatusBadge>
                                                    ) : (
                                                        <StatusBadge tone="default">
                                                            Заблокирован
                                                        </StatusBadge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
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

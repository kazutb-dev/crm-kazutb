import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
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
            <Head title="HR / Сотрудники" />

            <div className="admin-page-wrap">
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

                    <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-1 h-4 w-4" />
                        Экспорт в Excel
                    </Button>

                    {meta?.total != null && (
                        <span className="ml-auto text-sm text-muted-foreground">
                            Найдено: <strong>{meta.total}</strong>
                        </span>
                    )}
                </div>

                {/* Table */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-4 w-4" />
                            Все сотрудники
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {items.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">Нет данных.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                                            <th className="py-3 pl-6 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('full_name')}>ФИО{sortIndicator('full_name')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('division')}>Подразделение{sortIndicator('division')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('hiring_date')}>Дата приёма{sortIndicator('hiring_date')}</button>
                                            </th>
                                            <th className="py-3 pr-3 font-medium">
                                                <button type="button" onClick={() => toggleSort('status')}>Статус{sortIndicator('status')}</button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedItems.map((row) => (
                                            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                                                <td className="py-3 pl-6 pr-3 font-medium">{fullName(row)}</td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.division ?? '—'}</td>
                                                <td className="py-3 pr-3 text-muted-foreground">{row.position ?? '—'}</td>
                                                <td className="py-3 pr-3">{fmtDate(row.hiring_date)}</td>
                                                <td className="py-3 pr-3">
                                                    {row.is_dismissed ? (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Уволен{row.dismissed_date ? ' ' + fmtDate(row.dismissed_date) : ''}
                                                        </Badge>
                                                    ) : row.is_active && !row.is_block ? (
                                                        <Badge variant="outline" className="border-green-600 text-green-700 text-xs">
                                                            Активен
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Заблокирован
                                                        </Badge>
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

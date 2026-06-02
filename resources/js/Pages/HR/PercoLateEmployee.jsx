import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Clock3, Download, UserRound } from 'lucide-react';
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

    return (
        <AuthenticatedLayout>
            <Head title="HR / Карточка опозданий сотрудника" />

            <div className="admin-page-wrap">
                <div className="flex items-center gap-3">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.get(route('hr.perco.late'), filters, { preserveScroll: true })}
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Назад
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={handleExport}>
                        <Download className="mr-1 h-4 w-4" />
                        Экспорт в Excel
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <UserRound className="h-4 w-4 text-blue-600" />
                            Карточка сотрудника
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <p className="text-xs text-muted-foreground">ФИО</p>
                            <p className="font-semibold">{fullName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Подразделение</p>
                            <p className="font-semibold">{employee?.division ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Должность</p>
                            <p className="font-semibold">{employee?.position ?? '—'}</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Кол-во опозданий</p>
                                <p className="text-2xl font-semibold">{employee?.late_count ?? 0}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-orange-600" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Суммарно (мин)</p>
                                <p className="text-2xl font-semibold">{fmtMinutes(employee?.total_late_time ?? 0)}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-red-600" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Среднее (мин)</p>
                                <p className="text-2xl font-semibold">{fmtMinutes(employee?.avg_late_time ?? 0)}</p>
                            </div>
                            <Clock3 className="h-5 w-5 text-purple-600" />
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Полная информация по опозданиям</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {events.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">За выбранный период опозданий нет.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                                            <th className="py-3 pl-6 pr-3 font-medium"><button type="button" onClick={() => toggleSort('late_date')}>Дата{sortIndicator('late_date')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('first_enter_time')}>Во сколько зашел{sortIndicator('first_enter_time')}</button></th>
                                            <th className="py-3 pr-6 font-medium"><button type="button" onClick={() => toggleSort('late_time')}>На сколько опоздал (мин){sortIndicator('late_time')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedEvents.map((row, idx) => (
                                            <tr key={`${row.late_date}-${idx}`} className="border-b last:border-0 hover:bg-muted/30">
                                                <td className="py-3 pl-6 pr-3">{fmtDate(row.late_date)}</td>
                                                <td className="py-3 pr-3 font-semibold">{fmtTime(row.first_enter_time)}</td>
                                                <td className="py-3 pr-6 font-semibold text-red-600">{fmtMinutes(row.late_time)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

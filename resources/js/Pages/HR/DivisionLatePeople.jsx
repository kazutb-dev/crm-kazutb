import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Download, Users } from 'lucide-react';
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

    return (
        <AuthenticatedLayout>
            <Head title="Опоздавшие сотрудники" />

            <div className="space-y-4 p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
                <div className="flex items-center gap-3 mb-6">
                    <Button
                        onClick={handleBack}
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Назад
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Экспорт в Excel
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{divisionName}</h1>
                        <p className="text-sm text-slate-600">с {formatDate(from)} по {formatDate(to)}</p>
                    </div>
                </div>

                <Card className="border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-200">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                            <Users className="h-5 w-5 text-blue-600" />
                            Список ({rows.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {rows.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-sm text-slate-500">Нет опоздавших сотрудников за выбранный период</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr className="border-b bg-slate-50 text-left text-slate-600">
                                            <th className="py-3 pl-4 pr-3 font-medium">#</th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('late_date')}>Дата{sortIndicator('late_date')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('name')}>ФИО{sortIndicator('name')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('position')}>Должность{sortIndicator('position')}</button></th>
                                            <th className="py-3 pr-3 font-medium"><button type="button" onClick={() => toggleSort('first_enter_time')}>Во сколько зашел{sortIndicator('first_enter_time')}</button></th>
                                            <th className="py-3 pr-4 font-medium"><button type="button" onClick={() => toggleSort('late_minutes')}>На сколько опоздал{sortIndicator('late_minutes')}</button></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedRows.map((person, idx) => (
                                            <tr key={person.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="py-3 pl-4 pr-3 font-semibold text-slate-500">{idx + 1}</td>
                                                <td className="py-3 pr-3">{formatDate(person.late_date)}</td>
                                                <td className="py-3 pr-3 font-medium text-slate-900">{person.name}</td>
                                                <td className="py-3 pr-3 text-slate-600">{person.position || '—'}</td>
                                                <td className="py-3 pr-3 font-semibold">{formatTime(person.first_enter_time)}</td>
                                                <td className="py-3 pr-4 font-semibold text-red-600">{formatLate(person.late_minutes)}</td>
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

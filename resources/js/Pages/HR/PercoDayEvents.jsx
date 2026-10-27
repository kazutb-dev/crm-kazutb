import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { InfoField, PageHeader, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToExcelCsv } from '@/lib/exportCsv';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Clock3, Download, UserRound } from 'lucide-react';

export default function PercoDayEvents({ employee = null, events = [], date = '', back = '' }) {
    const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const fmtTime = (value) => {
        if (!value) return '—';
        return String(value).slice(11, 19);
    };

    const fullName = employee
        ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(' ')
        : 'Сотрудник';

    const goBack = () => {
        if (back) {
            window.location.href = back;
            return;
        }

        router.get(route('hr.perco.overtime'));
    };

    const handleExport = () => {
        exportToExcelCsv({
            fileName: 'hr_day_events.csv',
            columns: [
                { header: 'Дата', getValue: () => fmtDate(date) },
                { header: 'ФИО', getValue: () => fullName },
                { header: 'Время прохода', getValue: (row) => fmtTime(row.time_label) },
                { header: 'Выход из', key: 'zone_exit' },
                { header: 'Вход в', key: 'zone_enter' },
                { header: 'Устройство', getValue: (row) => (row.device_id ? `#${row.device_id}` : '—') },
                { header: 'Тип события', getValue: (row) => `${row.event_type || '—'}${row.ignored ? ' (игнор)' : ''}` },
                { header: 'Направление', getValue: (row) => (row.direction === 'exit' ? 'Выход' : row.direction === 'enter' ? 'Вход' : '—') },
            ],
            rows: events,
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="HR · История проходов за день"
                    title={fullName || 'Сотрудник'}
                    description={`История проходов за ${fmtDate(date)}`}
                    meta={<StatusBadge tone="default">Событий: {events.length}</StatusBadge>}
                    actions={(
                        <>
                            <Button variant="outline" onClick={goBack}>
                                <ArrowLeft className="h-4 w-4" />
                                Назад
                            </Button>
                            <Button variant="outline" type="button" onClick={handleExport}>
                                <Download className="h-4 w-4" />
                                Экспорт в Excel
                            </Button>
                        </>
                    )}
                />
            )}
        >
            <Head title="HR / История проходов за день" />

            <div className="admin-page-wrap space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserRound className="shrink-0" />
                            История проходов за {fmtDate(date)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <InfoField label="ФИО">{fullName}</InfoField>
                        <InfoField label="Подразделение">{employee?.division ?? '—'}</InfoField>
                        <InfoField label="Должность">{employee?.position ?? '—'}</InfoField>
                        <InfoField label="Событий"><span className="tabular-nums">{events.length}</span></InfoField>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <Clock3 className="shrink-0" />
                                Все проходы за день
                            </CardTitle>
                            <div className="flex items-center gap-4 text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Вход</span>
                                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Выход</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-0">
                        {events.length === 0 ? (
                            <p className="px-5 py-12 text-center text-sm text-slate-500">Нет событий за выбранный день.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th>Время прохода</th>
                                            <th>Выход из</th>
                                            <th>Вход в</th>
                                            <th>Устройство</th>
                                            <th>Тип события</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map((row) => {
                                            const rowClass = row.direction === 'exit'
                                                ? 'bg-red-50 hover:bg-red-100/70'
                                                : row.direction === 'enter'
                                                    ? 'bg-emerald-50 hover:bg-emerald-100/70'
                                                    : '';
                                            const railClass = row.direction === 'exit'
                                                ? 'border-l-red-500'
                                                : row.direction === 'enter'
                                                    ? 'border-l-emerald-500'
                                                    : 'border-l-transparent';

                                            return (
                                                <tr key={row.id} className={`border-b border-slate-200 last:border-0 ${rowClass}`}>
                                                    <td className={`border-l-[3px] font-mono text-xs font-semibold text-[#102945] sm:text-sm ${railClass}`}>{fmtTime(row.time_label)}</td>
                                                    <td className="font-medium text-red-700">{row.zone_exit || '—'}</td>
                                                    <td className="font-medium text-emerald-700">{row.zone_enter || '—'}</td>
                                                    <td className="tabular-nums text-slate-600">{row.device_id ? `#${row.device_id}` : '—'}</td>
                                                    <td>
                                                        <span className={row.ignored ? 'text-orange-700' : 'text-slate-900'}>
                                                            {row.event_type || '—'}{row.ignored ? ' (игнор)' : ''}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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

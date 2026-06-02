import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
        <AuthenticatedLayout>
            <Head title="HR / История проходов за день" />

            <div className="admin-page-wrap">
                <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={goBack}>
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
                            История проходов за {fmtDate(date)}
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
                        <div>
                            <p className="text-xs text-muted-foreground">Событий</p>
                            <p className="font-semibold">{events.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Все проходы за день</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {events.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">Нет событий за выбранный день.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                                            <th className="py-3 pl-6 pr-3 font-medium">Время прохода</th>
                                            <th className="py-3 pr-3 font-medium">Выход из</th>
                                            <th className="py-3 pr-3 font-medium">Вход в</th>
                                            <th className="py-3 pr-3 font-medium">Устройство</th>
                                            <th className="py-3 pr-6 font-medium">Тип события</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map((row) => {
                                            const rowClass = row.direction === 'exit'
                                                ? 'bg-red-100/60 hover:bg-red-100/80'
                                                : row.direction === 'enter'
                                                    ? 'bg-emerald-100/60 hover:bg-emerald-100/80'
                                                    : 'hover:bg-muted/30';

                                            return (
                                                <tr key={row.id} className={`border-b last:border-0 ${rowClass}`}>
                                                    <td className="py-3 pl-6 pr-3 font-mono text-xs sm:text-sm">{fmtTime(row.time_label)}</td>
                                                    <td className="py-3 pr-3 font-medium text-red-600">{row.zone_exit || '—'}</td>
                                                    <td className="py-3 pr-3 font-medium text-emerald-700">{row.zone_enter || '—'}</td>
                                                    <td className="py-3 pr-3">{row.device_id ? `#${row.device_id}` : '—'}</td>
                                                    <td className="py-3 pr-6">
                                                        <span className={row.ignored ? 'text-orange-600' : 'text-foreground'}>
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

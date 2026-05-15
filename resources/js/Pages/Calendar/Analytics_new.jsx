import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';

const PERIODS = [
    { value: 'week',  label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
    { value: 'year',  label: 'Год' },
];

function StatCard({ label, value, total, color = 'bg-primary' }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <Card className="border-border/80 shadow-sm">
            <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold mt-1">{value}</p>
                {total > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}/>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function CalendarAnalytics({ stats, period = 'month' }) {
    function changePeriod(p) {
        router.get(route('calendar.analytics'), { period: p }, { preserveState: true });
    }

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-2xl font-semibold leading-tight text-gray-900">
                    Аналитика
                </h2>
            }
        >
            <Head title="Smart Calendar — Аналитика" />
            <div className="py-8">
                <div className="mx-auto sm:px-6 lg:px-8">
                    {/* Period switcher */}
                    <div className="flex rounded-lg border overflow-hidden w-fit mb-5">
                        {PERIODS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => changePeriod(p.value)}
                                className={`px-4 py-1.5 text-sm border-r last:border-r-0 transition-colors ${period === p.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* KPI cards */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 mb-5">
                        <StatCard label="Всего встреч"    value={stats.total}     total={stats.total} color="bg-blue-500"/>
                        <StatCard label="Завершено"        value={stats.completed} total={stats.total} color="bg-green-500"/>
                        <StatCard label="Отменено"         value={stats.cancelled} total={stats.total} color="bg-red-500"/>
                        <StatCard label="Ожидают решения"  value={stats.pending}   total={stats.total} color="bg-yellow-500"/>
                        <StatCard label="Дней отпуска"     value={stats.vacationDays} total={Math.max(stats.vacationDays + stats.businessTripDays, 1)} color="bg-green-600"/>
                        <StatCard label="Дней командировок" value={stats.businessTripDays} total={Math.max(stats.vacationDays + stats.businessTripDays, 1)} color="bg-violet-600"/>
                    </div>

                    {/* Completion rate */}
                    {stats.total > 0 && (
                        <Card className="border-border/80 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Показатели</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {[
                                    { label: 'Завершено', value: stats.completed, color: 'bg-green-500' },
                                    { label: 'Отменено',  value: stats.cancelled, color: 'bg-red-500' },
                                    { label: 'Ожидают',   value: stats.pending,   color: 'bg-yellow-500' },
                                ].map(row => {
                                    const pct = Math.round((row.value / stats.total) * 100);
                                    return (
                                        <div key={row.label}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>{row.label}</span>
                                                <span className="text-muted-foreground">{row.value} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }}/>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

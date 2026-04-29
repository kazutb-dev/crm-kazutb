import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';
import { BarChart3 } from 'lucide-react';

const PERIODS = [
    { value: 'week',  label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
    { value: 'year',  label: 'Год' },
];

function StatCard({ label, value, total, color = 'bg-primary' }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <Card>
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
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Аналитика" />
            <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-2.5">
                            <BarChart3 className="size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Аналитика календаря</h1>
                            <p className="text-sm text-muted-foreground">Показатели и статистика встреч</p>
                        </div>
                    </div>
                </div>

                {/* Period Selector */}
                <div className="flex rounded-lg border bg-muted/40 p-1 w-fit">
                    {PERIODS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => changePeriod(p.value)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                period === p.value 
                                    ? 'bg-white text-foreground shadow-sm dark:bg-slate-800' 
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* KPI Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    <StatCard label="Всего встреч"    value={stats.total}     total={stats.total} color="bg-blue-500"/>
                    <StatCard label="Завершено"        value={stats.completed} total={stats.total} color="bg-green-500"/>
                    <StatCard label="Отменено"         value={stats.cancelled} total={stats.total} color="bg-red-500"/>
                    <StatCard label="Ожидают решения"  value={stats.pending}   total={stats.total} color="bg-yellow-500"/>
                    <StatCard label="Дней отпуска"     value={stats.vacationDays} total={Math.max(stats.vacationDays + stats.businessTripDays, 1)} color="bg-green-600"/>
                    <StatCard label="Дней командировок" value={stats.businessTripDays} total={Math.max(stats.vacationDays + stats.businessTripDays, 1)} color="bg-violet-600"/>
                </div>

                {/* Completion Rate */}
                {stats.total > 0 && (
                    <Card className="hover:shadow-md transition-all duration-200">
                        <CardHeader className="pb-3">
                            <CardTitle>Показатели выполнения</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {[
                                { label: 'Завершено', value: stats.completed, color: 'bg-green-500' },
                                { label: 'Отменено',  value: stats.cancelled, color: 'bg-red-500' },
                                { label: 'Ожидают',   value: stats.pending,   color: 'bg-yellow-500' },
                            ].map(row => {
                                const pct = Math.round((row.value / stats.total) * 100);
                                return (
                                    <div key={row.label} className="space-y-2">
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-sm font-medium text-foreground">{row.label}</span>
                                            <span className="text-sm font-semibold text-muted-foreground">{row.value} <span className="text-xs font-normal">({pct}%)</span></span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${row.color}`} 
                                                style={{ width: `${pct}%` }}
                                            />
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

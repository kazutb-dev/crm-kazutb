import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';
import { BarChart3, Users } from 'lucide-react';

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

export default function CalendarAnalytics({ stats, adminStats, period = 'month', isAdmin = false }) {
    function changePeriod(p) {
        router.get(route('calendar.analytics'), { period: p }, { preserveState: true });
    }

    const displayStats = isAdmin && adminStats ? adminStats : stats;

    return (
        <AuthenticatedLayout>
            <Head title="Smart Calendar — Аналитика" />
            <div className="p-4 sm:p-6 space-y-5">

                {/* Mode indicator for admin */}
                {isAdmin && (
                    <div className="flex items-center gap-2">
                        <Badge className="bg-purple-500">
                            <BarChart3 className="w-3 h-3 mr-1" />
                            Общая аналитика
                        </Badge>
                    </div>
                )}

                {/* Period switcher */}
                <div className="flex rounded-lg border overflow-hidden w-fit">
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    {isAdmin && adminStats ? (
                        <>
                            <StatCard label="Встреч всего"     value={displayStats.total}      total={displayStats.total} color="bg-blue-500"/>
                            <StatCard label="Завершено"         value={displayStats.completed}  total={displayStats.total} color="bg-green-500"/>
                            <StatCard label="Отменено"          value={displayStats.cancelled}  total={displayStats.total} color="bg-red-500"/>
                            <StatCard label="Ожидают"           value={displayStats.pending}    total={displayStats.total} color="bg-yellow-500"/>
                            <StatCard label="Сотрудников"       value={displayStats.employeeCount} total={displayStats.employeeCount} color="bg-purple-500"/>
                            <StatCard label="Дни отпуска"       value={displayStats.vacationDays} total={Math.max(displayStats.vacationDays + displayStats.businessTripDays, 1)} color="bg-green-600"/>
                        </>
                    ) : (
                        <>
                            <StatCard label="Всего встреч"      value={displayStats.total}     total={displayStats.total} color="bg-blue-500"/>
                            <StatCard label="Завершено"         value={displayStats.completed} total={displayStats.total} color="bg-green-500"/>
                            <StatCard label="Отменено"          value={displayStats.cancelled} total={displayStats.total} color="bg-red-500"/>
                            <StatCard label="Ожидают решения"   value={displayStats.pending}   total={displayStats.total} color="bg-yellow-500"/>
                            <StatCard label="Дней отпуска"      value={displayStats.vacationDays} total={Math.max(displayStats.vacationDays + displayStats.businessTripDays, 1)} color="bg-green-600"/>
                            <StatCard label="Дней командировок" value={displayStats.businessTripDays} total={Math.max(displayStats.vacationDays + displayStats.businessTripDays, 1)} color="bg-violet-600"/>
                        </>
                    )}
                </div>

                {/* Completion rate */}
                {displayStats.total > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Показатели</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[
                                { label: 'Завершено', value: displayStats.completed, color: 'bg-green-500' },
                                { label: 'Отменено',  value: displayStats.cancelled, color: 'bg-red-500' },
                                { label: 'Ожидают',   value: displayStats.pending,   color: 'bg-yellow-500' },
                            ].map(row => {
                                const pct = Math.round((row.value / displayStats.total) * 100);
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

                {/* Admin breakdown by user */}
                {isAdmin && adminStats?.userStats && adminStats.userStats.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Статистика по сотрудникам
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-3 font-semibold">Сотрудник</th>
                                            <th className="text-center p-3 font-semibold">Встреч</th>
                                            <th className="text-center p-3 font-semibold">Завершено</th>
                                            <th className="text-center p-3 font-semibold">Отпуск</th>
                                            <th className="text-center p-3 font-semibold">Командировка</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adminStats.userStats.map((user, idx) => (
                                            <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/50">
                                                <td className="p-3">{user.name}</td>
                                                <td className="text-center p-3 font-semibold">{user.total}</td>
                                                <td className="text-center p-3">
                                                    <span className="text-green-600">{user.completed}</span>
                                                </td>
                                                <td className="text-center p-3">
                                                    <span className="text-green-600">{user.vacationDays} дн.</span>
                                                </td>
                                                <td className="text-center p-3">
                                                    <span className="text-violet-600">{user.businessTripDays} дн.</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

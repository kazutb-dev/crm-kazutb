import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader, Segmented, StatTile, StatusBadge } from '@/components/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';
import { BarChart3, Users } from 'lucide-react';

const PERIODS = [
    { value: 'week',  label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
    { value: 'year',  label: 'Год' },
];

function ShareBar({ value, total, color }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    if (!(total > 0)) return null;
    return (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}/>
        </div>
    );
}

function StatCard({ label, value, total, tone = 'teal', color = 'bg-teal-600' }) {
    return (
        <StatTile
            label={label}
            value={value}
            tone={tone}
            hint={total > 0 ? <ShareBar value={value} total={total} color={color} /> : null}
        />
    );
}

export default function CalendarAnalytics({ stats, adminStats, period = 'month', isAdmin = false }) {
    function changePeriod(p) {
        router.get(route('calendar.analytics'), { period: p }, { preserveState: true });
    }

    const displayStats = isAdmin && adminStats ? adminStats : stats;
    const tripTotal = Math.max(displayStats.vacationDays + displayStats.businessTripDays, 1);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Smart Calendar"
                    title="Аналитика"
                    description="Встречи, их исход, отпуска и командировки за выбранный период."
                    meta={isAdmin ? (
                        <StatusBadge tone="info">
                            <BarChart3 className="mr-1 h-3 w-3" />
                            Общая аналитика
                        </StatusBadge>
                    ) : null}
                    actions={(
                        <Segmented
                            items={PERIODS.map(p => ({ key: p.value, label: p.label }))}
                            value={period}
                            onChange={changePeriod}
                        />
                    )}
                />
            )}
        >
            <Head title="Smart Calendar — Аналитика" />
            <div className="admin-page-wrap space-y-6">

                {/* KPI tiles */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {isAdmin && adminStats ? (
                        <>
                            <StatCard label="Встреч всего"     value={displayStats.total}      total={displayStats.total} tone="info" color="bg-blue-600"/>
                            <StatCard label="Завершено"         value={displayStats.completed}  total={displayStats.total} tone="success" color="bg-emerald-600"/>
                            <StatCard label="Отменено"          value={displayStats.cancelled}  total={displayStats.total} tone="danger" color="bg-red-600"/>
                            <StatCard label="Ожидают"           value={displayStats.pending}    total={displayStats.total} tone="warning" color="bg-amber-500"/>
                            <StatCard label="Сотрудников"       value={displayStats.employeeCount} total={displayStats.employeeCount} tone="navy" color="bg-[#102945]"/>
                            <StatCard label="Дни отпуска"       value={displayStats.vacationDays} total={tripTotal} tone="teal" color="bg-teal-600"/>
                        </>
                    ) : (
                        <>
                            <StatCard label="Всего встреч"      value={displayStats.total}     total={displayStats.total} tone="info" color="bg-blue-600"/>
                            <StatCard label="Завершено"         value={displayStats.completed} total={displayStats.total} tone="success" color="bg-emerald-600"/>
                            <StatCard label="Отменено"          value={displayStats.cancelled} total={displayStats.total} tone="danger" color="bg-red-600"/>
                            <StatCard label="Ожидают решения"   value={displayStats.pending}   total={displayStats.total} tone="warning" color="bg-amber-500"/>
                            <StatCard label="Дней отпуска"      value={displayStats.vacationDays} total={tripTotal} tone="teal" color="bg-teal-600"/>
                            <StatCard label="Дней командировок" value={displayStats.businessTripDays} total={tripTotal} tone="copper" color="bg-orange-600"/>
                        </>
                    )}
                </div>

                {/* Completion rate */}
                {displayStats.total > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="shrink-0" />
                                Показатели
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { label: 'Завершено', value: displayStats.completed, color: 'bg-emerald-600' },
                                { label: 'Отменено',  value: displayStats.cancelled, color: 'bg-red-600' },
                                { label: 'Ожидают',   value: displayStats.pending,   color: 'bg-amber-500' },
                            ].map(row => {
                                const pct = Math.round((row.value / displayStats.total) * 100);
                                return (
                                    <div key={row.label}>
                                        <div className="mb-1.5 flex justify-between text-sm">
                                            <span className="font-medium text-slate-800">{row.label}</span>
                                            <span className="tabular-nums text-slate-500">{row.value} ({pct}%)</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="shrink-0" />
                                Статистика по сотрудникам
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="p-3 text-left">Сотрудник</th>
                                            <th className="p-3 text-center">Встреч</th>
                                            <th className="p-3 text-center">Завершено</th>
                                            <th className="p-3 text-center">Отпуск</th>
                                            <th className="p-3 text-center">Командировка</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adminStats.userStats.map((user, idx) => (
                                            <tr key={idx} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                <td className="p-3 font-medium text-slate-900">{user.name}</td>
                                                <td className="p-3 text-center font-semibold tabular-nums text-[#102945]">{user.total}</td>
                                                <td className="p-3 text-center tabular-nums">
                                                    <span className="text-emerald-700">{user.completed}</span>
                                                </td>
                                                <td className="p-3 text-center tabular-nums">
                                                    <span className="text-teal-700">{user.vacationDays} дн.</span>
                                                </td>
                                                <td className="p-3 text-center tabular-nums">
                                                    <span className="text-orange-700">{user.businessTripDays} дн.</span>
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

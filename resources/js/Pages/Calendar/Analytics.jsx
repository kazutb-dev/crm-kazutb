import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, PageHeader, Segmented, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';
import { BarChart3, Plane, Users } from 'lucide-react';

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
    const tripTotal = Math.max((displayStats.vacationDays ?? 0) + (displayStats.businessTripDays ?? 0), 1);
    const otherCount = Math.max((displayStats.total ?? 0) - (displayStats.completed ?? 0) - (displayStats.cancelled ?? 0) - (displayStats.pending ?? 0), 0);
    const hasUserTable = isAdmin && adminStats?.userStats && adminStats.userStats.length > 0;

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
                <StatGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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
                </StatGrid>

                {!(displayStats.total > 0) && (
                    <EmptyState
                        title="За выбранный период встреч нет"
                        description="Показатели и распределение по исходам появятся, когда в календаре будут встречи. Попробуйте выбрать другой период."
                    />
                )}

                {(displayStats.total > 0 || hasUserTable) && (
                    <div className={`grid gap-4 ${!(displayStats.total > 0) ? '' : hasUserTable ? 'xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:items-start' : 'lg:grid-cols-2'}`}>
                        {displayStats.total > 0 && (
                        <div className={hasUserTable ? 'space-y-4' : 'contents'}>
                            <Card>
                                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="shrink-0" />
                                        Исход встреч
                                    </CardTitle>
                                    <span className="text-xs font-semibold tabular-nums text-slate-500">Всего: {displayStats.total}</span>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[
                                        { label: 'Завершено', value: displayStats.completed, color: 'bg-emerald-600' },
                                        { label: 'Отменено',  value: displayStats.cancelled, color: 'bg-red-600' },
                                        { label: 'Ожидают',   value: displayStats.pending,   color: 'bg-amber-500' },
                                        { label: 'Прочие',    value: otherCount,             color: 'bg-slate-400' },
                                    ].filter(row => row.label !== 'Прочие' || row.value > 0).map(row => {
                                        const pct = Math.round((row.value / displayStats.total) * 100);
                                        return (
                                            <div key={row.label}>
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="font-medium text-slate-800">{row.label}</span>
                                                    <span className="tabular-nums text-slate-500"><span className="font-semibold text-[#102945]">{row.value}</span> · {pct}%</span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }}/>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Plane className="shrink-0" />
                                        Отсутствия
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[
                                        { label: 'Отпуск', value: displayStats.vacationDays ?? 0, color: 'bg-teal-600' },
                                        { label: 'Командировки', value: displayStats.businessTripDays ?? 0, color: 'bg-orange-600' },
                                    ].map(row => {
                                        const pct = Math.round((row.value / tripTotal) * 100);
                                        return (
                                            <div key={row.label}>
                                                <div className="mb-1 flex justify-between text-sm">
                                                    <span className="font-medium text-slate-800">{row.label}</span>
                                                    <span className="tabular-nums text-slate-500"><span className="font-semibold text-[#102945]">{row.value}</span> дн. · {pct}%</span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }}/>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">Всего дней отсутствия: <span className="font-semibold tabular-nums text-[#102945]">{(displayStats.vacationDays ?? 0) + (displayStats.businessTripDays ?? 0)}</span></p>
                                </CardContent>
                            </Card>
                        </div>
                        )}

                        {hasUserTable && (
                            <Card>
                                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="shrink-0" />
                                        Статистика по сотрудникам
                                    </CardTitle>
                                    <span className="text-xs font-semibold tabular-nums text-slate-500">{adminStats.userStats.length}</span>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200">
                                                    <th>Сотрудник</th>
                                                    <th className="text-right">Встреч</th>
                                                    <th className="text-right">Завершено</th>
                                                    <th className="text-right">% заверш.</th>
                                                    <th className="text-right">Отпуск</th>
                                                    <th className="text-right">Командировка</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {adminStats.userStats.map((user, idx) => (
                                                    <tr key={idx} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                                        <td className="font-medium text-slate-900">{user.name}</td>
                                                        <td className="text-right font-semibold tabular-nums text-[#102945]">{user.total}</td>
                                                        <td className="text-right tabular-nums">
                                                            <span className="text-emerald-700">{user.completed}</span>
                                                        </td>
                                                        <td className="text-right tabular-nums text-slate-600">
                                                            {user.total > 0 ? `${Math.round((user.completed / user.total) * 100)}%` : '—'}
                                                        </td>
                                                        <td className="text-right tabular-nums">
                                                            <span className="text-teal-700">{user.vacationDays} дн.</span>
                                                        </td>
                                                        <td className="text-right tabular-nums">
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
                )}
            </div>
        </AuthenticatedLayout>
    );
}

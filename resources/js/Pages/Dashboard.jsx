import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Briefcase,
    Database,
    ExternalLink,
    LayoutDashboard,
    MonitorDot,
    ScrollText,
    Telescope,
    Ticket,
    Users,
} from 'lucide-react';

// Module badge colors
const MODULE_COLORS = {
    auth: 'bg-slate-100 text-slate-700', kpi: 'bg-indigo-100 text-indigo-700',
    kpi_settings: 'bg-violet-100 text-violet-700', users: 'bg-cyan-100 text-cyan-700',
    positions: 'bg-rose-100 text-rose-700', tickets: 'bg-amber-100 text-amber-700',
    announcements: 'bg-yellow-100 text-yellow-700', calendar: 'bg-teal-100 text-teal-700',
    library: 'bg-green-100 text-green-700', certificates: 'bg-lime-100 text-lime-700',
    navigation: 'bg-pink-100 text-pink-700', directory: 'bg-orange-100 text-orange-700',
    system: 'bg-gray-100 text-gray-600',
};

const SEVERITY_DOT = {
    critical: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-blue-400', low: 'bg-gray-400',
};

const SEVERITY_ROW_BG = {
    critical: 'border-l-4 border-l-red-500',
    high: 'border-l-4 border-l-orange-400',
    medium: 'border-l-4 border-l-blue-300',
};

const ATTENTION_BORDER = {
    high: 'border-l-4 border-l-red-500 bg-red-50',
    medium: 'border-l-4 border-l-orange-400 bg-orange-50',
    ok: 'border-l-4 border-l-green-400 bg-green-50',
};

const KPI_STATUS_LABELS = {
    draft: 'Черновик', pending: 'На согласовании', approved: 'Утверждён',
    rejected: 'Отклонён', submitted: 'Отправлен', completed: 'Завершён',
};

const QUICK_LINK_ICONS = {
    monitor: MonitorDot, scroll: ScrollText, activity: Activity,
    telescope: ExternalLink, database: Database,
};

const CHART_TOOLTIP_SLOT_PROPS = {
    tooltip: {
        trigger: 'item',
        anchor: 'pointer',
        placement: 'right-start',
        disablePortal: false,
        sx: {
            zIndex: 9999,
            pointerEvents: 'none',
            '& .MuiChartsTooltip-paper': {
                borderRadius: '0.6rem',
                border: '1px solid rgb(226 232 240)',
                boxShadow: '0 8px 28px rgba(15, 23, 42, 0.16)',
                backgroundColor: 'rgba(255,255,255,0.98)',
            },
        },
    },
};

function ModuleBadge({ module, label }) {
    const cls = MODULE_COLORS[module] || MODULE_COLORS.system;
    return (
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
            {label || module || '—'}
        </span>
    );
}

function SeverityDot({ severity }) {
    const dot = SEVERITY_DOT[severity] || 'bg-gray-300';
    return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block ${dot}`} />;
}

const accentClasses = {
    navy: 'from-[#123153] to-[#1f4e7a]',
    sky: 'from-[#0a84c1] to-[#0fb0c9]',
    amber: 'from-[#cc7a09] to-[#eea622]',
    rose: 'from-[#a83059] to-[#dc5f7d]',
    teal: 'from-[#0f766e] to-[#0ea5a4]',
    violet: 'from-[#5b3cc4] to-[#8a5cf6]',
};

const severityLabel = {
    high: 'Высокий приоритет',
    medium: 'Требует внимания',
    ok: 'Норма',
};

const severityVariant = {
    high: 'destructive',
    medium: 'secondary',
    ok: 'outline',
};

function formatDate(value) {
    if (!value) {
        return '—';
    }

    return new Date(value).toLocaleString('ru-RU');
}

function buildActivitySearchText(row) {
    return [
        formatDate(row.created_at),
        row.source,
        row.module,
        row.module_label,
        row.actor_name,
        row.actor_email,
        row.event_label,
        row.subject_name,
        row.subject_label,
        row.description,
        row.ip_address,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export default function Dashboard({
    stats = {},
    overviewCards = [],
    modules = [],
    usersByRole = [],
    kpiByStatus = [],
    ticketsByStatus = [],
    calendarByStatus = [],
    trend = [],
    activityFeed = [],
    attention = [],
    quickLinks = [],
}) {
    const [activitySearch, setActivitySearch] = useState('');

    const today = new Date().toLocaleString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const kpiPieData = kpiByStatus.map((item, index) => ({
        id: index,
        value: item.count,
        label: item.status,
    }));

    const ticketsBar = ticketsByStatus.map((item) => ({
        status: item.status,
        count: item.count,
    }));

    const calendarBar = calendarByStatus.map((item) => ({
        status: item.status,
        count: item.count,
    }));

    const roleBar = usersByRole.map((item) => ({
        role: item.label,
        count: item.count,
    }));

    const filteredActivityFeed = useMemo(() => {
        const q = activitySearch.trim().toLowerCase();
        if (!q) {
            return activityFeed;
        }

        return activityFeed.filter((row) => buildActivitySearchText(row).includes(q));
    }, [activityFeed, activitySearch]);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold leading-tight text-[#132844]">Панель управления CRM</h2>
                        <p className="text-sm text-muted-foreground">Системный обзор по всем ключевым модулям</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                        <div>{today}</div>
                        <div>Источник метрик: {stats.metrics_source ?? 'database'}</div>
                    </div>
                </div>
            }
        >
            <Head title="Панель управления" />

            <div className="admin-page-wrap space-y-5">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    {overviewCards.map((card) => (
                        <Link key={card.key} href={card.route || '#'} className="block">
                            <article
                                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl cursor-pointer ${accentClasses[card.accent] ?? accentClasses.navy}`}
                            >
                                <div className="text-xs uppercase tracking-wide text-white/70">{card.title}</div>
                                <div className="mt-2 text-4xl font-semibold leading-none">{card.value}</div>
                                <div className="mt-2 text-xs text-white/75">{card.hint}</div>
                                <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
                            </article>
                        </Link>
                    ))}
                </section>

                <section className="grid gap-5 xl:grid-cols-3">
                    <Card className="admin-surface xl:col-span-2 relative z-30 overflow-visible">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LayoutDashboard className="h-5 w-5" />
                                Модули CRM
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            {modules.map((module) => (
                                <Link key={module.key} href={module.route} className="rounded-xl border bg-background/70 p-4 transition hover:bg-accent/20">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="font-semibold">{module.title}</h4>
                                        <Badge variant="outline">Всего: {module.total}</Badge>
                                    </div>
                                    <div className="mt-2 text-sm text-muted-foreground">{module.secondary}</div>
                                    <div className="mt-2 text-sm">
                                        <span className="font-medium">Ожидает/внимание:</span> {module.pending}
                                    </div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="admin-surface relative z-20 overflow-visible">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Зоны внимания
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {attention.map((item) => (
                                <Link
                                    key={item.key}
                                    href={item.route}
                                    className={`block rounded-lg border p-3 transition hover:opacity-90 ${ATTENTION_BORDER[item.severity] || 'border-slate-200 bg-background/70'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium">{item.title}</div>
                                        <Badge variant={severityVariant[item.severity] ?? 'outline'}>{item.value}</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">{severityLabel[item.severity] ?? 'Норма'} · {item.hint}</div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-5 xl:grid-cols-3">
                    <Card className="admin-surface xl:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Динамика активности
                                <span className="ml-auto text-xs font-normal text-muted-foreground">за 14 дней</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-visible">
                            <LineChart
                                dataset={trend}
                                xAxis={[{ scaleType: 'point', dataKey: 'day' }]}
                                series={[
                                    { dataKey: 'activity', label: 'Activity', color: '#8a5cf6' },
                                    { dataKey: 'audit', label: 'Audit', color: '#0f766e' },
                                    { dataKey: 'tickets', label: 'Тикеты', color: '#cc7a09' },
                                ]}
                                slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                height={300}
                            />
                        </CardContent>
                    </Card>

                    <Card className="admin-surface relative z-30 overflow-visible">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Роли пользователей
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-visible">
                            <BarChart
                                dataset={roleBar}
                                yAxis={[{ scaleType: 'band', dataKey: 'role', tickLabelStyle: { fontSize: 11 } }]}
                                series={[{ dataKey: 'count', label: 'Кол-во', color: '#1f4e7a' }]}
                                layout="horizontal"
                                slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                height={300}
                            />
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-5 xl:grid-cols-3">
                    <Card className="admin-surface relative z-30 overflow-visible">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5" />
                                KPI статусы
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-visible">
                            {kpiPieData.length === 0 ? (
                                <div className="admin-empty-state">По KPI пока нет данных.</div>
                            ) : (
                                <PieChart
                                    series={[{
                                        data: kpiPieData.map(d => ({
                                            ...d,
                                            label: KPI_STATUS_LABELS[d.label] || d.label,
                                        })),
                                        innerRadius: 50,
                                        outerRadius: 110,
                                    }]}
                                    slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                    height={280}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="admin-surface relative z-30 overflow-visible">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Ticket className="h-5 w-5" />
                                Тикеты по статусам
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-visible">
                            <BarChart
                                dataset={ticketsBar}
                                xAxis={[{ scaleType: 'band', dataKey: 'status' }]}
                                series={[{ dataKey: 'count', label: 'Тикеты', color: '#cc7a09' }]}
                                slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                height={280}
                            />
                        </CardContent>
                    </Card>

                    <Card className="admin-surface relative z-30 overflow-visible">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Календарь по статусам
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-visible">
                            <BarChart
                                dataset={calendarBar}
                                xAxis={[{ scaleType: 'band', dataKey: 'status' }]}
                                series={[{ dataKey: 'count', label: 'События', color: '#0f766e' }]}
                                slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                height={280}
                            />
                        </CardContent>
                    </Card>
                </section>

                <section className="grid items-stretch gap-5 xl:grid-cols-3 xl:h-[23rem] [&>*]:min-h-0">
                    <Card className="admin-surface xl:col-span-2 h-full min-h-0 overflow-hidden flex flex-col">
                        <CardHeader className="space-y-3">
                            <CardTitle>Последние действия в системе</CardTitle>
                            <div className="flex items-center justify-between gap-3">
                                <div className="relative w-full max-w-xs">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={activitySearch}
                                        onChange={(e) => setActivitySearch(e.target.value)}
                                        placeholder="Поиск по таблице"
                                        className="h-8 pl-8 text-xs"
                                        aria-label="Поиск по последним действиям"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Показано: {filteredActivityFeed.length} из {activityFeed.length}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 overflow-hidden">
                            {filteredActivityFeed.length === 0 ? (
                                <div className="admin-empty-state">Лента активности пока пуста.</div>
                            ) : (
                                <div className="admin-table-wrap h-full min-h-0 overflow-y-auto overflow-x-hidden">
                                    <table className="admin-data-table w-full table-fixed text-xs leading-snug">
                                        <colgroup>
                                            <col className="w-[14%]" />
                                            <col className="w-[8%]" />
                                            <col className="w-[13%]" />
                                            <col className="w-[22%]" />
                                            <col className="w-[15%]" />
                                            <col className="w-[18%]" />
                                            <col className="w-[10%]" />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th>Дата/время</th>
                                                <th>Источник</th>
                                                <th>Модуль</th>
                                                <th>Пользователь</th>
                                                <th>Событие</th>
                                                <th>Сущность</th>
                                                <th>IP</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredActivityFeed.map((row) => (
                                                <tr key={row.id} className={`align-top ${SEVERITY_ROW_BG[row.severity] || ''}`}>
                                                    <td className="py-2 pe-2 text-muted-foreground text-[11px] font-mono break-words">{formatDate(row.created_at)}</td>
                                                    <td className="py-2 pe-2 align-top">
                                                        <Badge variant={row.source === 'audit' ? 'secondary' : 'outline'}>{row.source}</Badge>
                                                    </td>
                                                    <td className="py-2 pe-2 align-top">
                                                        <ModuleBadge module={row.module} label={row.module_label} />
                                                    </td>
                                                    <td className="py-2 pe-2 align-top">
                                                        <div className="font-medium break-words">{row.actor_name}</div>
                                                        <div className="text-[11px] text-muted-foreground break-all">{row.actor_email ?? '—'}</div>
                                                    </td>
                                                    <td className="py-2 pe-2 align-top">
                                                        <div className="text-xs flex items-center gap-1.5 break-words">
                                                            {row.severity && row.severity !== 'low' && <SeverityDot severity={row.severity} />}
                                                            {row.event_label}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 pe-2 align-top">
                                                        <div className="font-medium break-words">{row.subject_name}</div>
                                                        <div className="text-[11px] text-muted-foreground break-words">{row.subject_label ?? '—'}</div>
                                                    </td>
                                                    <td className="py-2 pe-2 text-muted-foreground text-[11px] font-mono break-all align-top">{row.ip_address ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="admin-surface h-full min-h-0 overflow-hidden flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                Быстрые переходы
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 overflow-auto">
                            <div className="h-full flex flex-col gap-2">
                                {quickLinks.map((link) => {
                                    const IconComponent = QUICK_LINK_ICONS[link.icon] || ExternalLink;
                                    return (
                                        <Button key={link.href} asChild variant="outline" className="w-full justify-between">
                                            <Link href={link.href}>
                                                <span className="flex items-center gap-2">
                                                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                                                    {link.title}
                                                </span>
                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Link>
                                        </Button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

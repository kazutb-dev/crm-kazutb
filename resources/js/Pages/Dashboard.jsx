import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader, StatGrid, StatTile } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    ArrowUpRight,
    Briefcase,
    CalendarDays,
    ChevronRight,
    Database,
    ExternalLink,
    History,
    LayoutDashboard,
    MonitorDot,
    ScrollText,
    Search,
    Ticket,
    Users,
} from 'lucide-react';

// Qadam chart palette: teal, navy, gold, copper, sky, success green, warm grey.
const QD_CHART_COLORS = ['#067A75', '#102945', '#E2B53E', '#A4531F', '#2C6E9E', '#2F7D4F', '#8A9590'];

// Module chips in palette families only (each family is remapped to a Qadam tone inside the panel).
const MODULE_COLORS = {
    auth: 'bg-slate-100 text-slate-700', kpi: 'bg-blue-100 text-blue-700',
    kpi_settings: 'bg-blue-100 text-blue-700', users: 'bg-teal-100 text-teal-700',
    positions: 'bg-orange-100 text-orange-700', tickets: 'bg-amber-100 text-amber-700',
    announcements: 'bg-amber-100 text-amber-800', calendar: 'bg-teal-100 text-teal-700',
    library: 'bg-emerald-100 text-emerald-700', certificates: 'bg-emerald-100 text-emerald-700',
    navigation: 'bg-sky-100 text-sky-700', directory: 'bg-orange-100 text-orange-700',
    system: 'bg-slate-100 text-slate-600',
};

const SEVERITY_DOT = {
    critical: 'bg-red-600', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-slate-400',
};

const SEVERITY_ROW_BG = {
    critical: 'border-l-[3px] border-l-red-600',
    high: 'border-l-[3px] border-l-orange-500',
    medium: 'border-l-[3px] border-l-blue-400',
};

const ATTENTION_DOT = {
    high: 'bg-red-600',
    medium: 'bg-amber-500',
    ok: 'bg-emerald-600',
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
                borderRadius: '10px',
                border: '1px solid #DCE3E0',
                boxShadow: '0 12px 32px 0 rgba(25,28,29,0.10)',
                backgroundColor: '#FFFFFF',
            },
        },
    },
};

// Overview tiles map the server's accent names onto StatTile tones.
const ACCENT_TONES = {
    navy: 'navy',
    sky: 'info',
    amber: 'gold',
    rose: 'danger',
    teal: 'teal',
    violet: 'copper',
};

function ModuleBadge({ module, label }) {
    const cls = MODULE_COLORS[module] || MODULE_COLORS.system;
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {label || module || '—'}
        </span>
    );
}

function SeverityDot({ severity }) {
    const dot = SEVERITY_DOT[severity] || 'bg-slate-300';
    return <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />;
}

const severityLabel = {
    high: 'Высокий приоритет',
    medium: 'Требует внимания',
    ok: 'Норма',
};

const severityVariant = {
    high: 'destructive',
    medium: 'warning',
    ok: 'success',
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

function linkPath(href) {
    try {
        return new URL(href, window.location.origin).pathname;
    } catch {
        return href;
    }
}

function ChartCard({ icon: Icon, title, aside = null, className = '', children }) {
    return (
        <Card className={`relative z-30 overflow-visible ${className}`}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                    <Icon className="shrink-0" />
                    {title}
                </CardTitle>
                {aside}
            </CardHeader>
            <CardContent className="overflow-visible">{children}</CardContent>
        </Card>
    );
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

    const attentionOpen = attention.filter((item) => item.severity === 'high' || item.severity === 'medium').length;

    const sumCounts = (rows) => rows.reduce((acc, item) => acc + (Number(item.count) || 0), 0);
    const kpiTotal = sumCounts(kpiByStatus);
    const ticketsTotal = sumCounts(ticketsByStatus);
    const calendarTotal = sumCounts(calendarByStatus);
    const rolesTotal = sumCounts(usersByRole);
    const modulesPending = modules.reduce((acc, module) => acc + (Number(module.pending) || 0), 0);
    const trendTotals = trend.reduce(
        (acc, day) => ({
            activity: acc.activity + (Number(day.activity) || 0),
            audit: acc.audit + (Number(day.audit) || 0),
            tickets: acc.tickets + (Number(day.tickets) || 0),
        }),
        { activity: 0, audit: 0, tickets: 0 },
    );

    // Per-module counts of the loaded feed, most frequent first.
    const activitySummary = useMemo(() => {
        const counts = new Map();
        activityFeed.forEach((row) => {
            const key = row.module_label || row.module || row.source || '—';
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    }, [activityFeed]);

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Обзор системы"
                    title="Панель управления CRM"
                    description="Системный обзор по всем ключевым модулям: показатели, зоны внимания, динамика и последние действия."
                    meta={(
                        <div className="flex flex-col items-start gap-1.5 sm:items-end">
                            <span className="text-sm font-medium capitalize text-slate-700">{today}</span>
                            <div className="flex flex-wrap gap-1.5">
                                <Badge variant="secondary">Источник метрик: {stats.metrics_source ?? 'database'}</Badge>
                                <Badge variant={attentionOpen > 0 ? 'warning' : 'success'}>Зон внимания: {attentionOpen}</Badge>
                            </div>
                        </div>
                    )}
                />
            )}
        >
            <Head title="Панель управления" />

            <div className="admin-page-wrap space-y-4">
                {/* KPI tiles */}
                <StatGrid>
                    {overviewCards.map((card) => (
                        <Link
                            key={card.key}
                            href={card.route || '#'}
                            className="group block h-full rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                        >
                            <StatTile
                                label={card.title}
                                value={card.value}
                                hint={card.hint}
                                tone={ACCENT_TONES[card.accent] ?? 'navy'}
                                className="transition-colors duration-200 group-hover:border-teal-400"
                            />
                        </Link>
                    ))}
                </StatGrid>

                {/* Modules + trend | attention + roles */}
                <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="flex min-w-0 flex-col gap-4">
                        <Card className="relative z-30 overflow-visible">
                            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2">
                                    <LayoutDashboard className="shrink-0" />
                                    Модули CRM
                                </CardTitle>
                                {modules.length > 0 ? (
                                    <span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">
                                        Модулей: <span className="tabular-nums">{modules.length}</span> · ожидают внимания: <span className="tabular-nums">{modulesPending}</span>
                                    </span>
                                ) : null}
                            </CardHeader>
                            <CardContent>
                                {modules.length === 0 ? (
                                    <p className="text-sm text-slate-500">Модули пока не подключены.</p>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                                        {modules.map((module) => (
                                            <Link
                                                key={module.key}
                                                href={module.route}
                                                className="group flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition-colors hover:border-teal-400"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="truncate text-sm font-semibold text-[#102945]">{module.title}</h3>
                                                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-teal-700" />
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-2xl font-bold leading-none tabular-nums text-[#102945]">{module.total}</span>
                                                    <span className="qd-field-label text-slate-500">Всего</span>
                                                    <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500" title="Ожидает/внимание">
                                                        Ожидает
                                                        <Badge variant={Number(module.pending) > 0 ? 'warning' : 'secondary'} className="tabular-nums">{module.pending}</Badge>
                                                    </span>
                                                </div>
                                                <div className="truncate text-xs text-slate-600" title={module.secondary}>{module.secondary}</div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <ChartCard
                            icon={Activity}
                            title="Динамика активности"
                            aside={(
                                <span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">
                                    За 14 дней: действия <span className="tabular-nums">{trendTotals.activity}</span> · аудит <span className="tabular-nums">{trendTotals.audit}</span> · тикеты <span className="tabular-nums">{trendTotals.tickets}</span>
                                </span>
                            )}
                            className="flex-1"
                        >
                            <LineChart
                                dataset={trend}
                                xAxis={[{ scaleType: 'point', dataKey: 'day' }]}
                                series={[
                                    { dataKey: 'activity', label: 'Activity', color: '#102945' },
                                    { dataKey: 'audit', label: 'Audit', color: '#067A75' },
                                    { dataKey: 'tickets', label: 'Тикеты', color: '#E2B53E' },
                                ]}
                                slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                height={250}
                            />
                        </ChartCard>
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                        <Card className="relative z-20 overflow-visible">
                            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="shrink-0" />
                                    Зоны внимания
                                </CardTitle>
                                {attention.length > 0 ? (
                                    <span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">
                                        Открыто: <span className="tabular-nums">{attentionOpen}</span> из <span className="tabular-nums">{attention.length}</span>
                                    </span>
                                ) : null}
                            </CardHeader>
                            <CardContent>
                                {attention.length === 0 ? (
                                    <p className="text-sm text-slate-500">Всё в норме — зон внимания нет.</p>
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {attention.map((item) => (
                                            <Link
                                                key={item.key}
                                                href={item.route}
                                                className="group flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                                            >
                                                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ATTENTION_DOT[item.severity] ?? 'bg-slate-400'}`} aria-hidden="true" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-medium text-slate-900 group-hover:text-teal-700">{item.title}</span>
                                                        <Badge variant={severityVariant[item.severity] ?? 'outline'} className="tabular-nums">{item.value}</Badge>
                                                    </div>
                                                    <div className="mt-0.5 text-xs text-slate-500">{severityLabel[item.severity] ?? 'Норма'} · {item.hint}</div>
                                                </div>
                                                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-teal-700" />
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <ChartCard
                            icon={Users}
                            title="Роли пользователей"
                            aside={<span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">Всего: <span className="tabular-nums">{rolesTotal}</span></span>}
                            className="flex-1"
                        >
                            <BarChart
                                dataset={roleBar}
                                yAxis={[{ scaleType: 'band', dataKey: 'role', tickLabelStyle: { fontSize: 11 } }]}
                                series={[{ dataKey: 'count', label: 'Кол-во', color: '#067A75' }]}
                                layout="horizontal"
                                slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                height={250}
                            />
                        </ChartCard>
                    </div>
                </section>

                {/* Status breakdowns + quick links */}
                <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    <ChartCard
                        icon={Briefcase}
                        title="KPI статусы"
                        aside={<span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">Всего: <span className="tabular-nums">{kpiTotal}</span></span>}
                    >
                        {kpiPieData.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-500">По KPI пока нет данных.</p>
                        ) : (
                            <PieChart
                                colors={QD_CHART_COLORS}
                                series={[{
                                    data: kpiPieData.map(d => ({
                                        ...d,
                                        label: KPI_STATUS_LABELS[d.label] || d.label,
                                    })),
                                    innerRadius: 42,
                                    outerRadius: 84,
                                }]}
                                slotProps={CHART_TOOLTIP_SLOT_PROPS}
                                height={210}
                            />
                        )}
                    </ChartCard>

                    <ChartCard
                        icon={Ticket}
                        title="Тикеты по статусам"
                        aside={<span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">Всего: <span className="tabular-nums">{ticketsTotal}</span></span>}
                    >
                        <BarChart
                            dataset={ticketsBar}
                            xAxis={[{ scaleType: 'band', dataKey: 'status' }]}
                            series={[{ dataKey: 'count', label: 'Тикеты', color: '#E2B53E' }]}
                            slotProps={CHART_TOOLTIP_SLOT_PROPS}
                            height={210}
                        />
                    </ChartCard>

                    <ChartCard
                        icon={CalendarDays}
                        title="Календарь по статусам"
                        aside={<span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">Всего: <span className="tabular-nums">{calendarTotal}</span></span>}
                    >
                        <BarChart
                            dataset={calendarBar}
                            xAxis={[{ scaleType: 'band', dataKey: 'status' }]}
                            series={[{ dataKey: 'count', label: 'События', color: '#102945' }]}
                            slotProps={CHART_TOOLTIP_SLOT_PROPS}
                            height={210}
                        />
                    </ChartCard>

                    <Card className="flex min-h-0 flex-col overflow-hidden">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="shrink-0" />
                                Быстрые переходы
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="min-h-0 flex-1">
                            {quickLinks.length === 0 ? (
                                <p className="text-sm text-slate-500">Быстрые переходы не настроены.</p>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {quickLinks.map((link) => {
                                        const IconComponent = QUICK_LINK_ICONS[link.icon] || ExternalLink;
                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className="group flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-700 group-hover:text-white">
                                                        <IconComponent className="h-4 w-4" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-teal-700">{link.title}</span>
                                                        <span className="block truncate text-[11px] text-slate-500">{linkPath(link.href)}</span>
                                                    </span>
                                                </span>
                                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-teal-700" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {/* Activity feed */}
                <Card className="flex min-h-0 flex-col overflow-hidden">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <History className="shrink-0" />
                            Последние действия в системе
                        </CardTitle>
                        <span className="whitespace-nowrap text-xs font-medium leading-none text-slate-500">
                            Показано: <span className="tabular-nums">{filteredActivityFeed.length}</span> из <span className="tabular-nums">{activityFeed.length}</span>
                        </span>
                    </CardHeader>
                    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-2.5">
                        <label className="relative block w-full max-w-sm">
                            <span className="sr-only">Поиск по последним действиям</span>
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={activitySearch}
                                onChange={(e) => setActivitySearch(e.target.value)}
                                placeholder="Поиск по таблице"
                                className="pl-9"
                                aria-label="Поиск по последним действиям"
                            />
                        </label>
                        {activitySummary.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                {activitySummary.map(([key, count]) => (
                                    <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                        <span className="font-medium text-slate-700">{key}</span>
                                        <span className="tabular-nums">{count}</span>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    {filteredActivityFeed.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                                <History className="h-5 w-5" />
                            </div>
                            <p className="font-display text-base font-bold text-[#102945]">Лента активности пока пуста</p>
                            <p className="max-w-md text-sm text-slate-600">
                                {activityFeed.length > 0 ? 'Ничего не найдено — измените запрос поиска.' : 'Действия пользователей и записи аудита появятся здесь.'}
                            </p>
                        </div>
                    ) : (
                        <div className="max-h-[32rem] min-h-0 overflow-auto">
                            <table className="w-full min-w-[860px] table-fixed text-xs leading-snug">
                                <colgroup>
                                    <col className="w-[11%]" />
                                    <col className="w-[7%]" />
                                    <col className="w-[12%]" />
                                    <col className="w-[22%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[21%]" />
                                    <col className="w-[9%]" />
                                </colgroup>
                                <thead className="sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left">Дата/время</th>
                                        <th className="text-left">Источник</th>
                                        <th className="text-left">Модуль</th>
                                        <th className="text-left">Пользователь</th>
                                        <th className="text-left">Событие</th>
                                        <th className="text-left">Сущность</th>
                                        <th className="text-left">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredActivityFeed.map((row) => (
                                        <tr key={row.id} className={`border-b border-slate-200 align-top last:border-0 hover:bg-slate-50 ${SEVERITY_ROW_BG[row.severity] || ''}`}>
                                            <td className="break-words font-mono text-[11px] tabular-nums text-slate-500">{formatDate(row.created_at)}</td>
                                            <td>
                                                <Badge variant={row.source === 'audit' ? 'info' : 'secondary'}>{row.source}</Badge>
                                            </td>
                                            <td>
                                                <ModuleBadge module={row.module} label={row.module_label} />
                                            </td>
                                            <td>
                                                <div className="break-words font-medium text-slate-900">{row.actor_name}</div>
                                                <div className="break-all text-[11px] text-slate-500">{row.actor_email ?? '—'}</div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-1.5 break-words text-slate-700">
                                                    {row.severity && row.severity !== 'low' && <SeverityDot severity={row.severity} />}
                                                    {row.event_label}
                                                </div>
                                                {row.description && row.description !== row.event_label ? <div className="mt-0.5 line-clamp-2 break-words text-[11px] text-slate-500" title={row.description}>{row.description}</div> : null}
                                            </td>
                                            <td>
                                                <div className="break-words font-medium text-slate-900">{row.subject_name}</div>
                                                <div className="break-words text-[11px] text-slate-500">{row.subject_label ?? '—'}</div>
                                            </td>
                                            <td className="break-all font-mono text-[11px] tabular-nums text-slate-500">{row.ip_address ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

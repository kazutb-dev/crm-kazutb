import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader, StatTile } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ExternalLink,
    Globe,
    Info,
    MapPin,
    Radar,
    Shield,
    Users,
    Zap,
} from 'lucide-react';

// ── Shared config (mirrors AuditLogs.jsx) ────────────────────────────────────
const SEVERITY_CONFIG = {
    critical: { label: 'Критичное', classes: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-600' },
    high: { label: 'Важное', classes: 'bg-orange-50 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
    medium: { label: 'Рабочее', classes: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-600' },
    low: { label: 'Обычное', classes: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const MODULE_COLORS = {
    auth: 'bg-slate-100 text-slate-700', kpi: 'bg-blue-50 text-blue-800',
    kpi_settings: 'bg-blue-50 text-blue-800', users: 'bg-teal-50 text-teal-800',
    positions: 'bg-teal-50 text-teal-800', tickets: 'bg-amber-50 text-amber-800',
    announcements: 'bg-amber-50 text-amber-800', calendar: 'bg-teal-50 text-teal-800',
    library: 'bg-emerald-50 text-emerald-800', certificates: 'bg-emerald-50 text-emerald-800',
    navigation: 'bg-orange-50 text-orange-800', directory: 'bg-orange-50 text-orange-800',
    system: 'bg-slate-100 text-slate-600',
};

const ROLE_COLORS = {
    superadmin: 'bg-red-50 text-red-700',
    admin: 'bg-teal-50 text-teal-800',
    dean: 'bg-orange-50 text-orange-800',
    hod: 'bg-amber-50 text-amber-800',
    department_head: 'bg-amber-50 text-amber-800',
    teacher: 'bg-blue-50 text-blue-800',
    student: 'bg-slate-100 text-slate-600',
};

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function SeverityBadge({ severity, label }) {
    const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
            {label || cfg.label}
        </span>
    );
}

function ModuleBadge({ module, label }) {
    const cls = MODULE_COLORS[module] || MODULE_COLORS.system;
    return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {label || module || '—'}
        </span>
    );
}

function StatusDot({ status }) {
    if (status === 'online') return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-600" />;
    return <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />;
}

/** Card with the Qadam strip header; `meta` sits on the right of the strip. */
function Panel({ icon: Icon, title, meta = null, className = '', children }) {
    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" />}
                        {title}
                    </CardTitle>
                    {meta ? <span className="text-xs font-medium tabular-nums text-slate-500">{meta}</span> : null}
                </div>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

/** Ranked bar list (label · bar · number); bars use the Qadam teal. */
function BarList({ items, getKey, renderLabel, getValue, empty = 'Нет данных' }) {
    const max = items.length ? (getValue(items[0]) || 1) : 1;
    if (items.length === 0) {
        return <p className="py-4 text-center text-sm text-slate-500">{empty}</p>;
    }
    return (
        <div>
            {items.map((item) => (
                <div key={getKey(item)} className="border-b border-slate-200 py-2 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 truncate text-sm text-slate-700">{renderLabel(item)}</div>
                        <span className="font-mono text-xs tabular-nums text-slate-600">{getValue(item)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${Math.min(100, (getValue(item) / max) * 100)}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function Monitoring({
    summary, windows, links,
    recentUsers, eventsFeed, topUsers,
    eventsByType, eventsByModule, topRoutes, ipHotspots,
}) {
    const onlineUsers = (recentUsers || []).filter(u => u.status === 'online');
    const recentOnlyUsers = (recentUsers || []).filter(u => u.status === 'recent');
    const fmt = (value) => (value || 0).toLocaleString('ru-RU');

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Администрирование"
                    title="Мониторинг системы"
                    description={`Онлайн в рамках ${windows?.online_minutes ?? 5} мин · Активны за ${windows?.recent_minutes ?? 30} мин · События за ${windows?.events_hours ?? 24} ч`}
                    actions={(
                        <>
                            {links?.telescope && (
                                <a href={links.telescope} target="_blank" rel="noreferrer">
                                    <Button variant="outline" size="sm" className="gap-1.5">
                                        <ExternalLink size={13} /> Telescope
                                    </Button>
                                </a>
                            )}
                            {links?.pulse && (
                                <a href={links.pulse} target="_blank" rel="noreferrer">
                                    <Button variant="outline" size="sm" className="gap-1.5">
                                        <Zap size={13} /> Pulse
                                    </Button>
                                </a>
                            )}
                            {links?.audit && (
                                <Link href={links.audit}>
                                    <Button variant="outline" size="sm">Журнал аудита →</Button>
                                </Link>
                            )}
                        </>
                    )}
                />
            )}
        >
            <Head title="Мониторинг" />

            <div className="admin-page-wrap space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatTile icon={Radar} label="Онлайн сейчас" value={fmt(summary?.online_users)} tone="success"
                        hint={`< ${windows?.online_minutes ?? 5} мин активности`} />
                    <StatTile icon={Users} label="Активны за 30 мин" value={fmt(summary?.recent_users)} tone="gold"
                        hint="Недавние сессии" />
                    <StatTile icon={Shield} label="Аудит сегодня" value={fmt(summary?.audit_today)} tone="info"
                        hint="Записей CRM" />
                    <StatTile icon={Activity} label="События сегодня" value={fmt(summary?.activity_today)} tone="teal"
                        hint="Spatie activity" />
                    <StatTile icon={Zap} label={`События за ${windows?.events_hours ?? 24}ч`} value={fmt(summary?.events_24h)}
                        tone="navy" hint="Все источники" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                    <Panel
                        icon={Users}
                        title="Пользователи в системе"
                        meta={`${onlineUsers.length} онлайн · ${recentOnlyUsers.length} недавно`}
                        className="lg:col-span-2"
                    >
                        {(recentUsers || []).length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-500">Нет активных пользователей</p>
                        )}
                        <div className="max-h-[480px] overflow-y-auto pr-1">
                            {(recentUsers || []).map(u => (
                                <div key={u.user_id} className="flex items-start gap-3 border-b border-slate-200 py-2.5 last:border-0">
                                    <div className="pt-1.5"><StatusDot status={u.status} /></div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="max-w-[160px] truncate text-sm font-medium text-slate-900">{u.name}</span>
                                            {u.role && (
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                                                    {u.role_label || u.role}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-slate-500">{u.email}</p>
                                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                                            {u.last_route_name && <span className="max-w-[120px] truncate font-mono">{u.last_route_name}</span>}
                                            {u.last_ip_address && <span className="font-mono">{u.last_ip_address}</span>}
                                            <span className="tabular-nums">{formatDate(u.last_seen_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel
                        icon={Activity}
                        title="Лента событий"
                        meta={`последние ${(eventsFeed || []).length} событий`}
                        className="lg:col-span-3"
                    >
                        {(eventsFeed || []).length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-500">Событий не найдено</p>
                        )}
                        <div className="max-h-[480px] overflow-y-auto pr-1">
                            {(eventsFeed || []).map(item => (
                                <div key={item.id} className="flex items-start gap-3 border-b border-slate-200 py-2.5 last:border-0">
                                    <div className="pt-2">
                                        <span className={`block h-2 w-2 rounded-full ${SEVERITY_CONFIG[item.severity]?.dot || 'bg-slate-400'}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900">
                                                {item.event_label || item.event_key}
                                            </span>
                                            {item.module && <ModuleBadge module={item.module} label={item.module_label} />}
                                            {item.severity && item.severity !== 'low' && (
                                                <SeverityBadge severity={item.severity} label={item.severity_label} />
                                            )}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-500">
                                            <span className="font-medium text-slate-700">{item.actor_name}</span>
                                            {item.subject_name && <span>{item.subject_name}{item.subject_label ? ` ${item.subject_label}` : ''}</span>}
                                            {item.ip_address && <span className="font-mono">{item.ip_address}</span>}
                                            <span className="ml-auto tabular-nums">{formatDate(item.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    <Panel title="События по модулям">
                        <BarList
                            items={(eventsByModule || []).slice(0, 8)}
                            getKey={(item) => item.module}
                            renderLabel={(item) => <ModuleBadge module={item.module} label={item.module_label} />}
                            getValue={(item) => item.count}
                        />
                    </Panel>

                    <Panel title="Топ событий">
                        <BarList
                            items={(eventsByType || []).slice(0, 8)}
                            getKey={(item) => item.event}
                            renderLabel={(item) => item.label || item.event}
                            getValue={(item) => item.total}
                        />
                    </Panel>

                    <Panel icon={MapPin} title="Топ маршрутов (24ч)">
                        {(topRoutes || []).slice(0, 8).map(item => (
                            <div key={item.route} className="flex items-center gap-2 border-b border-slate-200 py-2 last:border-0">
                                <span className="flex-1 truncate font-mono text-xs text-slate-700">{item.route}</span>
                                <span className="font-mono text-xs tabular-nums text-slate-500">{item.count}</span>
                            </div>
                        ))}
                        {(topRoutes || []).length === 0 && (
                            <p className="py-4 text-center text-sm text-slate-500">Нет данных</p>
                        )}
                    </Panel>

                    <Panel icon={Globe} title="IP-адреса (активные)">
                        <BarList
                            items={(ipHotspots || []).slice(0, 8)}
                            getKey={(item) => item.ip}
                            renderLabel={(item) => <span className="font-mono text-xs">{item.ip}</span>}
                            getValue={(item) => item.events}
                        />
                    </Panel>
                </div>

                {(topUsers || []).length > 0 && (
                    <Panel icon={Zap} title="Наиболее активные (6ч)">
                        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                            {(topUsers || []).map((u, i) => (
                                <div key={u.user_id} className="flex items-center gap-3 border-b border-slate-200 py-2.5">
                                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${i === 0 ? 'bg-amber-400 text-[#102945]' : 'bg-slate-100 text-slate-600'}`}>
                                        {i + 1}
                                    </span>
                                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{u.name}</p>
                                    <span className="text-sm font-semibold tabular-nums text-[#102945]">{u.score} ед.</span>
                                </div>
                            ))}
                        </div>
                    </Panel>
                )}

                <p className="text-center text-xs text-slate-500">
                    DEV-среда · Обновите страницу для актуальных данных
                </p>
            </div>
        </AuthenticatedLayout>
    );
}

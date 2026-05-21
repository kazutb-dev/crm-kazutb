import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
    critical: { label: 'Критичное', classes: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
    high: { label: 'Важное', classes: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-400' },
    medium: { label: 'Рабочее', classes: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
    low: { label: 'Обычное', classes: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};

const MODULE_COLORS = {
    auth: 'bg-slate-100 text-slate-700', kpi: 'bg-indigo-100 text-indigo-700',
    kpi_settings: 'bg-violet-100 text-violet-700', users: 'bg-cyan-100 text-cyan-700',
    positions: 'bg-rose-100 text-rose-700', tickets: 'bg-amber-100 text-amber-700',
    announcements: 'bg-yellow-100 text-yellow-700', calendar: 'bg-teal-100 text-teal-700',
    library: 'bg-green-100 text-green-700', certificates: 'bg-lime-100 text-lime-700',
    navigation: 'bg-pink-100 text-pink-700', directory: 'bg-orange-100 text-orange-700',
    system: 'bg-gray-100 text-gray-600',
};

const ROLE_COLORS = {
    superadmin: 'bg-red-100 text-red-700',
    admin: 'bg-purple-100 text-purple-700',
    dean: 'bg-orange-100 text-orange-700',
    hod: 'bg-amber-100 text-amber-700',
    department_head: 'bg-amber-100 text-amber-700',
    teacher: 'bg-blue-100 text-blue-700',
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
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.classes}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
            {label || cfg.label}
        </span>
    );
}

function ModuleBadge({ module, label }) {
    const cls = MODULE_COLORS[module] || MODULE_COLORS.system;
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
            {label || module || '—'}
        </span>
    );
}

function StatusDot({ status }) {
    if (status === 'online') return <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />;
    return <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />;
}

function StatCard({ icon: Icon, label, value, sub, accent = 'slate' }) {
    const accents = {
        green: {
            shell: 'border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-white',
            line: 'bg-emerald-500',
            icon: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
        },
        yellow: {
            shell: 'border-amber-200/90 bg-gradient-to-br from-amber-50 to-white',
            line: 'bg-amber-500',
            icon: 'bg-amber-100 text-amber-700 ring-amber-200',
        },
        blue: {
            shell: 'border-blue-200/90 bg-gradient-to-br from-blue-50 to-white',
            line: 'bg-blue-500',
            icon: 'bg-blue-100 text-blue-700 ring-blue-200',
        },
        violet: {
            shell: 'border-violet-200/90 bg-gradient-to-br from-violet-50 to-white',
            line: 'bg-violet-500',
            icon: 'bg-violet-100 text-violet-700 ring-violet-200',
        },
        slate: {
            shell: 'border-slate-200/90 bg-gradient-to-br from-slate-50 to-white',
            line: 'bg-slate-400',
            icon: 'bg-slate-100 text-slate-600 ring-slate-200',
        },
    };

    const tone = accents[accent] || accents.slate;

    return (
        <Card className={`group relative overflow-hidden border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-slate-300 ${tone.shell}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${tone.line}`} aria-hidden="true" />
            <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-[0.06em]">{label}</p>
                        <p className="text-4xl leading-none font-semibold text-slate-900 mt-1 tabular-nums">{(value || 0).toLocaleString('ru-RU')}</p>
                        {sub && <p className="text-xs text-slate-500 mt-2 truncate">{sub}</p>}
                    </div>
                    <div className={`shrink-0 rounded-xl p-2 ring-1 ${tone.icon}`}>
                        <Icon size={17} aria-hidden="true" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function Monitoring({
    summary, windows, links,
    recentUsers, eventsFeed, topUsers,
    eventsByType, eventsByModule, topRoutes, ipHotspots,
}) {
    const onlineUsers = (recentUsers || []).filter(u => u.status === 'online');
    const recentOnlyUsers = (recentUsers || []).filter(u => u.status === 'recent');

    return (
        <AuthenticatedLayout>
            <Head title="Мониторинг" />

            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Radar size={22} className="text-violet-500" />
                            Мониторинг системы
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Онлайн в рамках {windows?.online_minutes ?? 5} мин · Активны за {windows?.recent_minutes ?? 30} мин · События за {windows?.events_hours ?? 24} ч
                        </p>
                    </div>
                    <div className="flex gap-2">
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
                    </div>
                </div>

                {/* ── Summary cards ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard icon={Radar} label="Онлайн сейчас" value={summary?.online_users} accent="green"
                        sub={`< ${windows?.online_minutes ?? 5} мин активности`} />
                    <StatCard icon={Users} label="Активны за 30 мин" value={summary?.recent_users} accent="yellow"
                        sub="Недавние сессии" />
                    <StatCard icon={Shield} label="Аудит сегодня" value={summary?.audit_today} accent="blue"
                        sub="Записей CRM" />
                    <StatCard icon={Activity} label="События сегодня" value={summary?.activity_today} accent="violet"
                        sub="Spatie activity" />
                    <StatCard icon={Zap} label={`События за ${windows?.events_hours ?? 24}ч`} value={summary?.events_24h}
                        accent="slate" sub="Все источники" />
                </div>

                {/* ── Main content: users + feed ─────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Active users */}
                    <Card className="lg:col-span-2 border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Users size={14} /> Пользователи в системе
                                </span>
                                <span className="text-xs font-normal text-slate-400">
                                    {onlineUsers.length} онлайн · {recentOnlyUsers.length} недавно
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(recentUsers || []).length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">Нет активных пользователей</p>
                            )}
                            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                                {(recentUsers || []).map(u => (
                                    <div key={u.user_id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="pt-1"><StatusDot status={u.status} /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm text-slate-800 truncate max-w-[160px]">{u.name}</span>
                                                {u.role && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                                                        {u.role_label || u.role}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                                            <div className="flex gap-3 mt-1 text-xs text-slate-400">
                                                {u.last_route_name && <span className="font-mono truncate max-w-[120px]">{u.last_route_name}</span>}
                                                {u.last_ip_address && <span>{u.last_ip_address}</span>}
                                                <span>{formatDate(u.last_seen_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live event feed */}
                    <Card className="lg:col-span-3 border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Activity size={14} /> Лента событий
                                <span className="ml-auto text-xs font-normal text-slate-400">последние {(eventsFeed || []).length} событий</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(eventsFeed || []).length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">Событий не найдено</p>
                            )}
                            <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                                {(eventsFeed || []).map(item => (
                                    <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="pt-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full block ${SEVERITY_CONFIG[item.severity]?.dot || 'bg-gray-400'
                                                }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm text-slate-800">
                                                    {item.event_label || item.event_key}
                                                </span>
                                                {item.module && <ModuleBadge module={item.module} label={item.module_label} />}
                                                {item.severity && item.severity !== 'low' && (
                                                    <SeverityBadge severity={item.severity} label={item.severity_label} />
                                                )}
                                            </div>
                                            <div className="flex gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                                                <span className="font-medium text-slate-600">{item.actor_name}</span>
                                                {item.subject_name && <span>{item.subject_name}{item.subject_label ? ` ${item.subject_label}` : ''}</span>}
                                                {item.ip_address && <span className="font-mono">{item.ip_address}</span>}
                                                <span className="ml-auto">{formatDate(item.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Analytics row ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Events by module */}
                    <Card className="border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                События по модулям
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(eventsByModule || []).slice(0, 8).map(item => (
                                    <div key={item.module} className="flex items-center justify-between gap-2">
                                        <ModuleBadge module={item.module} label={item.module_label} />
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-indigo-400 h-1.5 rounded-full"
                                                    style={{ width: `${Math.min(100, (item.count / ((eventsByModule[0]?.count) || 1)) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500 font-mono w-8 text-right">{item.count}</span>
                                        </div>
                                    </div>
                                ))}
                                {(eventsByModule || []).length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-4">Нет данных</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Events by type */}
                    <Card className="border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Топ событий
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(eventsByType || []).slice(0, 8).map(item => (
                                    <div key={item.event} className="flex items-center justify-between gap-2">
                                        <span className="text-sm text-slate-700 truncate flex-1">{item.label || item.event}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-blue-400 h-1.5 rounded-full"
                                                    style={{ width: `${Math.min(100, (item.total / ((eventsByType[0]?.total) || 1)) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500 font-mono w-8 text-right">{item.total}</span>
                                        </div>
                                    </div>
                                ))}
                                {(eventsByType || []).length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-4">Нет данных</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top routes */}
                    <Card className="border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                <MapPin size={11} /> Топ маршрутов (24ч)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(topRoutes || []).slice(0, 8).map(item => (
                                    <div key={item.route} className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-slate-600 truncate flex-1">{item.route}</span>
                                        <span className="text-xs text-slate-400 font-mono">{item.count}</span>
                                    </div>
                                ))}
                                {(topRoutes || []).length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-4">Нет данных</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* IP hotspots */}
                    <Card className="border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                <Globe size={11} /> IP-адреса (активные)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(ipHotspots || []).slice(0, 8).map(item => (
                                    <div key={item.ip} className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-slate-600 flex-1">{item.ip}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-12 bg-slate-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-teal-400 h-1.5 rounded-full"
                                                    style={{ width: `${Math.min(100, (item.events / ((ipHotspots[0]?.events) || 1)) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-400 font-mono">{item.events}</span>
                                        </div>
                                    </div>
                                ))}
                                {(ipHotspots || []).length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-4">Нет данных</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Top users ─────────────────────────────────────────── */}
                {(topUsers || []).length > 0 && (
                    <Card className="border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Zap size={14} /> Наиболее активные (6ч)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                {(topUsers || []).map((u, i) => (
                                    <div key={u.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-500' : 'text-slate-400'}`}>
                                            #{i + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                                            <p className="text-xs text-slate-400">{u.score} ед.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <p className="text-xs text-slate-400 text-center">
                    DEV-среда · Обновите страницу для актуальных данных
                </p>
            </div>
        </AuthenticatedLayout>
    );
}

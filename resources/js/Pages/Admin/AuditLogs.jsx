import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Database,
    Filter,
    Info,
    Search,
    Shield,
    X,
} from 'lucide-react';
import { useState } from 'react';

const SOURCE_LABELS = {
    all: 'Все источники',
    audit: 'Аудит CRM',
    activity: 'Активность',
};

const SEVERITY_CONFIG = {
    critical: { label: 'Критичное', classes: 'bg-red-100 text-red-800 border-red-200', icon: Shield, dot: 'bg-red-500' },
    high: { label: 'Важное', classes: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle, dot: 'bg-orange-400' },
    medium: { label: 'Рабочее', classes: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertCircle, dot: 'bg-blue-400' },
    low: { label: 'Обычное', classes: 'bg-gray-100 text-gray-600 border-gray-200', icon: Info, dot: 'bg-gray-400' },
};

const MODULE_COLORS = {
    auth: 'bg-slate-100 text-slate-700 border-slate-200',
    kpi: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    kpi_settings: 'bg-violet-100 text-violet-700 border-violet-200',
    users: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    positions: 'bg-rose-100 text-rose-700 border-rose-200',
    tickets: 'bg-amber-100 text-amber-700 border-amber-200',
    announcements: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    calendar: 'bg-teal-100 text-teal-700 border-teal-200',
    library: 'bg-green-100 text-green-700 border-green-200',
    certificates: 'bg-lime-100 text-lime-700 border-lime-200',
    navigation: 'bg-pink-100 text-pink-700 border-pink-200',
    directory: 'bg-orange-100 text-orange-700 border-orange-200',
    system: 'bg-gray-100 text-gray-600 border-gray-200',
};

const ROW_SEVERITY_BG = {
    critical: 'border-l-4 border-l-red-500',
    high: 'border-l-4 border-l-orange-400',
    medium: 'border-l-4 border-l-blue-300',
    low: '',
};

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
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
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
            {label || module || '—'}
        </span>
    );
}

function SourceBadge({ source }) {
    if (source === 'audit') {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-600 text-white">
                <Database size={10} /> Аудит
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-500 text-white">
            <Activity size={10} /> Система
        </span>
    );
}

function ExpandedRow({ item }) {
    const pairs = [
        ['Ключ события', item.event_key],
        ['Модуль', item.module_label],
        ['Важность', item.severity_label],
        ['IP-адрес', item.ip_address],
        ['HTTP-метод', item.method],
        ['Маршрут', item.route],
        ['Путь', item.path],
    ].filter(([, v]) => v);

    const details = typeof item.details === 'object' && item.details !== null ? item.details : {};
    const meta = Object.entries(details).filter(([k]) => !['ip', 'path', 'route', 'method'].includes(k));

    return (
        <td colSpan={7} className="px-6 pb-4 pt-0">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mt-1">
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                    {pairs.map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                            <span className="text-slate-400 font-medium w-32 shrink-0">{k}:</span>
                            <span className="text-slate-700 break-all">{v}</span>
                        </div>
                    ))}
                </div>
                {meta.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Метаданные</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                            {meta.map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                    <span className="text-slate-400 font-medium w-32 shrink-0">{k}:</span>
                                    <span className="text-slate-700 break-all font-mono text-xs">
                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </td>
    );
}

export default function AuditLogs({ logs, summary, filters, options }) {
    const [expandedRow, setExpandedRow] = useState(null);

    const activeFilters = Object.entries(filters || {}).filter(([k, v]) => v && v !== 'all' && k !== 'source');

    function applyFilter(newFilters) {
        router.get(route('admin.audit-logs.index'), { ...filters, ...newFilters, page: 1 }, {
            preserveState: true,
            preserveScroll: true,
        });
    }

    function clearFilter(key) {
        router.get(route('admin.audit-logs.index'), { ...filters, [key]: null, page: 1 }, { preserveState: true });
    }

    function clearAllFilters() {
        router.get(route('admin.audit-logs.index'), { source: 'all', page: 1 }, { preserveState: true });
    }

    function toggleRow(id) {
        setExpandedRow(prev => prev === id ? null : id);
    }

    const filterLabelFor = (key, val) => {
        if (key === 'event_type') return (options?.eventTypes || []).find(o => o.key === val)?.label || val;
        if (key === 'subject_type') return (options?.subjectTypes || []).find(o => o.key === val)?.label || val;
        if (key === 'module') return (options?.modules || []).find(o => o.key === val)?.label || val;
        if (key === 'severity') return (options?.severities || []).find(o => o.key === val)?.label || val;
        return val;
    };

    const filterTitleFor = key => ({
        event_type: 'Событие', subject_type: 'Сущность',
        module: 'Модуль', severity: 'Важность', search: 'Поиск',
    }[key] || key);

    return (
        <AuthenticatedLayout>
            <Head title="Журнал аудита" />

            <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Журнал аудита</h1>
                        <p className="text-sm text-slate-500 mt-1">Все действия и события в CRM · DEV-среда</p>
                    </div>
                    <Link href={route('admin.monitoring.index')}>
                        <Button variant="outline" size="sm">Мониторинг →</Button>
                    </Link>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Всего записей', value: summary?.total || 0, cls: '' },
                        { label: 'За сегодня', value: summary?.today_count || 0, cls: '' },
                        { label: 'Записи аудита', value: summary?.audit_count || 0, cls: 'bg-blue-50 border-blue-100', vCls: 'text-blue-900', lCls: 'text-blue-600' },
                        { label: 'События системы', value: summary?.activity_count || 0, cls: 'bg-slate-50', vCls: 'text-slate-700', lCls: 'text-slate-500' },
                    ].map(({ label, value, cls, vCls, lCls }) => (
                        <Card key={label} className={`border-slate-200 ${cls}`}>
                            <CardContent className="pt-5">
                                <p className={`text-xs font-medium uppercase tracking-wide ${lCls || 'text-slate-500'}`}>{label}</p>
                                <p className={`text-3xl font-bold mt-1 ${vCls || 'text-slate-900'}`}>{(value).toLocaleString('ru-RU')}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Filters */}
                <Card className="border-slate-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Filter size={14} /> Фильтры
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <select
                                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                                value={filters?.source || 'all'}
                                onChange={e => applyFilter({ source: e.target.value })}
                            >
                                {(options?.sources || ['all', 'audit', 'activity']).map(s => (
                                    <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
                                ))}
                            </select>

                            <select
                                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                                value={filters?.module || ''}
                                onChange={e => applyFilter({ module: e.target.value || null })}
                            >
                                <option value="">Все модули</option>
                                {(options?.modules || []).map(m => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>

                            <select
                                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                                value={filters?.severity || ''}
                                onChange={e => applyFilter({ severity: e.target.value || null })}
                            >
                                <option value="">Любая важность</option>
                                {(options?.severities || []).map(s => (
                                    <option key={s.key} value={s.key}>{s.label}</option>
                                ))}
                            </select>

                            <select
                                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                                value={filters?.event_type || ''}
                                onChange={e => applyFilter({ event_type: e.target.value || null })}
                            >
                                <option value="">Все события</option>
                                {(options?.eventTypes || []).map(e => (
                                    <option key={e.key} value={e.key}>{e.label}</option>
                                ))}
                            </select>

                            <select
                                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                                value={filters?.subject_type || ''}
                                onChange={e => applyFilter({ subject_type: e.target.value || null })}
                            >
                                <option value="">Все сущности</option>
                                {(options?.subjectTypes || []).map(s => (
                                    <option key={s.key} value={s.key}>{s.label}</option>
                                ))}
                            </select>

                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input
                                    className="pl-7 text-sm h-8"
                                    placeholder="Поиск…"
                                    defaultValue={filters?.search || ''}
                                    onKeyDown={e => e.key === 'Enter' && applyFilter({ search: e.target.value || null })}
                                />
                            </div>
                        </div>

                        {activeFilters.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                                <span className="text-xs text-slate-400 font-medium">Активные:</span>
                                {activeFilters.map(([key, val]) => (
                                    <button
                                        key={key}
                                        onClick={() => clearFilter(key)}
                                        className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-200 transition-colors"
                                    >
                                        <span className="text-blue-500 font-medium">{filterTitleFor(key)}:</span>
                                        {filterLabelFor(key, val)}
                                        <X size={10} />
                                    </button>
                                ))}
                                <button onClick={clearAllFilters} className="text-xs text-slate-400 hover:text-slate-600 underline ml-1">
                                    Очистить всё
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Table */}
                <Card className="border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                                    <th className="text-left px-6 py-3 font-semibold w-36">Время</th>
                                    <th className="text-left px-3 py-3 font-semibold w-24">Источник</th>
                                    <th className="text-left px-3 py-3 font-semibold w-28">Модуль</th>
                                    <th className="text-left px-3 py-3 font-semibold">Событие</th>
                                    <th className="text-left px-3 py-3 font-semibold">Пользователь</th>
                                    <th className="text-left px-3 py-3 font-semibold">Сущность</th>
                                    <th className="text-left px-3 py-3 font-semibold w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(logs?.data || []).length === 0 && (
                                    <tr><td colSpan={7} className="text-center text-slate-400 py-12">Записи не найдены</td></tr>
                                )}
                                {(logs?.data || []).flatMap(item => {
                                    const isExpanded = expandedRow === item.id;
                                    const rowBg = ROW_SEVERITY_BG[item.severity] || '';
                                    const rows = [
                                        <tr
                                            key={item.id}
                                            className={`cursor-pointer hover:bg-slate-50 transition-colors ${rowBg}`}
                                            onClick={() => toggleRow(item.id)}
                                        >
                                            <td className="px-6 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                                {formatDate(item.created_at)}
                                            </td>
                                            <td className="px-3 py-3"><SourceBadge source={item.source} /></td>
                                            <td className="px-3 py-3"><ModuleBadge module={item.module} label={item.module_label} /></td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-medium text-slate-800">{item.event_label || item.event_key}</span>
                                                    <SeverityBadge severity={item.severity} label={item.severity_label} />
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-700">{item.actor_name}</span>
                                                    {item.actor_email && <span className="text-xs text-slate-400">{item.actor_email}</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-700">{item.subject_name || '—'}</span>
                                                    {item.subject_label && (
                                                        <span className="text-xs text-slate-400 font-mono">{item.subject_label}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-slate-400">
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </td>
                                        </tr>,
                                    ];
                                    if (isExpanded) {
                                        rows.push(
                                            <tr key={`${item.id}-exp`} className="bg-slate-50">
                                                <ExpandedRow item={item} />
                                            </tr>
                                        );
                                    }
                                    return rows;
                                })}
                            </tbody>
                        </table>
                    </div>

                    {logs?.last_page > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                            <p className="text-xs text-slate-400">
                                Показано {logs.from}–{logs.to} из {(logs.total || 0).toLocaleString('ru-RU')} записей
                            </p>
                            <div className="flex gap-2 items-center">
                                {logs.prev_page_url && (
                                    <Link href={logs.prev_page_url}>
                                        <Button variant="outline" size="sm">← Назад</Button>
                                    </Link>
                                )}
                                <span className="text-xs text-slate-500 px-3">{logs.current_page} / {logs.last_page}</span>
                                {logs.next_page_url && (
                                    <Link href={logs.next_page_url}>
                                        <Button variant="outline" size="sm">Вперёд →</Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </Card>

                <p className="text-xs text-slate-400 text-center">
                    DEV-среда · Данные из <code>audit_logs</code> + Spatie <code>activity_log</code>
                </p>
            </div>
        </AuthenticatedLayout>
    );
}

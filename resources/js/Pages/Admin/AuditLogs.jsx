import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, EmptyState, FilterBar, FormField, PageHeader, qdFieldClass, Segmented, StatGrid, StatTile } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    CalendarClock,
    ClipboardList,
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
    critical: { label: 'Критичное', classes: 'bg-red-50 text-red-800 border-red-200', icon: Shield, dot: 'bg-red-600' },
    high: { label: 'Важное', classes: 'bg-orange-50 text-orange-800 border-orange-200', icon: AlertTriangle, dot: 'bg-orange-500' },
    medium: { label: 'Рабочее', classes: 'bg-blue-50 text-blue-800 border-blue-200', icon: AlertCircle, dot: 'bg-blue-600' },
    low: { label: 'Обычное', classes: 'bg-slate-100 text-slate-600 border-slate-200', icon: Info, dot: 'bg-slate-400' },
};

const MODULE_COLORS = {
    auth: 'bg-slate-100 text-slate-700 border-slate-200',
    kpi: 'bg-blue-50 text-blue-800 border-blue-200',
    kpi_settings: 'bg-blue-50 text-blue-800 border-blue-200',
    users: 'bg-teal-50 text-teal-800 border-teal-200',
    positions: 'bg-teal-50 text-teal-800 border-teal-200',
    tickets: 'bg-amber-50 text-amber-800 border-amber-200',
    announcements: 'bg-amber-50 text-amber-800 border-amber-200',
    calendar: 'bg-teal-50 text-teal-800 border-teal-200',
    library: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    certificates: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    navigation: 'bg-orange-50 text-orange-800 border-orange-200',
    directory: 'bg-orange-50 text-orange-800 border-orange-200',
    system: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ROW_SEVERITY_BG = {
    critical: 'shadow-[inset_3px_0_0_0_#c62828]',
    high: 'shadow-[inset_3px_0_0_0_#a4531f]',
    medium: 'shadow-[inset_3px_0_0_0_rgba(37,99,235,0.45)]',
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
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                <Database size={10} /> Аудит
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
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
        <td colSpan={7}>
            <div className="mt-1 rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
                    {pairs.map(([k, v]) => (
                        <div key={k} className="flex gap-2 border-b border-slate-100 pb-2">
                            <span className="qd-field-label w-32 shrink-0 pt-0.5 text-slate-500">{k}</span>
                            <span className="text-slate-700 break-all">{v}</span>
                        </div>
                    ))}
                </div>
                {meta.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="qd-kicker mb-3">Метаданные</p>
                        <div className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
                            {meta.map(([k, v]) => (
                                <div key={k} className="flex gap-2 border-b border-slate-100 pb-2">
                                    <span className="w-32 shrink-0 font-mono text-xs text-slate-500">{k}</span>
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

    const sourceItems = (options?.sources || ['all', 'audit', 'activity']).map((key) => ({ key, label: SOURCE_LABELS[key] || key }));

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Администрирование"
                    title="Журнал аудита"
                    description="Все действия и события в CRM · DEV-среда"
                    actions={(
                        <Link href={route('admin.monitoring.index')}>
                            <Button variant="outline" size="sm">Мониторинг →</Button>
                        </Link>
                    )}
                />
            )}
        >
            <Head title="Журнал аудита" />

            <div className="admin-page-wrap space-y-6">
                <StatGrid>
                    <StatTile label="Всего записей" value={(summary?.total || 0).toLocaleString('ru-RU')} tone="navy" icon={ClipboardList} />
                    <StatTile label="За сегодня" value={(summary?.today_count || 0).toLocaleString('ru-RU')} tone="teal" icon={CalendarClock} />
                    <StatTile label="Записи аудита" value={(summary?.audit_count || 0).toLocaleString('ru-RU')} tone="info" icon={Database} />
                    <StatTile label="События системы" value={(summary?.activity_count || 0).toLocaleString('ru-RU')} tone="neutral" icon={Activity} />
                </StatGrid>

                <FilterBar>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[#102945]">
                            <Filter className="h-4 w-4 text-teal-700" /> Фильтры
                        </div>
                        <Segmented items={sourceItems} value={filters?.source || 'all'} onChange={(value) => applyFilter({ source: value })} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <FormField label="Модуль">
                            <select className={qdFieldClass} value={filters?.module || ''} onChange={e => applyFilter({ module: e.target.value || null })}>
                                <option value="">Все модули</option>
                                {(options?.modules || []).map(m => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Важность">
                            <select className={qdFieldClass} value={filters?.severity || ''} onChange={e => applyFilter({ severity: e.target.value || null })}>
                                <option value="">Любая важность</option>
                                {(options?.severities || []).map(s => (
                                    <option key={s.key} value={s.key}>{s.label}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Событие">
                            <select className={qdFieldClass} value={filters?.event_type || ''} onChange={e => applyFilter({ event_type: e.target.value || null })}>
                                <option value="">Все события</option>
                                {(options?.eventTypes || []).map(e => (
                                    <option key={e.key} value={e.key}>{e.label}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Сущность">
                            <select className={qdFieldClass} value={filters?.subject_type || ''} onChange={e => applyFilter({ subject_type: e.target.value || null })}>
                                <option value="">Все сущности</option>
                                {(options?.subjectTypes || []).map(s => (
                                    <option key={s.key} value={s.key}>{s.label}</option>
                                ))}
                            </select>
                        </FormField>

                        <label className="relative block space-y-2">
                            <span className="qd-field-label block">Поиск</span>
                            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-9"
                                placeholder="Поиск… (Enter)"
                                defaultValue={filters?.search || ''}
                                onKeyDown={e => e.key === 'Enter' && applyFilter({ search: e.target.value || null })}
                            />
                        </label>
                    </div>

                    {activeFilters.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                            <span className="qd-field-label text-slate-500">Активные</span>
                            {activeFilters.map(([key, val]) => (
                                <button
                                    key={key}
                                    onClick={() => clearFilter(key)}
                                    className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs text-teal-800 transition-colors hover:border-teal-300 hover:bg-teal-100"
                                >
                                    <span className="font-semibold">{filterTitleFor(key)}:</span>
                                    {filterLabelFor(key, val)}
                                    <X size={10} />
                                </button>
                            ))}
                            <Button variant="outline" size="sm" className="ml-auto" onClick={clearAllFilters}>
                                Очистить всё
                            </Button>
                        </div>
                    )}
                </FilterBar>

                {(logs?.data || []).length === 0 ? (
                    <EmptyState title="Записи не найдены" description="По текущим фильтрам событий нет. Сбросьте фильтры или выберите другой источник." action={activeFilters.length > 0 ? <Button variant="outline" size="sm" onClick={clearAllFilters}>Очистить всё</Button> : null} />
                ) : (
                <DataTable>
                    <div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="w-36">Время</th>
                                    <th className="w-24">Источник</th>
                                    <th className="w-28">Модуль</th>
                                    <th>Событие</th>
                                    <th>Пользователь</th>
                                    <th>Сущность</th>
                                    <th className="relative w-8"><span className="sr-only">Подробнее</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {(logs?.data || []).flatMap(item => {
                                    const isExpanded = expandedRow === item.id;
                                    const rowBg = ROW_SEVERITY_BG[item.severity] || '';
                                    const rows = [
                                        <tr
                                            key={item.id}
                                            className={`cursor-pointer hover:bg-slate-50 transition-colors ${rowBg}`}
                                            onClick={() => toggleRow(item.id)}
                                        >
                                            <td className="whitespace-nowrap font-mono text-xs tabular-nums text-slate-500">
                                                {formatDate(item.created_at)}
                                            </td>
                                            <td><SourceBadge source={item.source} /></td>
                                            <td><ModuleBadge module={item.module} label={item.module_label} /></td>
                                            <td>
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="font-medium text-slate-900">{item.event_label || item.event_key}</span>
                                                    <SeverityBadge severity={item.severity} label={item.severity_label} />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-800">{item.actor_name}</span>
                                                    {item.actor_email && <span className="text-xs text-slate-500">{item.actor_email}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-700">{item.subject_name || '—'}</span>
                                                    {item.subject_label && (
                                                        <span className="font-mono text-xs text-slate-500">{item.subject_label}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-teal-700">
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
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 sm:px-6">
                            <p className="text-xs font-medium tabular-nums text-slate-500">
                                Показано {logs.from}–{logs.to} из {(logs.total || 0).toLocaleString('ru-RU')} записей
                            </p>
                            <div className="flex gap-2 items-center">
                                {logs.prev_page_url && (
                                    <Link href={logs.prev_page_url}>
                                        <Button variant="outline" size="sm">← Назад</Button>
                                    </Link>
                                )}
                                <span className="px-3 text-sm tabular-nums text-slate-600">{logs.current_page} / {logs.last_page}</span>
                                {logs.next_page_url && (
                                    <Link href={logs.next_page_url}>
                                        <Button variant="outline" size="sm">Вперёд →</Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </DataTable>
                )}

                <p className="text-center text-xs text-slate-500">
                    DEV-среда · Данные из <code>audit_logs</code> + Spatie <code>activity_log</code>
                </p>
            </div>
        </AuthenticatedLayout>
    );
}

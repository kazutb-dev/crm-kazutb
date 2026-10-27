import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { DataTable, FilterBar, FormField, Notice, PageHeader, qdFieldClass, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    History,
    Inbox,
    Search,
    ShieldAlert,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { useMemo } from 'react';

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function statusLabel(value) {
    switch (value) {
        case 'active':
            return 'Активно';
        case 'pending':
            return 'Ожидает';
        case 'expired':
            return 'Истекло';
        case 'revoked':
            return 'Отозвано';
        case 'superseded':
            return 'Заменено';
        default:
            return value ?? 'Неизвестно';
    }
}

function Pill({ children, tone = 'slate' }) {
    const tones = {
        slate: 'border-slate-200 bg-slate-100 text-slate-700',
        blue: 'border-blue-200 bg-blue-50 text-blue-800',
        green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        amber: 'border-amber-200 bg-amber-50 text-amber-900',
        red: 'border-red-200 bg-red-50 text-red-800',
        violet: 'border-amber-200 bg-amber-50 text-amber-900',
    };

    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>{children}</span>;
}

function EntryRow({ entry }) {
    const revoked = entry.status === 'revoked' || entry.revoked_at;
    const typeLabel = entry.kind === 'delegation' ? entry.delegation_type_label : entry.grant_type_label;

    return (
        <tr className="align-top">
            <td>
                <div className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-teal-700">{typeLabel}</div>
                <div className="mt-0.5 font-medium text-slate-900">{entry.capability_label ?? entry.capability ?? 'Запись полномочий'}</div>
            </td>
            <td className="text-sm text-slate-700">
                {entry.kind === 'delegation'
                    ? <>{entry.grantor?.name ?? '—'} <span className="text-slate-400">→</span> {entry.delegate?.name ?? '—'}</>
                    : <>{entry.subject?.name ?? '—'} <span className="text-xs text-slate-500">получает</span></>}
                <div className="text-xs text-slate-500">
                    {entry.kind === 'delegation' ? 'Делегирование' : `Выдал: ${entry.grantor?.name ?? '—'}`}
                </div>
            </td>
            <td className="text-sm text-slate-700">
                {entry.scope_label ?? '—'}
                <div className="text-xs text-slate-500">Модуль: {entry.module ?? '—'}</div>
            </td>
            <td className="whitespace-nowrap text-xs tabular-nums text-slate-600">
                <div>{formatDate(entry.starts_at)}</div>
                <div className="text-slate-400">→ {formatDate(entry.ends_at)}</div>
            </td>
            <td>
                <div className="flex flex-wrap gap-1">
                    <Pill tone={entry.source === 'legacy' ? 'amber' : 'green'}>{entry.source === 'legacy' ? 'Устаревший' : 'Формально'}</Pill>
                    <Pill tone={entry.status === 'active' ? 'green' : entry.status === 'expired' ? 'amber' : 'slate'}>{statusLabel(entry.status)}</Pill>
                    {entry.is_effective_now ? <Pill tone="blue">Действует сейчас</Pill> : <Pill tone="slate">Не действует</Pill>}
                </div>
            </td>
            <td className="max-w-[280px] text-sm text-slate-700">
                {entry.reason ?? '—'}
                {revoked ? (
                    <div className="mt-1 text-xs">
                        <span className="text-red-800">Отозвал: {entry.revoker?.name ?? '—'}</span>
                        {entry.revoked_at ? <span className="tabular-nums text-slate-500"> · {formatDate(entry.revoked_at)}</span> : null}
                        {entry.revocation_reason ? <div className="text-slate-600">{entry.revocation_reason}</div> : null}
                    </div>
                ) : null}
            </td>
            <td>
                <div className="flex flex-wrap gap-1">
                    {entry.risk_flags?.length ? entry.risk_flags.map((flag) => (
                        <Pill key={flag.code} tone={flag.severity === 'high' ? 'red' : flag.severity === 'medium' ? 'amber' : 'slate'}>
                            {flag.label}
                        </Pill>
                    )) : <Pill tone="green">Локальных рисков нет</Pill>}
                </div>
            </td>
        </tr>
    );
}

export default function AuthorityLedger({ summary = {}, entries = [], filters = {}, pagination = {}, options = [], permissions = {} }) {
    const canManageFoundation = Boolean(permissions.canManageFoundation);
    const form = {
        q: filters.q ?? '',
        kind: filters.kind ?? 'all',
        status: filters.status ?? 'active',
        module: filters.module ?? '',
        scope_type: filters.scope_type ?? '',
        per_page: Number(filters.per_page ?? pagination.per_page ?? 20),
    };

    const activeFilterCount = useMemo(() => {
        return [form.q, form.kind, form.status, form.module, form.scope_type].filter((v) => String(v ?? '').trim() !== '' && v !== 'all' && v !== 'active').length;
    }, [form.kind, form.module, form.q, form.scope_type, form.status]);

    const updateFilters = (patch, resetPage = true) => {
        const payload = {
            ...filters,
            ...patch,
        };

        if (resetPage) {
            payload.page = 1;
        }

        router.get(route('governance.authority-ledger'), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        router.get(route('governance.authority-ledger'), {
            per_page: form.per_page,
            page: 1,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const goToPage = (page) => {
        if (!page || page < 1 || page > (pagination.last_page ?? 1)) {
            return;
        }

        updateFilters({ page }, false);
    };

    const effectiveNow = entries.filter((entry) => entry.is_effective_now).length;
    const withRisks = entries.filter((entry) => entry.risk_flags?.length).length;
    const currentPage = pagination.current_page ?? 1;
    const lastPage = pagination.last_page ?? 1;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Управление доступом"
                    title="Журнал полномочий"
                    description="Журнал назначенных прав, делегирований и переходных устаревших источников полномочий."
                    actions={(
                        <Button variant="outline" size="sm" onClick={() => router.visit(route('governance.role-access'))}>
                            Ролевой доступ
                        </Button>
                    )}
                    meta={<StatusBadge tone="info">Уровень управления доступом</StatusBadge>}
                />
            )}
        >
            <Head title="Журнал полномочий" />

            <div className="admin-page-wrap space-y-6">
                {canManageFoundation ? (
                    <Notice
                        tone="danger"
                        className="flex-wrap"
                        action={(
                            <div className="flex max-w-full flex-wrap gap-2 self-center">
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('kpi.settings', { tab: 'access' }))}>Права KPI</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('users.admin-access'))}>Права администратора</Button>
                            </div>
                        )}
                    >
                        <span className="font-semibold text-red-800">Суперадмин-управление полномочиями.</span>{' '}
                        Создание, отзыв и принудительное переопределение — через проверяемые процессы назначения прав с обязательной причиной.
                    </Notice>
                ) : null}

                <StatGrid>
                    <StatTile label="Назначения доступа" value={(summary.scoped_grants ?? 0).toLocaleString('ru-RU')} tone="teal" icon={ShieldCheck} />
                    <StatTile label="Делегирования" value={(summary.delegations ?? 0).toLocaleString('ru-RU')} tone="info" icon={History} />
                    <StatTile label="Активные" value={(summary.active ?? 0).toLocaleString('ru-RU')} tone="success" icon={Clock} />
                    <StatTile label="Истекшие" value={(summary.expired ?? 0).toLocaleString('ru-RU')} tone="warning" icon={ShieldAlert} />
                    <StatTile label="Устаревшие источники" value={(summary.legacy_sources ?? 0).toLocaleString('ru-RU')} tone="copper" icon={Users} />
                </StatGrid>

                <FilterBar>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] xl:items-end">
                        <label className="relative block space-y-2 md:col-span-2 xl:col-span-1">
                            <span className="qd-field-label block">Поиск</span>
                            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
                            <Input
                                value={form.q}
                                onChange={(e) => updateFilters({ q: e.target.value })}
                                className="pl-9"
                                placeholder="Поиск: субъект, делегат, полномочие, область"
                            />
                        </label>
                        <FormField label="Вид записи">
                            <select value={form.kind} onChange={(e) => updateFilters({ kind: e.target.value })} className={qdFieldClass}>
                                {(options.kinds ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </FormField>
                        <FormField label="Статус">
                            <select value={form.status} onChange={(e) => updateFilters({ status: e.target.value })} className={qdFieldClass}>
                                {(options.statuses ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </FormField>
                        <FormField label="Модуль">
                            <select value={form.module} onChange={(e) => updateFilters({ module: e.target.value })} className={qdFieldClass}>
                                <option value="">Все модули</option>
                                {(options.modules ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </FormField>
                        <FormField label="Тип области">
                            <select value={form.scope_type} onChange={(e) => updateFilters({ scope_type: e.target.value })} className={qdFieldClass}>
                                <option value="">Все типы областей</option>
                                {(options.scope_types ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </FormField>
                        <div className="flex h-10 items-center gap-2 md:col-span-2 xl:col-span-1">
                            <StatusBadge tone="default">Активно: {activeFilterCount}</StatusBadge>
                            <Button variant="outline" size="sm" onClick={clearFilters}>Сбросить</Button>
                        </div>
                    </div>
                </FilterBar>

                <DataTable>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
                        <div className="flex items-baseline gap-2 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[#102945]">
                            Записи полномочий
                            <span className="text-xs font-medium normal-case tracking-normal text-slate-500">
                                {(pagination.total ?? entries.length).toLocaleString('ru-RU')} записей
                            </span>
                        </div>
                        {entries.length ? (
                            <div className="flex flex-wrap gap-1.5">
                                <StatusBadge tone="success">Действуют сейчас: {effectiveNow}</StatusBadge>
                                <StatusBadge tone="danger">С рисками: {withRisks}</StatusBadge>
                            </div>
                        ) : null}
                    </div>

                    {entries.length ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-[1180px]">
                                <thead>
                                    <tr>
                                        <th>Полномочие</th>
                                        <th>Цепочка</th>
                                        <th>Область / модуль</th>
                                        <th>Период</th>
                                        <th>Состояние</th>
                                        <th>Причина</th>
                                        <th>Риски</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} />)}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
                            <Inbox className="h-5 w-5 text-teal-700" aria-hidden="true" />
                            <p className="font-semibold text-[#102945]">Записей нет</p>
                            <p className="text-sm text-slate-600">Записи полномочий по текущим фильтрам не найдены.</p>
                            <Button variant="outline" size="sm" onClick={clearFilters}>Сбросить фильтры</Button>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 sm:px-6">
                        <div className="text-xs font-medium tabular-nums text-slate-500">
                            Показано {entries.length} из {pagination.total ?? entries.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                                <ChevronLeft className="mr-1 h-4 w-4" /> Назад
                            </Button>
                            <span className="text-sm tabular-nums text-slate-600">Стр. {currentPage} / {lastPage}</span>
                            <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= lastPage}>
                                Вперёд <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DataTable>
            </div>
        </AuthenticatedLayout>
    );
}

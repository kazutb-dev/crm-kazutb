import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmptyState, FilterBar, FormField, Notice, PageHeader, qdFieldClass, StatTile, StatusBadge } from '@/components/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Filter,
    History,
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

function Detail({ label, children, className = '' }) {
    return (
        <div className={`flex flex-col gap-1 border-b border-slate-200 pb-3 ${className}`}>
            <span className="qd-field-label text-slate-500">{label}</span>
            <div className="text-[0.9375rem] font-medium text-slate-900">{children}</div>
        </div>
    );
}

function RowCard({ entry }) {
    const revoked = entry.status === 'revoked' || entry.revoked_at;

    return (
        <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div className="min-w-0">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-teal-700">
                        {entry.kind === 'delegation' ? entry.delegation_type_label : entry.grant_type_label}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold leading-snug text-[#102945]">{entry.capability_label ?? entry.capability ?? 'Запись полномочий'}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">
                        {entry.kind === 'delegation'
                            ? `${entry.grantor?.name ?? '—'} → ${entry.delegate?.name ?? '—'}`
                            : `${entry.subject?.name ?? '—'} / ${entry.grantor?.name ?? '—'}`}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Pill tone={entry.source === 'legacy' ? 'amber' : 'green'}>{entry.source === 'legacy' ? 'Устаревший' : 'Формально'}</Pill>
                    <Pill tone={entry.status === 'active' ? 'green' : entry.status === 'expired' ? 'amber' : 'slate'}>{statusLabel(entry.status)}</Pill>
                    {entry.is_effective_now ? <Pill tone="blue">Действует сейчас</Pill> : <Pill tone="slate">Не действует</Pill>}
                </div>
            </div>
            <CardContent className="space-y-4 pt-4 text-sm text-slate-700">
                <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
                    <Detail label="Тип">{entry.kind === 'delegation' ? entry.delegation_type_label : entry.grant_type_label}</Detail>
                    <Detail label="Область">{entry.scope_label ?? '—'}</Detail>
                    <Detail label="Модуль">{entry.module ?? '—'}</Detail>
                    <Detail label="Период"><span className="tabular-nums">{formatDate(entry.starts_at)} → {formatDate(entry.ends_at)}</span></Detail>
                    <Detail label="Цепочка полномочий" className="md:col-span-2">
                        {entry.kind === 'delegation'
                            ? `${entry.grantor?.name ?? '—'} делегирует ${entry.delegate?.name ?? '—'}`
                            : `${entry.subject?.name ?? '—'} получает ${entry.capability_label ?? entry.capability ?? 'полномочие'}`}
                    </Detail>
                    <Detail label="Причина" className="md:col-span-2">{entry.reason ?? '—'}</Detail>
                    <Detail label="Кто выдал" className="md:col-span-2">
                        {entry.grantor?.name ?? '—'}
                        {entry.starts_at && <span className="block text-xs font-normal tabular-nums text-slate-500">{formatDate(entry.starts_at)}</span>}
                    </Detail>
                    {revoked && (
                        <Detail label="Кто отозвал" className="md:col-span-2">
                            <span className="text-red-800">{entry.revoker?.name ?? '—'}</span>
                            {entry.revoked_at && <span className="block text-xs font-normal tabular-nums text-slate-500">{formatDate(entry.revoked_at)}</span>}
                            {entry.revocation_reason && <span className="block text-xs font-normal text-slate-700">{entry.revocation_reason}</span>}
                        </Detail>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="qd-field-label text-slate-500">Риски</span>
                    {entry.risk_flags?.length ? entry.risk_flags.map((flag) => (
                        <Pill key={flag.code} tone={flag.severity === 'high' ? 'red' : flag.severity === 'medium' ? 'amber' : 'slate'}>
                            {flag.label}
                        </Pill>
                    )) : <Pill tone="green">Локальных рисков нет</Pill>}
                </div>
            </CardContent>
        </Card>
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
                        title="Суперадмин-управление полномочиями"
                    >
                        Создание, отзыв и принудительное переопределение выполняются через проверяемые процессы назначения прав с обязательной причиной.
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => router.visit(route('kpi.settings', { tab: 'access' }))}>Права KPI</Button>
                            <Button size="sm" variant="outline" onClick={() => router.visit(route('users.admin-access'))}>Права администратора</Button>
                            <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.role-access'))}>Ролевой доступ</Button>
                        </div>
                    </Notice>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <StatTile label="Назначения доступа" value={(summary.scoped_grants ?? 0).toLocaleString('ru-RU')} tone="teal" icon={ShieldCheck} />
                    <StatTile label="Делегирования" value={(summary.delegations ?? 0).toLocaleString('ru-RU')} tone="info" icon={History} />
                    <StatTile label="Активные" value={(summary.active ?? 0).toLocaleString('ru-RU')} tone="success" icon={Clock} />
                    <StatTile label="Истекшие" value={(summary.expired ?? 0).toLocaleString('ru-RU')} tone="warning" icon={ShieldAlert} />
                    <StatTile label="Устаревшие источники" value={(summary.legacy_sources ?? 0).toLocaleString('ru-RU')} tone="copper" icon={Users} />
                </div>

                <FilterBar>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[#102945]">
                            <Filter className="h-4 w-4 text-teal-700" />
                            Фильтры
                        </div>
                        <StatusBadge tone="default">Активно: {activeFilterCount}</StatusBadge>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                        <label className="relative block space-y-2 md:col-span-2">
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
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
                        <div className="text-xs font-medium tabular-nums text-slate-500">
                            Показано {entries.length} из {pagination.total ?? entries.length} · стр. {currentPage} / {lastPage}
                        </div>
                        <Button variant="outline" size="sm" onClick={clearFilters}>Сбросить</Button>
                    </div>
                </FilterBar>

                <div className="space-y-4">
                    {entries.length ? entries.map((entry) => <RowCard key={`${entry.kind}-${entry.id}`} entry={entry} />) : (
                        <EmptyState title="Записей нет" description="Записи полномочий по текущим фильтрам не найдены." action={<Button variant="outline" size="sm" onClick={clearFilters}>Сбросить фильтры</Button>} />
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
                    <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Назад
                    </Button>
                    <span className="text-sm tabular-nums text-slate-600">Стр. {currentPage} / {lastPage}</span>
                    <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= lastPage}>
                        Вперёд
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

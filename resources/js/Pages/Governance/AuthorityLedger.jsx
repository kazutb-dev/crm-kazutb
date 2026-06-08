import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, PageHeader, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function SummaryCard({ title, value, subtitle, tone = 'slate', icon: Icon }) {
    const tones = {
        slate: 'border-slate-200 bg-white',
        blue: 'border-blue-200 bg-blue-50/35',
        green: 'border-emerald-200 bg-emerald-50/35',
        amber: 'border-amber-200 bg-amber-50/35',
        red: 'border-red-200 bg-red-50/35',
        violet: 'border-violet-200 bg-violet-50/35',
    };

    return (
        <Card className={`border shadow-sm ${tones[tone] ?? tones.slate}`}>
            <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
                        <p className="mt-1 text-3xl font-semibold text-slate-900">{(value ?? 0).toLocaleString('ru-RU')}</p>
                        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
                    </div>
                    {Icon ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600">
                            <Icon className="h-4 w-4" />
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

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
        violet: 'border-violet-200 bg-violet-50 text-violet-800',
    };

    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>{children}</span>;
}

function RowCard({ entry }) {
    const actorName = entry.kind === 'delegation'
        ? entry.delegate?.name ?? '—'
        : entry.subject?.name ?? '—';

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-base text-slate-900">{entry.capability_label ?? entry.capability ?? 'Запись полномочий'}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {entry.kind === 'delegation'
                                ? `${entry.grantor?.name ?? '—'} → ${entry.delegate?.name ?? '—'}`
                                : `${entry.subject?.name ?? '—'} / ${entry.grantor?.name ?? '—'}`}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Pill tone={entry.source === 'legacy' ? 'amber' : 'green'}>{entry.source === 'legacy' ? 'Legacy' : 'Формально'}</Pill>
                        <Pill tone={entry.status === 'active' ? 'green' : entry.status === 'expired' ? 'amber' : 'slate'}>{statusLabel(entry.status)}</Pill>
                        {entry.is_effective_now ? <Pill tone="blue">Действует сейчас</Pill> : <Pill tone="slate">Не действует</Pill>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Тип</p>
                        <p className="mt-1 font-medium text-slate-900">{entry.kind === 'delegation' ? entry.delegation_type_label : entry.grant_type_label}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Scope</p>
                        <p className="mt-1 font-medium text-slate-900">{entry.scope_label ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Модуль</p>
                        <p className="mt-1 font-medium text-slate-900">{entry.module ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Период</p>
                        <p className="mt-1 font-medium text-slate-900">{formatDate(entry.starts_at)} → {formatDate(entry.ends_at)}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {entry.risk_flags?.length ? entry.risk_flags.map((flag) => (
                        <Pill key={flag.code} tone={flag.severity === 'high' ? 'red' : flag.severity === 'medium' ? 'amber' : 'slate'}>
                            {flag.label}
                        </Pill>
                    )) : <Pill tone="green">Локальных рисков нет</Pill>}
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Цепочка полномочий</p>
                        <p className="mt-1 font-medium text-slate-900">
                            {entry.kind === 'delegation'
                                ? `${entry.grantor?.name ?? '—'} делегирует ${entry.delegate?.name ?? '—'}`
                                : `${entry.subject?.name ?? '—'} получает ${entry.capability_label ?? entry.capability ?? 'полномочие'}`}
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Причина</p>
                        <p className="mt-1 font-medium text-slate-900">{entry.reason ?? '—'}</p>
                    </div>
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

    return (
        <AuthenticatedLayout>
            <Head title="Журнал полномочий" />

            <div className="admin-page-wrap space-y-5">
                <PageHeader
                    eyebrow="Governance"
                    title="Журнал полномочий"
                    description="Журнал scoped grants, delegations и transitional legacy authority sources."
                    actions={(
                        <Button variant="outline" size="sm" onClick={() => router.visit(route('governance.role-access'))}>
                            Ролевой доступ
                        </Button>
                    )}
                    meta={<StatusBadge tone="info">Governance authority layer</StatusBadge>}
                />

                {canManageFoundation ? (
                    <Card className="border-red-200 bg-red-50/40 shadow-sm">
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                            <div>
                                <p className="text-sm font-semibold text-red-900">Super Admin управление полномочиями</p>
                                <p className="text-xs text-red-800">Создание, отзыв и override выполняются через audited grant workflows с обязательной причиной.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('kpi.settings', { tab: 'access' }))}>KPI grants</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('users.admin-access'))}>Права администратора</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.role-access'))}>Ролевой доступ</Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard title="Scoped grants" value={summary.scoped_grants} tone="green" icon={ShieldCheck} />
                    <SummaryCard title="Делегирования" value={summary.delegations} tone="blue" icon={History} />
                    <SummaryCard title="Активные" value={summary.active} tone="emerald" icon={Clock} />
                    <SummaryCard title="Истекшие" value={summary.expired} tone="amber" icon={ShieldAlert} />
                    <SummaryCard title="Legacy источники" value={summary.legacy_sources} tone="violet" icon={Users} />
                </div>

                <FilterBar>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <Filter className="h-4 w-4" />
                            Фильтры
                        </div>
                        <StatusBadge tone="default">Активно: {activeFilterCount}</StatusBadge>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                            <div className="relative xl:col-span-2">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={form.q}
                                    onChange={(e) => updateFilters({ q: e.target.value })}
                                    className="pl-9"
                                    placeholder="Поиск: субъект, делегат, capability, scope"
                                />
                            </div>
                            <select
                                value={form.kind}
                                onChange={(e) => updateFilters({ kind: e.target.value })}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                {(options.kinds ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select
                                value={form.status}
                                onChange={(e) => updateFilters({ status: e.target.value })}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                {(options.statuses ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select
                                value={form.module}
                                onChange={(e) => updateFilters({ module: e.target.value })}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Все модули</option>
                                {(options.modules ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select
                                value={form.scope_type}
                                onChange={(e) => updateFilters({ scope_type: e.target.value })}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Все типы scope</option>
                                {(options.scope_types ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={clearFilters}>Сбросить</Button>
                            <Badge variant="outline">Показано {entries.length} из {pagination.total ?? entries.length}</Badge>
                            <Badge variant="outline">Стр. {pagination.current_page ?? 1} / {pagination.last_page ?? 1}</Badge>
                        </div>
                    </div>
                </FilterBar>

                <div className="space-y-3">
                    {entries.length ? entries.map((entry) => <RowCard key={`${entry.kind}-${entry.id}`} entry={entry} />) : (
                        <Card className="border-dashed border-slate-300">
                            <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                Записи полномочий по текущим фильтрам не найдены.
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => goToPage((pagination.current_page ?? 1) - 1)} disabled={(pagination.current_page ?? 1) <= 1}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Назад
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => goToPage((pagination.current_page ?? 1) + 1)} disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)}>
                        Вперёд
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

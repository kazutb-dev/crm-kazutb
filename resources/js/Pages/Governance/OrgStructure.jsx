import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, PageHeader, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Building2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    GitBranch,
    Search,
    Shield,
    User,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

function SummaryCard({ title, value, subtitle, tone = 'slate', icon: Icon }) {
    const tones = {
        slate: 'border-slate-200 bg-white',
        blue: 'border-blue-200 bg-blue-50/35',
        amber: 'border-amber-200 bg-amber-50/35',
        red: 'border-red-200 bg-red-50/35',
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

function TypeBadge({ label }) {
    return <Badge className="border-slate-200 bg-slate-100 text-slate-700">{label}</Badge>;
}

function TreeNode({ node, level = 0, expanded, onToggle }) {
    const hasChildren = (node.children ?? []).length > 0;
    const isExpanded = expanded.has(node.id);

    return (
        <div>
            <div
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                style={{ paddingLeft: `${Math.min(level * 16, 96) + 8}px` }}
            >
                <button
                    type="button"
                    onClick={() => onToggle(node.id)}
                    className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-slate-500"
                    disabled={!hasChildren}
                >
                    {hasChildren ? (isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <span className="h-3 w-3" />}
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{node.name}</span>
                        <TypeBadge label={node.unit_type_label} />
                        {node.code ? <Badge variant="outline">{node.code}</Badge> : null}
                        {node.metadata?.transitional_mapping ? (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-800">Transitional mapping</Badge>
                        ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Дочерние: {node.children_count ?? 0}</span>
                        <span>Руководитель: {node.leader_name ?? 'не назначен'}</span>
                    </div>
                </div>
            </div>

            {hasChildren && isExpanded ? (
                <div>
                    {node.children.map((child) => (
                        <TreeNode key={child.id} node={child} level={level + 1} expanded={expanded} onToggle={onToggle} />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default function OrgStructure({ summary = {}, tree = [], units = [], pagination = {}, filters = {}, options = {}, unknowns = {}, permissions = {} }) {
    const [expanded, setExpanded] = useState(() => new Set(tree.map((node) => node.id)));
    const canManageFoundation = Boolean(permissions.canManageFoundation);

    const form = {
        q: filters.q ?? '',
        unit_type: filters.unit_type ?? '',
        missing_leader: filters.missing_leader ?? '',
        transitional: filters.transitional ?? '',
        per_page: Number(filters.per_page ?? pagination.per_page ?? 25),
    };

    const typeOptions = options.unit_types ?? [];
    const setupRequired = Boolean(options.setup_required);

    const activeFilterCount = useMemo(() => {
        return [form.q, form.unit_type, form.missing_leader, form.transitional]
            .filter((value) => String(value ?? '').trim() !== '')
            .length;
    }, [form.missing_leader, form.q, form.transitional, form.unit_type]);

    const updateFilters = (patch, resetPage = true) => {
        const payload = {
            ...filters,
            ...patch,
        };

        if (resetPage) {
            payload.page = 1;
        }

        router.get(route('governance.org-structure'), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearFilters = () => {
        router.get(route('governance.org-structure'), {
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

    const toggleNode = (nodeId) => {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }

            return next;
        });
    };

    const expandAll = () => {
        const allIds = [];
        const walk = (nodes) => {
            nodes.forEach((node) => {
                allIds.push(node.id);
                if (Array.isArray(node.children) && node.children.length > 0) {
                    walk(node.children);
                }
            });
        };
        walk(tree);
        setExpanded(new Set(allIds));
    };

    const collapseAll = () => {
        setExpanded(new Set());
    };

    return (
        <AuthenticatedLayout>
            <Head title="Оргструктура" />

            <div className="admin-page-wrap space-y-5">
                <PageHeader
                    eyebrow="Governance"
                    title="Оргструктура"
                    description="Формальный организационный каталог для governance, scope и approvals."
                    actions={(
                        <Button variant="outline" size="sm" onClick={() => router.visit(route('governance.role-access'))}>
                            <Shield className="h-4 w-4" />
                            Ролевой доступ
                        </Button>
                    )}
                    meta={<StatusBadge tone="info">Foundation layer</StatusBadge>}
                />

                {canManageFoundation ? (
                    <Card className="border-red-200 bg-red-50/40 shadow-sm">
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                            <div>
                                <p className="text-sm font-semibold text-red-900">Super Admin управление оргструктурой</p>
                                <p className="text-xs text-red-800">Создание, редактирование, удаление и override org binding выполняются через audited workflows с обязательной причиной.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('users.index'))}>Редактировать сотрудников</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.access-requests'))}>Запросы согласования</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.role-access'))}>Ролевой доступ</Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard title="Всего орг-юнитов" value={summary.total_units} tone="blue" icon={Building2} />
                    <SummaryCard title="Корневые ветки" value={summary.root_units} tone="slate" icon={GitBranch} />
                    <SummaryCard title="Без руководителя" value={summary.without_leader} tone="amber" icon={User} />
                    <SummaryCard title="Transitional mappings" value={summary.transitional_mappings} tone="red" icon={AlertTriangle} />
                </div>

                {setupRequired ? (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="pt-4 text-sm text-amber-900">
                            Каталог оргструктуры еще не инициализирован в этой БД. Примените миграции, чтобы загрузить таблицу org_units.
                        </CardContent>
                    </Card>
                ) : null}

                <FilterBar>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-base font-semibold text-foreground">Фильтры каталога</div>
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
                                    placeholder="Поиск: unit, code, руководитель"
                                />
                            </div>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.unit_type}
                                onChange={(e) => updateFilters({ unit_type: e.target.value })}
                            >
                                <option value="">Все типы</option>
                                {typeOptions.map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={form.missing_leader}
                                onChange={(e) => updateFilters({ missing_leader: e.target.value })}
                            >
                                <option value="">Руководитель: все</option>
                                <option value="1">Только без руководителя</option>
                            </select>

                            <div className="flex gap-2">
                                <select
                                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                                    value={form.transitional}
                                    onChange={(e) => updateFilters({ transitional: e.target.value })}
                                >
                                    <option value="">Mapping: все</option>
                                    <option value="1">Только transitional</option>
                                </select>
                                <Button type="button" variant="outline" onClick={clearFilters}>Сбросить</Button>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground">Активно фильтров: {activeFilterCount}</div>
                    </div>
                </FilterBar>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                    <Card className="admin-surface xl:col-span-3">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between gap-3 text-base">
                                <span>Дерево структуры</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={expandAll}>Развернуть</Button>
                                    <Button variant="outline" size="sm" onClick={collapseAll}>Свернуть</Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-[760px] overflow-auto pr-2">
                            {tree.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Данные оргструктуры пока не загружены.</p>
                            ) : (
                                <div className="space-y-1">
                                    {tree.map((node) => (
                                        <TreeNode key={node.id} node={node} expanded={expanded} onToggle={toggleNode} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4 xl:col-span-2">
                        <Card className="admin-surface">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Risk / unknowns</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Без назначенного руководителя</p>
                                    <div className="space-y-1">
                                        {(unknowns.without_leader ?? []).slice(0, 8).map((item) => (
                                            <div key={item.id} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                                                {item.name}
                                            </div>
                                        ))}
                                        {(unknowns.without_leader ?? []).length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Нет записей.</p>
                                        ) : null}
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Transitional mapping</p>
                                    <div className="space-y-1">
                                        {(unknowns.transitional_mappings ?? []).slice(0, 8).map((item) => (
                                            <div key={item.id} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900">
                                                <div className="font-medium">{item.name}</div>
                                                {item.metadata?.legacy_mapping_from ? (
                                                    <div className="text-[11px]">legacy: {item.metadata.legacy_mapping_from}</div>
                                                ) : null}
                                                {item.metadata?.note ? (
                                                    <div className="text-[11px]">{item.metadata.note}</div>
                                                ) : null}
                                            </div>
                                        ))}
                                        {(unknowns.transitional_mappings ?? []).length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Нет transitional mappings.</p>
                                        ) : null}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="admin-surface">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Type breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                {(summary.type_breakdown ?? []).map((item) => (
                                    <div key={item.type} className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-xs">
                                        <span>{item.label}</span>
                                        <span className="font-semibold text-slate-800">{item.count}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card className="admin-surface">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Каталог (плоский вид)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full min-w-[960px] text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold">Орг-юнит</th>
                                        <th className="px-3 py-2 text-left font-semibold">Тип</th>
                                        <th className="px-3 py-2 text-left font-semibold">Parent ID</th>
                                        <th className="px-3 py-2 text-left font-semibold">Код</th>
                                        <th className="px-3 py-2 text-left font-semibold">Руководитель</th>
                                        <th className="px-3 py-2 text-left font-semibold">Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {units.map((item) => (
                                        <tr key={item.id} className="border-t border-slate-100 align-top">
                                            <td className="px-3 py-2">
                                                <div className="font-medium text-slate-900">{item.name}</div>
                                                <div className="text-xs text-slate-500">ID: {item.id}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <TypeBadge label={item.unit_type_label} />
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">{item.parent_id ?? 'Корень'}</td>
                                            <td className="px-3 py-2 text-slate-700">{item.code}</td>
                                            <td className="px-3 py-2">
                                                {item.leader_name ? (
                                                    <div>
                                                        <div className="font-medium text-slate-900">{item.leader_name}</div>
                                                        <div className="text-xs text-slate-500">{item.leader_title ?? '—'}</div>
                                                    </div>
                                                ) : (
                                                    <Badge className="border-amber-200 bg-amber-50 text-amber-800">Не назначен</Badge>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {item.metadata?.transitional_mapping ? (
                                                        <Badge className="border-red-200 bg-red-50 text-red-800">Transitional</Badge>
                                                    ) : (
                                                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Foundation</Badge>
                                                    )}
                                                    {!item.is_active ? (
                                                        <Badge variant="outline">Inactive</Badge>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {units.length === 0 ? (
                                        <tr>
                                            <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={6}>Нет записей по текущим фильтрам.</td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-slate-600">
                                Показано {pagination.from ?? 0}–{pagination.to ?? 0} из {pagination.total ?? 0}
                            </div>

                            <div className="flex items-center gap-2">
                                <select
                                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                                    value={form.per_page}
                                    onChange={(e) => updateFilters({ per_page: Number(e.target.value) })}
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={(pagination.current_page ?? 1) <= 1}
                                    onClick={() => goToPage((pagination.current_page ?? 1) - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Badge variant="outline">{pagination.current_page ?? 1} / {pagination.last_page ?? 1}</Badge>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={(pagination.current_page ?? 1) >= (pagination.last_page ?? 1)}
                                    onClick={() => goToPage((pagination.current_page ?? 1) + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

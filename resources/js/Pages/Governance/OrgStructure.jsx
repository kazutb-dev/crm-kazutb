import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { FilterBar, FormField, Notice, PageHeader, qdFieldClass, StatGrid, StatTile, StatusBadge } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle, Building2, ChevronDown, ChevronLeft, ChevronRight,
    ChevronUp, GitBranch, Pencil, Plus, Search, Shield, Trash2, User,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

function TypeBadge({ label }) {
    return <Badge variant="secondary">{label}</Badge>;
}

function TreeNode({ node, level = 0, expanded, onToggle }) {
    const hasChildren = (node.children ?? []).length > 0;
    const isExpanded = expanded.has(node.id);

    return (
        <div>
            <div
                className="group flex items-start gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-slate-50"
                style={{ paddingLeft: `${Math.min(level * 16, 96) + 8}px` }}
            >
                <button
                    type="button"
                    onClick={() => onToggle(node.id)}
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-teal-700 transition-colors hover:border-teal-600 disabled:border-transparent disabled:bg-transparent"
                    disabled={!hasChildren}
                >
                    {hasChildren ? (isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-slate-900 ${level === 0 ? 'font-semibold text-[#102945]' : 'font-medium'}`}>{node.name}</span>
                        <TypeBadge label={node.unit_type_label} />
                        {node.code ? <Badge variant="outline">{node.code}</Badge> : null}
                        {node.metadata?.transitional_mapping ? (
                            <Badge variant="warning">Переходное сопоставление</Badge>
                        ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="tabular-nums">Дочерние: {node.children_count ?? 0}</span>
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

    // ── CRUD state ─────────────────────────────────────────────────────────
    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);   // OrgUnit object
    const [deleteTarget, setDeleteTarget] = useState(null);

    const blankUnitForm = { code: '', name: '', unit_type: 'department', parent_id: '', leader_name: '', is_active: true };

    const createForm = useForm({ ...blankUnitForm });
    const editForm   = useForm({ ...blankUnitForm });

    const openEdit = (unit) => {
        setEditTarget(unit);
        editForm.setData({
            code: unit.code ?? '',
            name: unit.name ?? '',
            unit_type: unit.unit_type ?? 'department',
            parent_id: unit.parent_id ? String(unit.parent_id) : '',
            leader_name: unit.leader_name ?? '',
            is_active: unit.is_active ?? true,
        });
    };

    const submitCreate = (e) => {
        e.preventDefault();
        createForm.post(route('governance.org-structure.store'), {
            preserveScroll: true,
            onSuccess: () => { createForm.reset(); setCreateOpen(false); },
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();
        editForm.patch(route('governance.org-structure.update', editTarget.id), {
            preserveScroll: true,
            onSuccess: () => { setEditTarget(null); },
        });
    };

    const submitDelete = () => {
        router.delete(route('governance.org-structure.destroy', deleteTarget.id), {
            preserveScroll: true,
            onSuccess: () => setDeleteTarget(null),
        });
    };

    // ── Filters ────────────────────────────────────────────────────────────
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

    const unitNames = useMemo(() => {
        const names = new Map();
        const walk = (nodes) => nodes.forEach((node) => {
            names.set(node.id, node.name);
            if (Array.isArray(node.children)) walk(node.children);
        });
        walk(tree);
        units.forEach((unit) => names.set(unit.id, unit.name));
        return names;
    }, [tree, units]);
    const typeTotal = (summary.type_breakdown ?? []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);

    const currentPage = pagination.current_page ?? 1;
    const lastPage = pagination.last_page ?? 1;

    return (
        <AuthenticatedLayout
            header={(
                <PageHeader
                    eyebrow="Управление доступом"
                    title="Оргструктура"
                    description="Формальный организационный каталог для governance, scope и approvals."
                    actions={(
                        <>
                            {canManageFoundation ? (
                                <Button size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Создать единицу
                                </Button>
                            ) : null}
                            <Button variant="outline" size="sm" onClick={() => router.visit(route('governance.role-access'))}>
                                <Shield className="h-4 w-4" />
                                Ролевой доступ
                            </Button>
                        </>
                    )}
                    meta={<StatusBadge tone="info">Базовый уровень</StatusBadge>}
                />
            )}
        >
            <Head title="Оргструктура" />

            <div className="admin-page-wrap space-y-6">
                {canManageFoundation ? (
                    <Notice
                        tone="danger"
                        className="flex-wrap"
                        action={(
                            <div className="flex max-w-full flex-wrap gap-2 self-center">
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('users.index'))}>Сотрудники</Button>
                                <Button size="sm" variant="outline" onClick={() => router.visit(route('governance.access-requests'))}>Запросы</Button>
                            </div>
                        )}
                    >
                        <span className="font-semibold text-red-800">Управление оргструктурой.</span>{' '}
                        Создание, редактирование и удаление выполняются администратором. Все изменения логируются.
                    </Notice>
                ) : null}

                <StatGrid>
                    <StatTile label="Всего орг-юнитов" value={(summary.total_units ?? 0).toLocaleString('ru-RU')} tone="navy" icon={Building2} />
                    <StatTile label="Корневые ветки" value={(summary.root_units ?? 0).toLocaleString('ru-RU')} tone="teal" icon={GitBranch} />
                    <StatTile label="Без руководителя" value={(summary.without_leader ?? 0).toLocaleString('ru-RU')} tone="warning" icon={User} />
                    <StatTile label="Переходные сопоставления" value={(summary.transitional_mappings ?? 0).toLocaleString('ru-RU')} tone="danger" icon={AlertTriangle} />
                </StatGrid>

                {setupRequired ? (
                    <Notice tone="warning" title="Каталог не инициализирован">
                        Каталог оргструктуры еще не инициализирован в этой БД. Примените миграции, чтобы загрузить таблицу org_units.
                    </Notice>
                ) : null}

                <FilterBar>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] xl:items-end">
                        <label className="relative block space-y-2 md:col-span-2 xl:col-span-1">
                            <span className="qd-field-label block">Поиск</span>
                            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
                            <Input
                                value={form.q}
                                onChange={(e) => updateFilters({ q: e.target.value })}
                                className="pl-9"
                                placeholder="Поиск: unit, code, руководитель"
                            />
                        </label>

                        <FormField label="Тип">
                            <select className={qdFieldClass} value={form.unit_type} onChange={(e) => updateFilters({ unit_type: e.target.value })}>
                                <option value="">Все типы</option>
                                {typeOptions.map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Руководитель">
                            <select className={qdFieldClass} value={form.missing_leader} onChange={(e) => updateFilters({ missing_leader: e.target.value })}>
                                <option value="">Руководитель: все</option>
                                <option value="1">Только без руководителя</option>
                            </select>
                        </FormField>

                        <FormField label="Сопоставление">
                            <select className={qdFieldClass} value={form.transitional} onChange={(e) => updateFilters({ transitional: e.target.value })}>
                                <option value="">Сопоставление: все</option>
                                <option value="1">Только переходные</option>
                            </select>
                        </FormField>

                        <div className="flex h-10 items-center gap-2 md:col-span-2 xl:col-span-1">
                            <StatusBadge tone="default">Активно: {activeFilterCount}</StatusBadge>
                            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Сбросить</Button>
                        </div>
                    </div>
                </FilterBar>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" />Дерево структуры</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={expandAll}>Развернуть</Button>
                                <Button variant="outline" size="sm" onClick={collapseAll}>Свернуть</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="max-h-[640px] overflow-auto pr-2">
                            {tree.length === 0 ? (
                                <p className="py-8 text-center text-sm text-slate-500">Данные оргструктуры пока не загружены.</p>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {tree.map((node) => (
                                        <TreeNode key={node.id} node={node} expanded={expanded} onToggle={toggleNode} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />По типам</CardTitle>
                                <span className="text-xs font-medium tabular-nums text-slate-500">{typeTotal} ед.</span>
                            </CardHeader>
                            <CardContent className="space-y-2.5">
                                {(summary.type_breakdown ?? []).length === 0 ? (
                                    <p className="text-sm text-slate-500">Нет данных.</p>
                                ) : null}
                                {(summary.type_breakdown ?? []).map((item) => (
                                    <div key={item.type}>
                                        <div className="flex items-center justify-between gap-2 text-sm">
                                            <span className="truncate text-slate-700">{item.label}</span>
                                            <span className="font-semibold tabular-nums text-[#102945]">
                                                {item.count}
                                                <span className="ml-1.5 text-xs font-normal text-slate-500">{typeTotal ? Math.round((item.count / typeTotal) * 100) : 0}%</span>
                                            </span>
                                        </div>
                                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                                            <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${typeTotal ? (item.count / typeTotal) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Риски и пробелы</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="qd-field-label mb-1 flex items-center gap-2 text-slate-500">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                                        Без назначенного руководителя
                                        <span className="ml-auto tabular-nums">{(unknowns.without_leader ?? []).length}</span>
                                    </p>
                                    <div>
                                        {(unknowns.without_leader ?? []).slice(0, 8).map((item) => (
                                            <div key={item.id} className="border-b border-slate-200 py-1.5 text-sm text-slate-800 last:border-0">
                                                {item.name}
                                            </div>
                                        ))}
                                        {(unknowns.without_leader ?? []).length === 0 ? (
                                            <p className="text-sm text-slate-500">Нет записей.</p>
                                        ) : null}
                                    </div>
                                </div>

                                <div>
                                    <p className="qd-field-label mb-1 flex items-center gap-2 text-slate-500">
                                        <span className="h-2 w-2 rounded-full bg-red-600" />
                                        Переходное сопоставление
                                        <span className="ml-auto tabular-nums">{(unknowns.transitional_mappings ?? []).length}</span>
                                    </p>
                                    <div>
                                        {(unknowns.transitional_mappings ?? []).slice(0, 8).map((item) => (
                                            <div key={item.id} className="border-b border-slate-200 py-1.5 text-sm last:border-0">
                                                <div className="font-medium text-slate-900">{item.name}</div>
                                                {item.metadata?.legacy_mapping_from ? (
                                                    <div className="text-xs text-slate-500">legacy: {item.metadata.legacy_mapping_from}</div>
                                                ) : null}
                                                {item.metadata?.note ? (
                                                    <div className="text-xs text-red-700">{item.metadata.note}</div>
                                                ) : null}
                                            </div>
                                        ))}
                                        {(unknowns.transitional_mappings ?? []).length === 0 ? (
                                            <p className="text-sm text-slate-500">Нет переходных сопоставлений.</p>
                                        ) : null}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />Каталог (плоский вид)</CardTitle>
                        <span className="text-xs font-medium tabular-nums text-slate-500">{(pagination.total ?? units.length).toLocaleString('ru-RU')} записей</span>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[960px] text-sm">
                                <thead className="text-left">
                                    <tr>
                                        <th>Орг-юнит</th>
                                        <th>Тип</th>
                                        <th>Родитель</th>
                                        <th>Код</th>
                                        <th>Руководитель</th>
                                        <th>Статус</th>
                                        {canManageFoundation && <th className="text-right">Действия</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {units.map((item) => (
                                        <tr key={item.id} className="align-top hover:bg-slate-50">
                                            <td>
                                                <div className="font-medium text-slate-900">{item.name}</div>
                                                <div className="text-xs tabular-nums text-slate-500">ID: {item.id}{item.children_count != null ? ` · дочерних: ${item.children_count}` : ''}</div>
                                            </td>
                                            <td>
                                                <TypeBadge label={item.unit_type_label} />
                                            </td>
                                            <td className="text-slate-600">
                                                {item.parent_id ? (
                                                    <>
                                                        {unitNames.get(item.parent_id) ?? <span className="tabular-nums">ID {item.parent_id}</span>}
                                                        {unitNames.has(item.parent_id) ? <div className="text-xs tabular-nums text-slate-400">ID {item.parent_id}</div> : null}
                                                    </>
                                                ) : 'Корень'}
                                            </td>
                                            <td className="font-mono text-xs text-slate-700">{item.code}</td>
                                            <td>
                                                {item.leader_name ? (
                                                    <div>
                                                        <div className="font-medium text-slate-900">{item.leader_name}</div>
                                                        <div className="text-xs text-slate-500">{item.leader_title ?? '—'}</div>
                                                    </div>
                                                ) : (
                                                    <Badge variant="warning">Не назначен</Badge>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.metadata?.transitional_mapping ? (
                                                        <Badge variant="destructive">Переходной</Badge>
                                                    ) : (
                                                        <Badge variant="success">Базовый</Badge>
                                                    )}
                                                    {!item.is_active ? (
                                                        <Badge variant="outline">Неактивен</Badge>
                                                    ) : null}
                                                </div>
                                            </td>
                                            {canManageFoundation && (
                                                <td className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)} title="Редактировать">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(item)} title="Удалить">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {units.length === 0 ? (
                                        <tr>
                                            <td className="text-center text-sm text-slate-500" colSpan={canManageFoundation ? 7 : 6}>Нет записей по текущим фильтрам.</td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 sm:px-6">
                            <div className="text-xs font-medium tabular-nums text-slate-500">
                                Показано {pagination.from ?? 0}–{pagination.to ?? 0} из {pagination.total ?? 0}
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="qd-field-label whitespace-nowrap text-slate-500">На странице</span>
                                <select
                                    className={`${qdFieldClass} h-8 w-auto px-2 text-xs`}
                                    value={form.per_page}
                                    onChange={(e) => updateFilters({ per_page: Number(e.target.value) })}
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>

                                <Button type="button" size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="whitespace-nowrap text-sm tabular-nums text-slate-600">{currentPage} / {lastPage}</span>
                                <Button type="button" size="sm" variant="outline" disabled={currentPage >= lastPage} onClick={() => goToPage(currentPage + 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Create Dialog ───────────────────────────────────────────── */}
            {canManageFoundation && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Создать орг. единицу</DialogTitle>
                            <DialogDescription>Заполните поля для новой организационной единицы.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitCreate} className="space-y-3 py-2">
                            <OrgUnitFormFields form={createForm} typeOptions={typeOptions} units={units} />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                <Button type="submit" disabled={createForm.processing}>Создать</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Edit Dialog ─────────────────────────────────────────────── */}
            {canManageFoundation && editTarget && (
                <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Редактировать орг. единицу</DialogTitle>
                            <DialogDescription>{editTarget.name}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitEdit} className="space-y-3 py-2">
                            <OrgUnitFormFields form={editForm} typeOptions={typeOptions} units={units} excludeId={editTarget.id} />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Отмена</Button>
                                <Button type="submit" disabled={editForm.processing}>Сохранить</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Delete Dialog ───────────────────────────────────────────── */}
            {canManageFoundation && deleteTarget && (
                <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Удалить орг. единицу?</DialogTitle>
                            <DialogDescription>
                                Единица «{deleteTarget.name}» будет удалена. Нельзя удалить единицу с дочерними подразделениями.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
                            <Button variant="destructive" onClick={submitDelete}>Удалить</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </AuthenticatedLayout>
    );
}

function OrgUnitFormFields({ form, typeOptions, units, excludeId }) {
    const availableParents = (units ?? []).filter((u) => u.id !== excludeId);
    return (
        <>
            <div>
                <label className="qd-field-label mb-2 block">Название *</label>
                <input
                    className={qdFieldClass}
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    required
                />
                {form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className="qd-field-label mb-2 block">Код</label>
                    <input
                        className={qdFieldClass}
                        value={form.data.code}
                        onChange={(e) => form.setData('code', e.target.value)}
                    />
                </div>
                <div>
                    <label className="qd-field-label mb-2 block">Тип</label>
                    <select
                        className={qdFieldClass}
                        value={form.data.unit_type}
                        onChange={(e) => form.setData('unit_type', e.target.value)}
                    >
                        {typeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
            </div>
            <div>
                <label className="qd-field-label mb-2 block">Родительская единица</label>
                <select
                    className={qdFieldClass}
                    value={form.data.parent_id}
                    onChange={(e) => form.setData('parent_id', e.target.value)}
                >
                    <option value="">— Корневая единица —</option>
                    {availableParents.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </div>
            <div>
                <label className="qd-field-label mb-2 block">Руководитель (ФИО)</label>
                <input
                    className={qdFieldClass}
                    value={form.data.leader_name}
                    onChange={(e) => form.setData('leader_name', e.target.value)}
                    placeholder="Введите ФИО руководителя"
                />
            </div>
            <div className="flex items-center gap-2">
                <input
                    id="is_active"
                    type="checkbox"
                    checked={form.data.is_active}
                    onChange={(e) => form.setData('is_active', e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700">Активна</label>
            </div>
        </>
    );
}

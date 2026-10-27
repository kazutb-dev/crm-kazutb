import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, FilterBar, FormField, StatusBadge, qdFieldClass } from '@/components/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { router, useForm } from '@inertiajs/react';
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const entityLabels = {
    teacher: 'ППС',
    department_head: 'Зав. кафедрой',
    dean: 'Декан',
};

const sectionLabels = {
    teaching: 'Учебно-методическая работа',
    science: 'Научно-исследовательская работа',
    social: 'Социально-воспитательная работа',
    qualification: 'Уровень профессиональной квалификации',
    survey: 'Анкетирование',
};

const calculationLabels = {
    manual: 'Ручной',
    auto: 'Авто',
    formula: 'Формула',
};

const defaultForm = {
    entity_type: 'teacher',
    section: 'teaching',
    block_code: '',
    indicator_code: '',
    code: '',
    name: '',
    description: '',
    unit: '',
    base_points: '0',
    calculation_type: 'manual',
    requires_file: false,
    is_active: true,
    sort_order: 0,
    checker_structural_unit_id: '',
    checker_structural_unit_ids: [],
    scoring_rules: '',
};

function composeIndicatorCode(blockCode, indicatorCode) {
    const left = String(blockCode ?? '').trim();
    const right = String(indicatorCode ?? '').trim();

    if (!left) {
        return right;
    }

    if (!right) {
        return left;
    }

    return `${left}.${right}`;
}

function splitIndicatorCode(code) {
    const value = String(code ?? '').trim();

    if (!value) {
        return { block_code: '', indicator_code: '' };
    }

    const lastDotIndex = value.lastIndexOf('.');
    if (lastDotIndex === -1) {
        return { block_code: '', indicator_code: value };
    }

    return {
        block_code: value.slice(0, lastDotIndex),
        indicator_code: value.slice(lastDotIndex + 1),
    };
}

function IndicatorForm({ form, options, onSubmit, submitLabel }) {
    const [checkerSearch, setCheckerSearch] = useState('');
    const divisions = options.divisions ?? [];
    const filteredDivisions = checkerSearch.trim() === ''
        ? divisions
        : divisions.filter((div) => String(div.name ?? '').toLowerCase().includes(checkerSearch.trim().toLowerCase()));
    const selectedCheckerUnitIds = Array.isArray(form.data.checker_structural_unit_ids)
        ? form.data.checker_structural_unit_ids.map((id) => String(id))
        : [];

    const toggleCheckerUnit = (unitId, checked) => {
        const normalizedId = String(unitId);
        const next = checked
            ? [...new Set([...selectedCheckerUnitIds, normalizedId])]
            : selectedCheckerUnitIds.filter((id) => id !== normalizedId);

        form.setData((data) => ({
            ...data,
            checker_structural_unit_ids: next,
            checker_structural_unit_id: next[0] ?? '',
        }));
    };

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <label className="qd-field-label block">Структурное подразделение (кто будет проверять)</label>
                    <Input value={checkerSearch} onChange={(e) => setCheckerSearch(e.target.value)} placeholder="Поиск подразделения" />
                    <div className="max-h-44 overflow-y-auto rounded-[10px] border border-slate-300 bg-white">
                        {filteredDivisions.length === 0 ? (
                            <p className="px-3 py-2.5 text-sm text-slate-500">Подразделения не найдены.</p>
                        ) : (
                            filteredDivisions.map((div) => {
                                const divisionId = String(div.id);
                                const label = div.code ? `${div.code} — ${div.name}` : div.name;

                                return (
                                    <label key={div.id} className="flex cursor-pointer items-center gap-2.5 border-b border-slate-200 px-3 py-2 text-sm text-slate-800 last:border-0 hover:bg-teal-50/60">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 accent-teal-700"
                                            checked={selectedCheckerUnitIds.includes(divisionId)}
                                            onChange={(e) => toggleCheckerUnit(divisionId, e.target.checked)}
                                        />
                                        <span>{label}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                    <p className="text-xs text-slate-500">Можно выбрать одно или несколько подразделений. Выбрано: {selectedCheckerUnitIds.length}</p>
                    {form.errors.checker_structural_unit_id && <p className="text-sm text-red-700">{form.errors.checker_structural_unit_id}</p>}
                    {form.errors.checker_structural_unit_ids && <p className="text-sm text-red-700">{form.errors.checker_structural_unit_ids}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Уровень</label>
                    <select className={qdFieldClass} value={form.data.entity_type} onChange={(e) => form.setData('entity_type', e.target.value)}>
                        {(options.entityTypes ?? []).map((item) => (
                            <option key={item} value={item}>{entityLabels[item] ?? item}</option>
                        ))}
                    </select>
                    {form.errors.entity_type && <p className="text-sm text-red-700">{form.errors.entity_type}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Секция</label>
                    <select className={qdFieldClass} value={form.data.section} onChange={(e) => form.setData('section', e.target.value)}>
                        {(options.sections ?? []).map((item) => (
                            <option key={item} value={item}>{sectionLabels[item] ?? item}</option>
                        ))}
                    </select>
                    {form.errors.section && <p className="text-sm text-red-700">{form.errors.section}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Код блока</label>
                    <Input
                        value={form.data.block_code ?? ''}
                        onChange={(e) => {
                            const blockCode = e.target.value;
                            const code = composeIndicatorCode(blockCode, form.data.indicator_code);
                            form.setData((data) => ({ ...data, block_code: blockCode, code }));
                            form.clearErrors('code');
                        }}
                        placeholder="1.1"
                    />
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Код показателя</label>
                    <Input
                        value={form.data.indicator_code ?? ''}
                        onChange={(e) => {
                            const indicatorCode = e.target.value;
                            const code = composeIndicatorCode(form.data.block_code, indicatorCode);
                            form.setData((data) => ({ ...data, indicator_code: indicatorCode, code }));
                            form.clearErrors('code');
                        }}
                        placeholder="01"
                    />
                    {form.errors.code && <p className="text-sm text-red-700">{form.errors.code}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Название</label>
                    <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Публикации" />
                    {form.errors.name && <p className="text-sm text-red-700">{form.errors.name}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Единица измерения</label>
                    <Input value={form.data.unit} onChange={(e) => form.setData('unit', e.target.value)} placeholder="шт" />
                    {form.errors.unit && <p className="text-sm text-red-700">{form.errors.unit}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Базовые баллы</label>
                    <Input type="number" step="0.01" min="0" value={form.data.base_points} onChange={(e) => form.setData('base_points', e.target.value)} />
                    {form.errors.base_points && <p className="text-sm text-red-700">{form.errors.base_points}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Тип расчета</label>
                    <select className={qdFieldClass} value={form.data.calculation_type} onChange={(e) => form.setData('calculation_type', e.target.value)}>
                        {(options.calculationTypes ?? []).map((item) => (
                            <option key={item} value={item}>{calculationLabels[item] ?? item}</option>
                        ))}
                    </select>
                    {form.errors.calculation_type && <p className="text-sm text-red-700">{form.errors.calculation_type}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Порядок сортировки</label>
                    <Input type="number" min="0" value={form.data.sort_order} onChange={(e) => form.setData('sort_order', e.target.value)} />
                    {form.errors.sort_order && <p className="text-sm text-red-700">{form.errors.sort_order}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <label className="qd-field-label block">Описание</label>
                <textarea className={`${qdFieldClass} h-auto min-h-24 py-2`} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} placeholder="Описание KPI-индикатора" />
                {form.errors.description && <p className="text-sm text-red-700">{form.errors.description}</p>}
            </div>

            <div className="space-y-2">
                <label className="qd-field-label block">Правила начисления баллов</label>
                <textarea className={`${qdFieldClass} h-auto min-h-20 py-2`} value={form.data.scoring_rules || ''} onChange={(e) => form.setData('scoring_rules', e.target.value)} placeholder={'1 место - 70 б.\n2 место - 50 б.\n3 место - 30 б.'} />
                {form.errors.scoring_rules && <p className="text-sm text-red-700">{form.errors.scoring_rules}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 hover:border-slate-300">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-teal-700" checked={Boolean(form.data.requires_file)} onChange={(e) => form.setData('requires_file', e.target.checked)} />
                    Требуется файл-подтверждение
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 hover:border-slate-300">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-teal-700" checked={Boolean(form.data.is_active)} onChange={(e) => form.setData('is_active', e.target.checked)} />
                    Активен
                </label>
            </div>

            <DialogFooter>
                <Button type="submit" disabled={form.processing}>{submitLabel}</Button>
            </DialogFooter>
        </form>
    );
}

export default function KpiIndicatorsManager({ indicators, filters = {}, options = {}, permissions = {}, filterRouteName = 'kpi.settings', filterRouteParams = {} }) {
    const items = indicators?.data ?? [];
    const links = indicators?.links ?? [];
    const canManage = permissions.canManage ?? false;
    const totalCount = indicators?.total ?? indicators?.meta?.total ?? items.length;
    const fromIndex = indicators?.from ?? indicators?.meta?.from ?? null;
    const toIndex = indicators?.to ?? indicators?.meta?.to ?? null;
    const activeOnPage = items.filter((item) => item.is_active).length;
    const fileOnPage = items.filter((item) => item.requires_file).length;
    const entityCounts = items.reduce((acc, item) => {
        acc[item.entity_type] = (acc[item.entity_type] ?? 0) + 1;
        return acc;
    }, {});

    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingIndicator, setEditingIndicator] = useState(null);
    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });

    const filterForm = useForm({
        entity_type: filters.entity_type ?? '',
        is_active: filters.is_active ?? '',
    });

    const createForm = useForm(defaultForm);
    const editForm = useForm(defaultForm);

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route(filterRouteName), {
            ...filterRouteParams,
            indicator_entity_type: filterForm.data.entity_type || undefined,
            indicator_is_active: filterForm.data.is_active || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({ entity_type: '', is_active: '' });

        router.get(route(filterRouteName), { ...filterRouteParams }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (event) => {
        event.preventDefault();

        const composedCode = composeIndicatorCode(createForm.data.block_code, createForm.data.indicator_code);
        createForm.transform((data) => {
            const normalizedUnitIds = (Array.isArray(data.checker_structural_unit_ids) ? data.checker_structural_unit_ids : [])
                .map((id) => String(id))
                .filter((id) => id !== '');

            return {
                ...data,
                code: composedCode,
                checker_structural_unit_ids: normalizedUnitIds,
                checker_structural_unit_id: normalizedUnitIds[0] ?? null,
            };
        });
        createForm.post(route('kpi.indicators.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset(defaultForm);
                setCreateOpen(false);
            },
            onFinish: () => {
                createForm.transform((data) => data);
            },
        });
    };

    const openEditDialog = (indicator) => {
        setEditingIndicator(indicator);
        const splitCode = splitIndicatorCode(indicator.code);
        editForm.setData({
            entity_type: indicator.entity_type,
            section: indicator.section,
            block_code: splitCode.block_code,
            indicator_code: splitCode.indicator_code,
            code: indicator.code,
            name: indicator.name,
            description: indicator.description ?? '',
            unit: indicator.unit ?? '',
            base_points: indicator.base_points ?? '0',
            calculation_type: indicator.calculation_type,
            requires_file: Boolean(indicator.requires_file),
            is_active: Boolean(indicator.is_active),
            sort_order: indicator.sort_order ?? 0,
            checker_structural_unit_id: indicator.checker_structural_unit_id ? String(indicator.checker_structural_unit_id) : '',
            checker_structural_unit_ids: Array.isArray(indicator.structural_units) && indicator.structural_units.length > 0
                ? indicator.structural_units
                    .map((unit) => unit?.id)
                    .filter((id) => id !== null && id !== undefined)
                    .map((id) => String(id))
                : (indicator.checker_structural_unit_id ? [String(indicator.checker_structural_unit_id)] : []),
            scoring_rules: indicator.scoring_rules ?? '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitEdit = (event) => {
        event.preventDefault();

        if (!editingIndicator) {
            return;
        }

        const composedCode = composeIndicatorCode(editForm.data.block_code, editForm.data.indicator_code);
        editForm.transform((data) => {
            const normalizedUnitIds = (Array.isArray(data.checker_structural_unit_ids) ? data.checker_structural_unit_ids : [])
                .map((id) => String(id))
                .filter((id) => id !== '');

            return {
                ...data,
                code: composedCode,
                checker_structural_unit_ids: normalizedUnitIds,
                checker_structural_unit_id: normalizedUnitIds[0] ?? null,
            };
        });
        editForm.post(route('kpi.indicators.update.post', editingIndicator.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditingIndicator(null);
                setEditOpen(false);
                router.reload({ only: ['indicators'], preserveScroll: true });
            },
            onFinish: () => {
                editForm.transform((data) => data);
            },
        });
    };

    const handleDelete = (indicator) => {
        setConfirmState({
            open: true,
            description: `Удалить KPI-индикатор "${indicator.name}"?`,
            onConfirm: () => router.delete(route('kpi.indicators.destroy', indicator.id), { preserveScroll: true }),
        });
    };

    const createDialog = canManage ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4" />
                    Добавить KPI-индикатор
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Новый KPI-индикатор</DialogTitle>
                    <DialogDescription>Заполните справочник индикатора для нужного уровня.</DialogDescription>
                </DialogHeader>
                <IndicatorForm form={createForm} options={options} onSubmit={submitCreate} submitLabel="Сохранить" />
            </DialogContent>
        </Dialog>
    ) : null;

    return (
        <>
        <div className="space-y-4">
            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingIndicator(null);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Редактирование KPI-индикатора</DialogTitle>
                        <DialogDescription>Обновите параметры индикатора и сохраните изменения.</DialogDescription>
                    </DialogHeader>
                    <IndicatorForm form={editForm} options={options} onSubmit={submitEdit} submitLabel="Сохранить изменения" />
                </DialogContent>
            </Dialog>

            <FilterBar>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <form onSubmit={applyFilters} className="min-w-0 flex-1">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                        <FormField label="Уровень">
                            <select className={qdFieldClass} value={filterForm.data.entity_type} onChange={(e) => filterForm.setData('entity_type', e.target.value)}>
                                <option value="">Все</option>
                                {(options.entityTypes ?? []).map((item) => (
                                    <option key={item} value={item}>{entityLabels[item] ?? item}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Статус">
                            <select className={qdFieldClass} value={filterForm.data.is_active} onChange={(e) => filterForm.setData('is_active', e.target.value)}>
                                <option value="">Все</option>
                                <option value="1">Активные</option>
                                <option value="0">Неактивные</option>
                            </select>
                        </FormField>

                        <div className="flex flex-wrap justify-end gap-2 md:col-span-2 xl:col-span-1">
                            <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            <Button type="submit">Применить</Button>
                        </div>
                    </div>
                </form>
                {/* Kept outside the filter <form>: React submit events bubble through portals. */}
                {createDialog ? (
                    <div className="flex justify-end border-slate-200 xl:h-10 xl:items-center xl:border-l xl:pl-3">
                        {createDialog}
                    </div>
                ) : null}
                </div>
            </FilterBar>

            {items.length === 0 ? (
                <EmptyState
                    title="Индикаторы не найдены"
                    description="Измените фильтры или добавьте первую запись."
                    action={canManage ? (
                        <Button type="button" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Добавить KPI-индикатор
                        </Button>
                    ) : null}
                />
            ) : (
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4" />
                            Справочник KPI-индикаторов
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>Всего: <strong className="tabular-nums text-[#102945]">{totalCount}</strong></span>
                            <span className="text-slate-300">·</span>
                            <span>На странице активных: <strong className="tabular-nums text-emerald-700">{activeOnPage}</strong> из {items.length}</span>
                            <span className="text-slate-300">·</span>
                            <span>С файлом: <strong className="tabular-nums text-[#102945]">{fileOnPage}</strong></span>
                            {Object.entries(entityCounts).map(([type, count]) => (
                                <StatusBadge key={type} tone="default">{entityLabels[type] ?? type}: {count}</StatusBadge>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1200px] text-sm">
                                <thead className="border-b border-slate-200">
                                    <tr className="text-left">
                                        <th>Уровень</th>
                                        <th>Секция</th>
                                        <th>Проверяющее подразделение</th>
                                        <th>Код</th>
                                        <th>Название</th>
                                        <th className="text-right">Баллы</th>
                                        <th>Правила баллов</th>
                                        <th>Описание</th>
                                        <th>Статус</th>
                                        <th className="text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((indicator) => (
                                        <tr key={indicator.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50/60">
                                            <td><Badge variant="outline">{entityLabels[indicator.entity_type] ?? indicator.entity_type}</Badge></td>
                                            <td className="text-slate-700">{sectionLabels[indicator.section] ?? indicator.section}</td>
                                            <td className="text-slate-700">
                                                {Array.isArray(indicator.structural_units) && indicator.structural_units.length > 0
                                                    ? indicator.structural_units
                                                        .map((unit) => unit?.name)
                                                        .filter(Boolean)
                                                        .join(', ')
                                                    : (indicator.checker_structural_unit?.name
                                                        ?? options.divisions?.find((div) => String(div.id) === String(indicator.checker_structural_unit_id))?.name
                                                        ?? 'Не указано')}
                                            </td>
                                            <td className="whitespace-nowrap font-mono text-xs text-slate-600">{indicator.code}</td>
                                            <td>
                                                <div className="font-medium text-slate-900">{indicator.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {indicator.unit || 'без единиц'}
                                                    {indicator.calculation_type ? ` · ${calculationLabels[indicator.calculation_type] ?? indicator.calculation_type}` : ''}
                                                    {indicator.requires_file ? ' · нужен файл' : ''}
                                                </div>
                                            </td>
                                            <td className="text-right font-semibold tabular-nums text-[#102945]">{indicator.base_points}</td>
                                            <td className="max-w-[180px] whitespace-pre-line text-slate-500">{indicator.scoring_rules}</td>
                                            <td className="text-slate-600">{indicator.description || '—'}</td>
                                            <td>{indicator.is_active ? <StatusBadge tone="success">Активен</StatusBadge> : <StatusBadge tone="default">Неактивен</StatusBadge>}</td>
                                            <td className="text-right">
                                                <div className="flex flex-nowrap justify-end gap-2">
                                                    {canManage && (
                                                        <>
                                                            <Button size="sm" variant="outline" onClick={() => openEditDialog(indicator)}>
                                                                <Pencil className="h-4 w-4" />
                                                                Редактировать
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(indicator)}>
                                                                <Trash2 className="h-4 w-4" />
                                                                Удалить
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {(links.length > 3 || (fromIndex && toIndex)) && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 sm:px-6">
                                <span className="text-xs text-slate-500">
                                    {fromIndex && toIndex ? <>Показано {fromIndex}–{toIndex} из {totalCount}</> : null}
                                </span>
                                {links.length > 3 && (
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {links.map((link) => (
                                            <Button
                                                key={`${link.url}-${link.label}`}
                                                type="button"
                                                variant={link.active ? 'default' : 'outline'}
                                                size="sm"
                                                disabled={!link.url}
                                                onClick={() => link.url && router.visit(link.url, { preserveScroll: true, preserveState: true })}
                                            >
                                                <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => !open && setConfirmState({ open: false, description: '', onConfirm: null })}
            description={confirmState.description}
            onConfirm={() => {
                confirmState.onConfirm?.();
                setConfirmState({ open: false, description: '', onConfirm: null });
            }}
        />
        </>
    );
}

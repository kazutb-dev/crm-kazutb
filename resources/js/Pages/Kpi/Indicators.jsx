import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
    code: '',
    name: '',
    description: '',
    unit: '',
    base_points: '0',
    calculation_type: 'manual',
    requires_file: false,
    is_active: true,
    sort_order: 0,
    checker_division_id: '',
};

function IndicatorForm({ form, options, onSubmit, submitLabel }) {
    // Для поиска по департаментам
    const [checkerSearch, setCheckerSearch] = useState('');
    const divisions = options.divisions ?? [];
    const filteredDivisions = checkerSearch.trim() === ''
        ? divisions
        : divisions.filter((div) =>
            String(div.name ?? '').toLowerCase().includes(checkerSearch.trim().toLowerCase())
        );

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
                                {/* Департамент (кто будет проверять) */}
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="text-sm font-medium">Департамент (кто будет проверять)</label>
                                    <Input
                                        value={checkerSearch}
                                        onChange={e => setCheckerSearch(e.target.value)}
                                        placeholder="Поиск департамента"
                                    />
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                        value={form.data.checker_division_id}
                                        onChange={e => form.setData('checker_division_id', e.target.value)}
                                    >
                                        <option value="">Выберите департамент</option>
                                        {filteredDivisions.map((div) => (
                                            <option key={div.id} value={div.id}>{div.name}</option>
                                        ))}
                                    </select>
                                    {form.errors.checker_division_id && <p className="text-sm text-destructive">{form.errors.checker_division_id}</p>}
                                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Уровень</label>
                    <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                        value={form.data.entity_type}
                        onChange={(event) => form.setData('entity_type', event.target.value)}
                    >
                        {(options.entityTypes ?? []).map((item) => (
                            <option key={item} value={item}>{entityLabels[item] ?? item}</option>
                        ))}
                    </select>
                    {form.errors.entity_type && <p className="text-sm text-destructive">{form.errors.entity_type}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Секция</label>
                    <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                        value={form.data.section}
                        onChange={(event) => form.setData('section', event.target.value)}
                    >
                        {(options.sections ?? []).map((item) => (
                            <option key={item} value={item}>{sectionLabels[item] ?? item}</option>
                        ))}
                    </select>
                    {form.errors.section && <p className="text-sm text-destructive">{form.errors.section}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Код</label>
                    <Input
                        value={form.data.code}
                        onChange={(event) => {
                            form.setData('code', event.target.value);
                            form.clearErrors('code');
                        }}
                        placeholder="T-001"
                    />
                    {form.errors.code && <p className="text-sm text-destructive">{form.errors.code}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Название</label>
                    <Input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Публикации" />
                    {form.errors.name && <p className="text-sm text-destructive">{form.errors.name}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Единица измерения</label>
                    <Input value={form.data.unit} onChange={(event) => form.setData('unit', event.target.value)} placeholder="шт" />
                    {form.errors.unit && <p className="text-sm text-destructive">{form.errors.unit}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Базовые баллы</label>
                    <Input type="number" step="0.01" min="0" value={form.data.base_points} onChange={(event) => form.setData('base_points', event.target.value)} />
                    {form.errors.base_points && <p className="text-sm text-destructive">{form.errors.base_points}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Тип расчета</label>
                    <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                        value={form.data.calculation_type}
                        onChange={(event) => form.setData('calculation_type', event.target.value)}
                    >
                        {(options.calculationTypes ?? []).map((item) => (
                            <option key={item} value={item}>{calculationLabels[item] ?? item}</option>
                        ))}
                    </select>
                    {form.errors.calculation_type && <p className="text-sm text-destructive">{form.errors.calculation_type}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Порядок сортировки</label>
                    <Input type="number" min="0" value={form.data.sort_order} onChange={(event) => form.setData('sort_order', event.target.value)} />
                    {form.errors.sort_order && <p className="text-sm text-destructive">{form.errors.sort_order}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Описание</label>
                <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={form.data.description}
                    onChange={(event) => form.setData('description', event.target.value)}
                    placeholder="Описание KPI-индикатора"
                />
                {form.errors.description && <p className="text-sm text-destructive">{form.errors.description}</p>}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={Boolean(form.data.requires_file)}
                        onChange={(event) => form.setData('requires_file', event.target.checked)}
                    />
                    Требуется файл-подтверждение
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={Boolean(form.data.is_active)}
                        onChange={(event) => form.setData('is_active', event.target.checked)}
                    />
                    Активен
                </label>
            </div>

            <DialogFooter>
                <Button type="submit" disabled={form.processing}>{submitLabel}</Button>
            </DialogFooter>
        </form>
    );
}

export default function Indicators({ indicators, filters = {}, options = {}, permissions = {} }) {
    const items = indicators?.data ?? [];
    const links = indicators?.links ?? [];
    const canManage = permissions.canManage ?? false;

    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingIndicator, setEditingIndicator] = useState(null);

    const filterForm = useForm({
        entity_type: filters.entity_type ?? '',
        is_active: filters.is_active ?? '',
    });

    const createForm = useForm(defaultForm);
    const editForm = useForm(defaultForm);

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route('kpi.indicators.index'), {
            entity_type: filterForm.data.entity_type || undefined,
            is_active: filterForm.data.is_active || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({ entity_type: '', is_active: '' });

        router.get(route('kpi.indicators.index'), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (event) => {
        event.preventDefault();

        createForm.post(route('kpi.indicators.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset(defaultForm);
                setCreateOpen(false);
            },
        });
    };

    const openEditDialog = (indicator) => {
        setEditingIndicator(indicator);
        editForm.setData({
            entity_type: indicator.entity_type,
            section: indicator.section,
            code: indicator.code,
            name: indicator.name,
            description: indicator.description ?? '',
            unit: indicator.unit ?? '',
            base_points: indicator.base_points ?? '0',
            calculation_type: indicator.calculation_type,
            requires_file: Boolean(indicator.requires_file),
            is_active: Boolean(indicator.is_active),
            sort_order: indicator.sort_order ?? 0,
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitEdit = (event) => {
        event.preventDefault();

        if (!editingIndicator) {
            return;
        }

        editForm.patch(route('kpi.indicators.update', editingIndicator.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditingIndicator(null);
                setEditOpen(false);
            },
        });
    };

    const handleDelete = (indicator) => {
        if (!window.confirm(`Удалить KPI-индикатор "${indicator.name}"?`)) {
            return;
        }

        router.delete(route('kpi.indicators.destroy', indicator.id), {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            headerRight={
                canManage ? (
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus />
                                Добавить KPI-индикатор
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Новый KPI-индикатор</DialogTitle>
                                <DialogDescription>
                                    Заполните справочник индикатора для нужного уровня (ППС/зав. кафедрой/декан).
                                </DialogDescription>
                            </DialogHeader>

                            <IndicatorForm
                                form={createForm}
                                options={options}
                                onSubmit={submitCreate}
                                submitLabel="Сохранить"
                            />
                        </DialogContent>
                    </Dialog>
                ) : null
            }
        >
            <Head title="KPI-индикаторы" />

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
                        <DialogDescription>
                            Обновите параметры индикатора и сохраните изменения.
                        </DialogDescription>
                    </DialogHeader>

                    <IndicatorForm
                        form={editForm}
                        options={options}
                        onSubmit={submitEdit}
                        submitLabel="Сохранить изменения"
                    />
                </DialogContent>
            </Dialog>

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Фильтры KPI-индикаторов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="flex flex-wrap items-end gap-3" onSubmit={applyFilters}>
                            <div className="min-w-[220px] space-y-2">
                                <label className="text-sm font-medium">Уровень</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={filterForm.data.entity_type}
                                    onChange={(event) => filterForm.setData('entity_type', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    {(options.entityTypes ?? []).map((item) => (
                                        <option key={item} value={item}>{entityLabels[item] ?? item}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="min-w-[220px] space-y-2">
                                <label className="text-sm font-medium">Статус</label>
                                <select
                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                                    value={filterForm.data.is_active}
                                    onChange={(event) => filterForm.setData('is_active', event.target.value)}
                                >
                                    <option value="">Все</option>
                                    <option value="1">Активные</option>
                                    <option value="0">Неактивные</option>
                                </select>
                            </div>

                            <Button type="submit">Применить</Button>
                            <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Справочник KPI-индикаторов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Индикаторы не найдены. Добавьте первую запись.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1200px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">Уровень</th>
                                            <th className="py-3 pe-3 font-medium">Секция</th>
                                            <th className="py-3 pe-3 font-medium">Код</th>
                                            <th className="py-3 pe-3 font-medium">Название</th>
                                            <th className="py-3 pe-3 font-medium">Баллы</th>
                                            <th className="py-3 pe-3 font-medium">Тип расчета</th>
                                            <th className="py-3 pe-3 font-medium">Файл</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
                                            <th className="py-3 text-right font-medium">Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((indicator) => (
                                            <tr key={indicator.id} className="border-b align-top last:border-0">
                                                <td className="py-3 pe-3"><Badge variant="outline">{entityLabels[indicator.entity_type] ?? indicator.entity_type}</Badge></td>
                                                <td className="py-3 pe-3">{sectionLabels[indicator.section] ?? indicator.section}</td>
                                                <td className="py-3 pe-3 font-mono">{indicator.code}</td>
                                                <td className="py-3 pe-3">
                                                    <div className="font-medium">{indicator.name}</div>
                                                    <div className="text-xs text-muted-foreground">{indicator.unit || 'без единиц'}</div>
                                                </td>
                                                <td className="py-3 pe-3">{indicator.base_points}</td>
                                                <td className="py-3 pe-3">{calculationLabels[indicator.calculation_type] ?? indicator.calculation_type}</td>
                                                <td className="py-3 pe-3">{indicator.requires_file ? 'Да' : 'Нет'}</td>
                                                <td className="py-3 pe-3">
                                                    {indicator.is_active ? <Badge>Активен</Badge> : <Badge variant="outline">Неактивен</Badge>}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {canManage && (
                                                            <>
                                                                <Button size="sm" variant="outline" onClick={() => openEditDialog(indicator)}>
                                                                    <Pencil />
                                                                    Редактировать
                                                                </Button>
                                                                <Button size="sm" variant="destructive" onClick={() => handleDelete(indicator)}>
                                                                    <Trash2 />
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
                        )}

                        {links.length > 3 && (
                            <div className="mt-6 flex flex-wrap gap-2">
                                {links.map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        asChild={Boolean(link.url)}
                                    >
                                        {link.url ? (
                                            <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : (
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
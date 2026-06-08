import { ConfirmDialog } from '@/components/ConfirmDialog';
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
import { CircleOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

const statusLabels = {
    draft: 'Неактивен',
    active: 'Активный',
    closed: 'Закрыт',
};

const statusVariants = {
    draft: 'outline',
    active: 'default',
    closed: 'secondary',
};

const accessScopes = [
    { key: 'teacher', label: 'ППС', field: 'is_teacher_active' },
    { key: 'hod', label: 'Зав.каф.', field: 'is_hod_active' },
    { key: 'dean', label: 'Декан', field: 'is_dean_active' },
    { key: 'structural', label: 'Структурные', field: 'is_structural_active' },
];

const emptyForm = {
    academic_year_id: '',
    name: '',
    stage: 'fact',
    start_date: '',
    end_date: '',
    status: 'draft',
    description: '',
};

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

function validateForm(data) {
    const errors = {};

    if (!data.academic_year_id) {
        errors.academic_year_id = 'Выберите учебный год.';
    }

    if (!data.start_date) {
        errors.start_date = 'Укажите дату начала.';
    }

    if (!data.end_date) {
        errors.end_date = 'Укажите дату окончания.';
    }

    if (data.start_date && data.end_date && data.end_date < data.start_date) {
        errors.end_date = 'Дата окончания не может быть раньше даты начала.';
    }

    return errors;
}

function PeriodForm({ form, academicYears, statusOptions, submitLabel, onSubmit }) {
    const clientErrors = useMemo(() => validateForm(form.data), [form.data]);
    const isSubmitDisabled = form.processing || Object.keys(clientErrors).length > 0;
    const errorFor = (field) => clientErrors[field] ?? form.errors[field];

    const handleAcademicYearChange = (value) => {
        const selected = academicYears.find((y) => String(y.id) === String(value));
        form.setData('academic_year_id', value);
        if (selected) {
            form.setData('start_date', `${selected.start_year}-09-01`);
            form.setData('end_date', `${selected.end_year}-06-30`);
        }
    };

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Учебный год (сезон)</label>
                    <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={form.data.academic_year_id}
                        onChange={(e) => handleAcademicYearChange(e.target.value)}
                    >
                        <option value="">Выберите учебный год</option>
                        {academicYears.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                    {errorFor('academic_year_id') && <p className="text-sm text-destructive">{errorFor('academic_year_id')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Статус</label>
                    <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={form.data.status}
                        onChange={(e) => form.setData('status', e.target.value)}
                    >
                        {statusOptions.map((option) => (
                            <option key={option} value={option}>{statusLabels[option] ?? option}</option>
                        ))}
                    </select>
                    {errorFor('status') && <p className="text-sm text-destructive">{errorFor('status')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Дата начала</label>
                    <Input type="date" value={form.data.start_date} onChange={(e) => form.setData('start_date', e.target.value)} />
                    {errorFor('start_date') && <p className="text-sm text-destructive">{errorFor('start_date')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Дата окончания</label>
                    <Input type="date" value={form.data.end_date} onChange={(e) => form.setData('end_date', e.target.value)} />
                    {errorFor('end_date') && <p className="text-sm text-destructive">{errorFor('end_date')}</p>}
                </div>
            </div>

            {form.data.academic_year_id && form.data.start_date && (
                <p className="text-xs text-muted-foreground">Даты установлены автоматически. При необходимости скорректируйте вручную.</p>
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium">Описание</label>
                <textarea
                    className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.data.description}
                    onChange={(e) => form.setData('description', e.target.value)}
                    placeholder="Краткое описание (необязательно)"
                />
            </div>

            <DialogFooter>
                <Button type="submit" disabled={isSubmitDisabled}>{submitLabel}</Button>
            </DialogFooter>
        </form>
    );
}

export default function KpiPeriodsManager({
    periods,
    academicYears = [],
    filters = {},
    statusOptions = ['draft', 'active', 'closed'],
    permissions = {},
    filterRouteName = 'kpi.settings',
    filterRouteParams = {},
}) {
    const items = periods?.data ?? [];
    const links = periods?.links ?? [];
    const canManage = permissions.managePeriods ?? false;

    const [confirmState, setConfirmState] = useState({ open: false, description: '', onConfirm: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState(null);

    const filterForm = useForm({
        academic_year_id: filters.academic_year_id ? String(filters.academic_year_id) : '',
        stage: filters.stage ?? '',
        status: filters.status ?? '',
    });

    const createForm = useForm(emptyForm);
    const editForm = useForm(emptyForm);

    const applyFilters = (event) => {
        event.preventDefault();

        router.get(route(filterRouteName), {
            ...filterRouteParams,
            academic_year_id: filterForm.data.academic_year_id || undefined,
            status: filterForm.data.status || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({ academic_year_id: '', stage: '', status: '' });

        router.get(route(filterRouteName), { ...filterRouteParams }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submitCreate = (event) => {
        event.preventDefault();

        createForm.post(route('kpi.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setCreateOpen(false);
            },
        });
    };

    const openEditDialog = (period) => {
        setEditingPeriod(period);
        editForm.setData({
            academic_year_id: period.academic_year_id ? String(period.academic_year_id) : '',
            name: '',
            stage: 'fact',
            start_date: period.start_date ?? '',
            end_date: period.end_date ?? '',
            status: period.status ?? 'draft',
            description: period.description ?? '',
        });
        editForm.clearErrors();
        setEditOpen(true);
    };

    const submitEdit = (event) => {
        event.preventDefault();

        if (!editingPeriod) {
            return;
        }

        editForm.patch(route('kpi.update', editingPeriod.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditOpen(false);
                setEditingPeriod(null);
            },
        });
    };

    const activatePeriod = (period) => router.post(route('kpi.activate', period.id), {}, { preserveScroll: true });
    const deactivatePeriod = (period) => router.post(route('kpi.deactivate', period.id), {}, { preserveScroll: true });
    const activateScope = (period, scope) => router.post(route('kpi.activate-scope', { period: period.id, scope }), {}, { preserveScroll: true });
    const deactivateScope = (period, scope) => router.post(route('kpi.deactivate-scope', { period: period.id, scope }), {}, { preserveScroll: true });
    const closePeriod = (period) => router.post(route('kpi.close', period.id), {}, { preserveScroll: true });

    const deletePeriod = (period) => {
        setConfirmState({
            open: true,
            description: `Удалить сезон "${period.name}"?`,
            onConfirm: () => router.delete(route('kpi.destroy', period.id), { preserveScroll: true }),
        });
    };

    return (
        <>
        <div className="space-y-6">
            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingPeriod(null);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Редактирование KPI-периода</DialogTitle>
                        <DialogDescription>Измените параметры периода. Закрытые периоды недоступны для редактирования.</DialogDescription>
                    </DialogHeader>
                    <PeriodForm
                        form={editForm}
                        academicYears={academicYears}
                        statusOptions={statusOptions}
                        submitLabel="Сохранить изменения"
                        onSubmit={submitEdit}
                    />
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <CardTitle>Справочник KPI-сезонов</CardTitle>
                    {canManage && (
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <Plus className="h-4 w-4" />
                                    Добавить KPI-сезон
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Создание KPI-периода</DialogTitle>
                                    <DialogDescription>Настройте период и даты в рамках выбранного учебного года.</DialogDescription>
                                </DialogHeader>
                                <PeriodForm
                                    form={createForm}
                                    academicYears={academicYears}
                                    statusOptions={statusOptions}
                                    submitLabel="Создать период"
                                    onSubmit={submitCreate}
                                />
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                    <form className="flex flex-wrap items-end gap-3" onSubmit={applyFilters}>
                        <div className="min-w-[220px] space-y-2">
                            <label className="text-sm font-medium">Учебный год</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm" value={filterForm.data.academic_year_id} onChange={(e) => filterForm.setData('academic_year_id', e.target.value)}>
                            <option value="">Все учебные годы</option>
                            {academicYears.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                            </select>
                        </div>

                        <div className="min-w-[220px] space-y-2">
                            <label className="text-sm font-medium">Статус</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm" value={filterForm.data.status} onChange={(e) => filterForm.setData('status', e.target.value)}>
                                <option value="">Все статусы</option>
                                {statusOptions.map((option) => (
                                    <option key={option} value={option}>{statusLabels[option] ?? option}</option>
                                ))}
                            </select>
                        </div>

                        <Button type="submit">Применить</Button>
                        <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Таблица сезонов</CardTitle>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                            <CircleOff className="h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 text-sm text-muted-foreground">Периоды не найдены. Измените фильтры или создайте первый KPI-период.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="py-3 pe-3 font-medium">Период</th>
                                        <th className="py-3 pe-3 font-medium">Учебный год</th>
                                        <th className="py-3 pe-3 font-medium">Статус</th>
                                        <th className="py-3 pe-3 font-medium">Доступы</th>
                                        <th className="py-3 pe-3 font-medium">Даты</th>
                                        <th className="py-3 pe-3 font-medium">Описание</th>
                                        <th className="py-3 text-right font-medium">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((period) => (
                                        <tr key={period.id} className="border-b align-top last:border-0">
                                            <td className="py-4 pe-3">
                                                <div className="font-medium">{period.name}</div>
                                                <div className="mt-1 text-xs text-muted-foreground">Создал: {period.creator?.name ?? '—'}</div>
                                            </td>
                                            <td className="py-4 pe-3">{period.academic_year?.name ?? '—'}</td>
                                            <td className="py-4 pe-3">
                                                <Badge variant={statusVariants[period.status] ?? 'outline'}>{statusLabels[period.status] ?? period.status}</Badge>
                                            </td>
                                            <td className="py-4 pe-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {accessScopes.map((scope) => {
                                                        const isActive = Boolean(period[scope.field]);
                                                        const canToggle = canManage && period.status !== 'closed';

                                                        return (
                                                            <Button
                                                                key={`${period.id}-${scope.key}`}
                                                                type="button"
                                                                size="sm"
                                                                variant={isActive ? 'default' : 'outline'}
                                                                disabled={!canToggle}
                                                                onClick={() => (isActive ? deactivateScope(period, scope.key) : activateScope(period, scope.key))}
                                                            >
                                                                {scope.label}: {isActive ? 'ON' : 'OFF'}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="py-4 pe-3">
                                                <div>{formatDate(period.start_date)}</div>
                                                <div className="text-muted-foreground">{formatDate(period.end_date)}</div>
                                            </td>
                                            <td className="py-4 pe-3 text-muted-foreground">
                                                <div className="max-w-xs whitespace-pre-wrap break-words">{period.description || '—'}</div>
                                            </td>
                                            <td className="py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canManage && period.status !== 'closed' && (
                                                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(period)}>
                                                            <Pencil className="h-4 w-4" />
                                                            Изменить
                                                        </Button>
                                                    )}
                                                    {canManage && period.status !== 'active' && period.status !== 'closed' && (
                                                        <Button type="button" size="sm" onClick={() => activatePeriod(period)}>Активировать</Button>
                                                    )}
                                                    {canManage && period.status === 'active' && (
                                                        <Button type="button" variant="secondary" size="sm" onClick={() => deactivatePeriod(period)}>Деактивировать</Button>
                                                    )}
                                                    {canManage && period.status !== 'active' && (
                                                        <Button type="button" variant="destructive" size="sm" onClick={() => deletePeriod(period)}>
                                                            <Trash2 className="h-4 w-4" />
                                                            Удалить
                                                        </Button>
                                                    )}
                                                    {canManage && period.status === 'active' && (
                                                        <Button type="button" variant="outline" size="sm" onClick={() => closePeriod(period)}>Закрыть</Button>
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
                </CardContent>
            </Card>
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

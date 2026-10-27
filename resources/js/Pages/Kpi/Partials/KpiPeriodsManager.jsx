import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, FilterBar, FormField, Notice, StatusBadge, qdFieldClass } from '@/components/platform';
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
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react';
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

const statusTones = {
    draft: 'default',
    active: 'success',
    closed: 'info',
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

function periodDays(start, end) {
    if (!start || !end) return null;
    const a = new Date(start);
    const b = new Date(end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    return Math.round((b - a) / 86400000) + 1;
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
                    <label className="qd-field-label block">Учебный год (сезон)</label>
                    <select
                        className={qdFieldClass}
                        value={form.data.academic_year_id}
                        onChange={(e) => handleAcademicYearChange(e.target.value)}
                    >
                        <option value="">Выберите учебный год</option>
                        {academicYears.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                    {errorFor('academic_year_id') && <p className="text-sm text-red-700">{errorFor('academic_year_id')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Статус</label>
                    <select
                        className={qdFieldClass}
                        value={form.data.status}
                        onChange={(e) => form.setData('status', e.target.value)}
                    >
                        {statusOptions.map((option) => (
                            <option key={option} value={option}>{statusLabels[option] ?? option}</option>
                        ))}
                    </select>
                    {errorFor('status') && <p className="text-sm text-red-700">{errorFor('status')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Дата начала</label>
                    <Input type="date" value={form.data.start_date} onChange={(e) => form.setData('start_date', e.target.value)} />
                    {errorFor('start_date') && <p className="text-sm text-red-700">{errorFor('start_date')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="qd-field-label block">Дата окончания</label>
                    <Input type="date" value={form.data.end_date} onChange={(e) => form.setData('end_date', e.target.value)} />
                    {errorFor('end_date') && <p className="text-sm text-red-700">{errorFor('end_date')}</p>}
                </div>
            </div>

            {form.data.academic_year_id && form.data.start_date && (
                <Notice tone="info">Даты установлены автоматически. При необходимости скорректируйте вручную.</Notice>
            )}

            <div className="space-y-2">
                <label className="qd-field-label block">Описание</label>
                <textarea
                    className={`${qdFieldClass} h-auto min-h-20 py-2`}
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
    const totalCount = periods?.total ?? periods?.meta?.total ?? items.length;
    const fromIndex = periods?.from ?? periods?.meta?.from ?? null;
    const toIndex = periods?.to ?? periods?.meta?.to ?? null;
    const statusCounts = items.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
    }, {});

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

    const createDialog = canManage ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
                <Button>
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
    ) : null;

    return (
        <>
        <div className="space-y-4">
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

            <FilterBar>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <form onSubmit={applyFilters} className="min-w-0 flex-1">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                        <FormField label="Учебный год">
                            <select className={qdFieldClass} value={filterForm.data.academic_year_id} onChange={(e) => filterForm.setData('academic_year_id', e.target.value)}>
                                <option value="">Все учебные годы</option>
                                {academicYears.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Статус">
                            <select className={qdFieldClass} value={filterForm.data.status} onChange={(e) => filterForm.setData('status', e.target.value)}>
                                <option value="">Все статусы</option>
                                {statusOptions.map((option) => (
                                    <option key={option} value={option}>{statusLabels[option] ?? option}</option>
                                ))}
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
                    title="Периоды не найдены"
                    description="Измените фильтры или создайте первый KPI-период."
                    action={canManage ? (
                        <Button type="button" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Добавить KPI-сезон
                        </Button>
                    ) : null}
                />
            ) : (
                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarRange className="h-4 w-4" />
                            Справочник KPI-сезонов
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>Всего: <strong className="tabular-nums text-[#102945]">{totalCount}</strong></span>
                            {Object.entries(statusCounts).map(([status, count]) => (
                                <StatusBadge key={status} tone={statusTones[status] ?? 'default'}>
                                    {statusLabels[status] ?? status}: {count}
                                </StatusBadge>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead className="border-b border-slate-200">
                                    <tr className="text-left">
                                        <th>Период</th>
                                        <th className="whitespace-nowrap">Учебный год</th>
                                        <th>Статус</th>
                                        <th>Доступы</th>
                                        <th>Даты</th>
                                        <th>Описание</th>
                                        <th className="text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((period) => (
                                        <tr key={period.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50/60">
                                            <td>
                                                <div className="font-medium text-slate-900">{period.name}</div>
                                                <div className="mt-1 text-xs text-slate-500">Создал: {period.creator?.name ?? '—'}</div>
                                            </td>
                                            <td className="text-slate-700">{period.academic_year?.name ?? '—'}</td>
                                            <td>
                                                <StatusBadge tone={statusTones[period.status] ?? 'default'}>{statusLabels[period.status] ?? period.status}</StatusBadge>
                                            </td>
                                            <td>
                                                <div className="grid grid-cols-2 gap-1.5 2xl:grid-cols-4">
                                                    {accessScopes.map((scope) => {
                                                        const isActive = Boolean(period[scope.field]);
                                                        const canToggle = canManage && period.status !== 'closed';

                                                        return (
                                                            <button
                                                                key={`${period.id}-${scope.key}`}
                                                                type="button"
                                                                disabled={!canToggle}
                                                                aria-pressed={isActive}
                                                                onClick={() => (isActive ? deactivateScope(period, scope.key) : activateScope(period, scope.key))}
                                                                className={`inline-flex items-center justify-between gap-2 rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isActive
                                                                    ? 'border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-400'
                                                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-[#102945]'}`}
                                                            >
                                                                <span>{scope.label}</span>
                                                                <span className="flex items-center gap-1">
                                                                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-teal-600' : 'bg-slate-300'}`} />
                                                                    {isActive ? 'ON' : 'OFF'}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap tabular-nums">
                                                <div className="text-slate-900">{formatDate(period.start_date)} — {formatDate(period.end_date)}</div>
                                                {periodDays(period.start_date, period.end_date) ? (
                                                    <div className="text-xs text-slate-500">{periodDays(period.start_date, period.end_date)} дн.</div>
                                                ) : null}
                                            </td>
                                            <td className="text-slate-600">
                                                <div className="max-w-xs whitespace-pre-wrap break-words">{period.description || '—'}</div>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex flex-nowrap justify-end gap-2">
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

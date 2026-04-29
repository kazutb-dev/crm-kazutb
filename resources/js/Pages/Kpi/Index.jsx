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
import { Head, router, useForm } from '@inertiajs/react';
import { BarChart3, CalendarRange, CircleOff, Filter, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

const stageLabels = {
    plan: 'План',
    fact: 'Факт',
    review: 'Рассмотрение',
};

const statusLabels = {
    draft: 'Черновик',
    active: 'Активен',
    closed: 'Закрыт',
};

const statusVariants = {
    draft: 'outline',
    active: 'default',
    closed: 'secondary',
};

const emptyForm = {
    academic_year_id: '',
    name: '',
    stage: 'plan',
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

function getAcademicYearBounds(academicYear) {
    if (!academicYear) {
        return null;
    }

    return {
        min: `${academicYear.start_year}-01-01`,
        max: `${academicYear.end_year}-12-31`,
        label: `Границы учебного года: 01.01.${academicYear.start_year} - 31.12.${academicYear.end_year}`,
    };
}

function validateForm(data, academicYear) {
    const errors = {};
    const bounds = getAcademicYearBounds(academicYear);

    if (!data.academic_year_id) {
        errors.academic_year_id = 'Выберите учебный год.';
    }

    if (!data.name.trim()) {
        errors.name = 'Введите название периода.';
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

    if (bounds && data.start_date && (data.start_date < bounds.min || data.start_date > bounds.max)) {
        errors.start_date = `Дата начала должна быть в диапазоне ${bounds.min} - ${bounds.max}.`;
    }

    if (bounds && data.end_date && (data.end_date < bounds.min || data.end_date > bounds.max)) {
        errors.end_date = `Дата окончания должна быть в диапазоне ${bounds.min} - ${bounds.max}.`;
    }

    return errors;
}

function PeriodForm({ form, academicYears, stageOptions, statusOptions, submitLabel, onSubmit }) {
    const selectedAcademicYear = useMemo(
        () => academicYears.find((item) => String(item.id) === String(form.data.academic_year_id)) ?? null,
        [academicYears, form.data.academic_year_id],
    );

    const clientErrors = useMemo(
        () => validateForm(form.data, selectedAcademicYear),
        [form.data, selectedAcademicYear],
    );

    const bounds = getAcademicYearBounds(selectedAcademicYear);
    const isSubmitDisabled = form.processing || Object.keys(clientErrors).length > 0;
    const errorFor = (field) => clientErrors[field] ?? form.errors[field];

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Учебный год</label>
                    <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={form.data.academic_year_id}
                        onChange={(e) => form.setData('academic_year_id', e.target.value)}
                    >
                        <option value="">Выберите учебный год</option>
                        {academicYears.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                    {errorFor('academic_year_id') && <p className="text-sm text-destructive">{errorFor('academic_year_id')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Название периода</label>
                    <Input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="Например: Осенний сбор KPI"
                    />
                    {errorFor('name') && <p className="text-sm text-destructive">{errorFor('name')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Этап</label>
                    <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={form.data.stage}
                        onChange={(e) => form.setData('stage', e.target.value)}
                    >
                        {stageOptions.map((option) => (
                            <option key={option} value={option}>{stageLabels[option] ?? option}</option>
                        ))}
                    </select>
                    {errorFor('stage') && <p className="text-sm text-destructive">{errorFor('stage')}</p>}
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
                    <Input
                        type="date"
                        value={form.data.start_date}
                        min={bounds?.min}
                        max={bounds?.max}
                        onChange={(e) => form.setData('start_date', e.target.value)}
                    />
                    {errorFor('start_date') && <p className="text-sm text-destructive">{errorFor('start_date')}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Дата окончания</label>
                    <Input
                        type="date"
                        value={form.data.end_date}
                        min={bounds?.min}
                        max={bounds?.max}
                        onChange={(e) => form.setData('end_date', e.target.value)}
                    />
                    {errorFor('end_date') && <p className="text-sm text-destructive">{errorFor('end_date')}</p>}
                </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                    <CalendarRange className="h-4 w-4" />
                    Границы учебного года
                </div>
                <p className="mt-1">{bounds?.label ?? 'Сначала выберите учебный год.'}</p>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Описание</label>
                <textarea
                    className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.data.description}
                    onChange={(e) => form.setData('description', e.target.value)}
                    placeholder="Краткое описание периода и сценария его использования"
                />
                {errorFor('description') && <p className="text-sm text-destructive">{errorFor('description')}</p>}
            </div>

            <DialogFooter>
                <Button type="submit" disabled={isSubmitDisabled}>{submitLabel}</Button>
            </DialogFooter>
        </form>
    );
}

export default function Index({
    periods,
    academicYears = [],
    filters = {},
    stageOptions = ['plan', 'fact', 'review'],
    statusOptions = ['draft', 'active', 'closed'],
    permissions = {},
}) {
    const items = periods?.data ?? [];
    const links = periods?.links ?? [];
    const canManage = permissions.managePeriods ?? false;

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

        router.get(route('kpi.index'), {
            academic_year_id: filterForm.data.academic_year_id || undefined,
            stage: filterForm.data.stage || undefined,
            status: filterForm.data.status || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        filterForm.setData({ academic_year_id: '', stage: '', status: '' });

        router.get(route('kpi.index'), {}, {
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
            name: period.name ?? '',
            stage: period.stage ?? 'plan',
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

    const activatePeriod = (period) => {
        router.post(route('kpi.activate', period.id), {}, { preserveScroll: true });
    };

    const closePeriod = (period) => {
        router.post(route('kpi.close', period.id), {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            headerRight={canManage ? (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus />
                            Новый период
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Создание KPI-периода</DialogTitle>
                            <DialogDescription>
                                Настройте период, этап и даты в рамках выбранного учебного года.
                            </DialogDescription>
                        </DialogHeader>
                        <PeriodForm
                            form={createForm}
                            academicYears={academicYears}
                            stageOptions={stageOptions}
                            statusOptions={statusOptions}
                            submitLabel="Создать период"
                            onSubmit={submitCreate}
                        />
                    </DialogContent>
                </Dialog>
            ) : null}
        >
            <Head title="KPI-периоды" />

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
                        <DialogDescription>
                            Измените параметры периода. Закрытые периоды недоступны для редактирования.
                        </DialogDescription>
                    </DialogHeader>
                    <PeriodForm
                        form={editForm}
                        academicYears={academicYears}
                        stageOptions={stageOptions}
                        statusOptions={statusOptions}
                        submitLabel="Сохранить изменения"
                        onSubmit={submitEdit}
                    />
                </DialogContent>
            </Dialog>

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <Card className="border-0 bg-gradient-to-r from-slate-50 via-white to-amber-50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart3 className="h-5 w-5" />
                            Управление KPI-периодами
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Администратор управляет периодами сбора и согласования KPI по учебным годам.
                                Для каждого этапа можно отфильтровать список и быстро перейти к активации или закрытию периода.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего периодов</p>
                                <p className="mt-2 text-2xl font-semibold">{periods?.total ?? items.length}</p>
                            </div>
                            <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Активные</p>
                                <p className="mt-2 text-2xl font-semibold">
                                    {items.filter((item) => item.status === 'active').length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Filter className="h-4 w-4" />
                            Фильтры
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="grid gap-3 md:grid-cols-4" onSubmit={applyFilters}>
                            <select
                                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                                value={filterForm.data.academic_year_id}
                                onChange={(e) => filterForm.setData('academic_year_id', e.target.value)}
                            >
                                <option value="">Все учебные годы</option>
                                {academicYears.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                                value={filterForm.data.stage}
                                onChange={(e) => filterForm.setData('stage', e.target.value)}
                            >
                                <option value="">Все этапы</option>
                                {stageOptions.map((option) => (
                                    <option key={option} value={option}>{stageLabels[option] ?? option}</option>
                                ))}
                            </select>

                            <select
                                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                                value={filterForm.data.status}
                                onChange={(e) => filterForm.setData('status', e.target.value)}
                            >
                                <option value="">Все статусы</option>
                                {statusOptions.map((option) => (
                                    <option key={option} value={option}>{statusLabels[option] ?? option}</option>
                                ))}
                            </select>

                            <div className="flex gap-2">
                                <Button type="submit" className="flex-1">Применить</Button>
                                <Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Таблица периодов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                                <CircleOff className="h-8 w-8 text-muted-foreground" />
                                <p className="mt-3 text-sm text-muted-foreground">
                                    Периоды не найдены. Измените фильтры или создайте первый KPI-период.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="py-3 pe-3 font-medium">Период</th>
                                            <th className="py-3 pe-3 font-medium">Учебный год</th>
                                            <th className="py-3 pe-3 font-medium">Этап</th>
                                            <th className="py-3 pe-3 font-medium">Статус</th>
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
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Создал: {period.creator?.name ?? '—'}
                                                    </div>
                                                </td>
                                                <td className="py-4 pe-3">{period.academic_year?.name ?? '—'}</td>
                                                <td className="py-4 pe-3">
                                                    <Badge variant="outline">{stageLabels[period.stage] ?? period.stage}</Badge>
                                                </td>
                                                <td className="py-4 pe-3">
                                                    <Badge variant={statusVariants[period.status] ?? 'outline'}>
                                                        {statusLabels[period.status] ?? period.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-4 pe-3">
                                                    <div>{formatDate(period.start_date)}</div>
                                                    <div className="text-muted-foreground">{formatDate(period.end_date)}</div>
                                                </td>
                                                <td className="py-4 pe-3 text-muted-foreground">
                                                    <div className="max-w-xs whitespace-pre-wrap break-words">
                                                        {period.description || '—'}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {canManage && period.status !== 'closed' && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openEditDialog(period)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                                Изменить
                                                            </Button>
                                                        )}

                                                        {canManage && period.status !== 'active' && period.status !== 'closed' && (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                onClick={() => activatePeriod(period)}
                                                            >
                                                                Активировать
                                                            </Button>
                                                        )}

                                                        {canManage && period.status === 'active' && (
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => closePeriod(period)}
                                                            >
                                                                Закрыть
                                                            </Button>
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
        </AuthenticatedLayout>
    );
}
